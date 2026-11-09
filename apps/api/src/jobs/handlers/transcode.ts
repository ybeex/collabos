/**
 * FFmpeg transcoding handler — converts uploaded video/audio to web-compatible formats.
 * Runs FFmpeg as a child process. Self-hosted, zero cost.
 * Input:  raw upload from S3 (any format)
 * Output: H.264 MP4 + JPEG thumbnail → uploaded back to S3
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createWriteStream, createReadStream } from 'node:fs'
import { unlink, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { PrismaClient } from '@prisma/client'
import { env } from '../../utils/env.js'
import { logger } from '../../utils/logger.js'

const execFileAsync = promisify(execFile)

interface TranscodeJob {
  attachmentId: string
  s3Key: string
  workspaceId: string
  uploadedById: string
}

const downloadFromS3 = async (key: string, dest: string): Promise<void> => {
  const res = await fetch(`${env.S3_ENDPOINT}/${env.S3_BUCKET}/${key}`, {
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) throw new Error(`S3 download failed: ${res.status}`)
  if (!res.body) throw new Error('Empty S3 response body')
  const writer = createWriteStream(dest)
  const reader = res.body.getReader()
  await new Promise<void>((resolve, reject) => {
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) { writer.end(); resolve(); return }
          writer.write(value)
        }
      } catch (err) { reject(err) }
    }
    pump()
  })
}

const uploadToS3 = async (localPath: string, key: string, mimeType: string): Promise<void> => {
  const stream = createReadStream(localPath)
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  const body = Buffer.concat(chunks)

  const res = await fetch(`${env.S3_ENDPOINT}/${env.S3_BUCKET}/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType, 'Content-Length': String(body.length) },
    body,
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`)
}

export const processTranscode = async (
  job: Record<string, unknown>,
  db: PrismaClient,
): Promise<void> => {
  // Bug fix (found via tsc): same 'convert to unknown first' pattern as
  // jobs/queues/worker-registry.ts's cast the other direction — this
  // project's local {}Job interfaces are closed shapes that don't
  // structurally overlap with Record<string, unknown> under strict mode.
  const { attachmentId, s3Key } = job as unknown as TranscodeJob

  // Verify FFmpeg is available
  try {
    await execFileAsync('ffmpeg', ['-version'])
  } catch {
    logger.warn('FFmpeg not found — skipping transcode. Install ffmpeg to enable video processing.')
    return
  }

  const workDir = join(tmpdir(), `transcode-${attachmentId}`)
  await mkdir(workDir, { recursive: true })

  const inputPath = join(workDir, 'input')
  const outputPath = join(workDir, 'output.mp4')
  const thumbPath = join(workDir, 'thumb.jpg')

  const cleanup = async () => {
    for (const p of [inputPath, outputPath, thumbPath]) {
      await unlink(p).catch(() => {})
    }
  }

  try {
    logger.info({ attachmentId, s3Key }, 'Starting transcode')

    // 1. Download original from S3
    await downloadFromS3(s3Key, inputPath)

    // 2. Transcode to H.264 MP4 (web-safe, small file size)
    //    - crf 23: good quality/size balance
    //    - preset fast: speed over compression ratio
    //    - movflags +faststart: enables streaming before full download
    //    - scale: cap at 1280px wide, preserve aspect ratio
    //    - acodec aac: universal audio codec
    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-vcodec', 'libx264',
      '-crf', '23',
      '-preset', 'fast',
      '-movflags', '+faststart',
      '-vf', 'scale=min(1280\\,iw):-2',
      '-acodec', 'aac',
      '-b:a', '128k',
      '-max_muxing_queue_size', '9999',
      '-y', outputPath,
    ], { timeout: 300_000 })

    // 3. Extract thumbnail at 3 seconds (or first frame if video shorter)
    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-ss', '00:00:03',
      '-vframes', '1',
      '-vf', 'scale=640:-2',
      '-y', thumbPath,
    ], { timeout: 30_000 }).catch(async () => {
      // Fallback: first frame
      await execFileAsync('ffmpeg', [
        '-i', inputPath,
        '-vframes', '1',
        '-vf', 'scale=640:-2',
        '-y', thumbPath,
      ], { timeout: 30_000 })
    })

    // 4. Upload processed files to S3
    const ext = s3Key.split('.').pop() ?? 'mp4'
    const baseKey = s3Key.replace(`.${ext}`, '')
    const processedKey = `${baseKey}_processed.mp4`
    const thumbKey = `${baseKey}_thumb.jpg`

    await Promise.all([
      uploadToS3(outputPath, processedKey, 'video/mp4'),
      uploadToS3(thumbPath, thumbKey, 'image/jpeg'),
    ])

    // 5. Update attachment record with processed URLs
    await db.attachment.update({
      where: { id: attachmentId },
      data: {
        url: `${env.S3_PUBLIC_URL}/${processedKey}`,
        mimeType: 'video/mp4',
      },
    })

    logger.info({ attachmentId, processedKey, thumbKey }, 'Transcode complete')
  } finally {
    await cleanup()
    // Remove temp dir
    await unlink(workDir).catch(() => {})
  }
}
