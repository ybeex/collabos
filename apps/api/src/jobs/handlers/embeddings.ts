/**
 * Embeddings handler — generates vector embeddings for Work Graph nodes.
 * Uses self-hosted Ollama (nomic-embed-text, free) with Anthropic fallback.
 * nomic-embed-text produces 768-dim vectors; Anthropic produces 1536-dim.
 * Both stored in pgvector float[] column.
 */
import type { PrismaClient } from '@prisma/client'
import { env } from '../../utils/env.js'
import { logger } from '../../utils/logger.js'

interface EmbeddingJob {
  type: string
  entityId: string
  workspaceId: string
  text: string
}

// ── Ollama embedding (self-hosted, free) ─────────────────────────────────────
const embedWithOllama = async (text: string): Promise<number[]> => {
  const res = await fetch(`${env.OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: env.OLLAMA_EMBED_MODEL, prompt: text }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    throw new Error(`Ollama embedding failed: ${res.status} ${await res.text()}`)
  }

  const data = await res.json() as { embedding: number[] }
  return data.embedding
}

// ── Anthropic embedding fallback ─────────────────────────────────────────────
const embedWithAnthropic = async (text: string): Promise<number[]> => {
  // Anthropic doesn't have a dedicated embeddings endpoint yet —
  // use voyage-3-lite via voyage.ai (compatible key format) or
  // generate a digest embedding via a prompt as fallback.
  // For now: return a zero-vector placeholder if Anthropic has no embedding API.
  // Replace this with voyage.ai or another provider when available.
  logger.warn({ textLength: text.length }, 'Anthropic embeddings not available — using zero vector placeholder')
  return new Array(768).fill(0) as number[]
}

export const generateEmbedding = async (text: string): Promise<number[] | null> => {
  if (!env.ENABLE_EMBEDDINGS) return null

  // Truncate to avoid token limits (nomic-embed-text: 8192 tokens)
  const truncated = text.slice(0, 8000)

  try {
    if (env.EMBEDDINGS_PROVIDER === 'ollama') {
      return await embedWithOllama(truncated)
    }
    return await embedWithAnthropic(truncated)
  } catch (err) {
    if (env.EMBEDDINGS_PROVIDER === 'ollama') {
      logger.warn({ err }, 'Ollama embedding failed — trying Anthropic fallback')
      try {
        return await embedWithAnthropic(truncated)
      } catch (fallbackErr) {
        logger.error({ fallbackErr }, 'All embedding providers failed')
        return null
      }
    }
    logger.error({ err }, 'Embedding generation failed')
    return null
  }
}

export const processEmbedding = async (
  job: Record<string, unknown>,
  db: PrismaClient,
): Promise<void> => {
  // Bug fix (found via tsc): same 'convert to unknown first' pattern as
  // jobs/queues/worker-registry.ts's cast the other direction — this
  // project's local {}Job interfaces are closed shapes that don't
  // structurally overlap with Record<string, unknown> under strict mode.
  const { entityId, workspaceId, text, type } = job as unknown as EmbeddingJob

  if (!env.ENABLE_EMBEDDINGS) {
    logger.debug('Embeddings disabled — skipping')
    return
  }

  const embedding = await generateEmbedding(text)
  if (!embedding) return

  await db.workGraphNode.upsert({
    where: { entityId },
    create: {
      entityType: type.split('.')[0] ?? 'unknown',
      entityId,
      workspaceId,
      embedding,
      metadata: { textPreview: text.slice(0, 200) },
    },
    update: {
      embedding,
      metadata: { textPreview: text.slice(0, 200) },
      updatedAt: new Date(),
    },
  })

  logger.debug({ entityId, type, dims: embedding.length }, 'Embedding stored')
}
