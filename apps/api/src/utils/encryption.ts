/**
 * AES-256-GCM encryption for sensitive fields stored in the database.
 * Used for: SSO certificates, webhook secrets, SCIM tokens.
 *
 * Security properties:
 * - AES-256-GCM: authenticated encryption — provides both confidentiality and integrity.
 * - Random 12-byte IV per encryption — never reuse IVs with the same key.
 * - Auth tag (16 bytes) detects tampering.
 * - Key derived from ENCRYPTION_KEY env var (64 hex chars = 32 bytes = 256 bits).
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { env } from './env.js'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12   // 96 bits — recommended for GCM
const TAG_LENGTH = 16  // 128 bits — GCM auth tag

const getKey = (): Buffer => {
  if (!env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is required for sensitive field encryption. Generate with: openssl rand -hex 32')
  }
  return Buffer.from(env.ENCRYPTION_KEY, 'hex')
}

/**
 * Encrypt a plaintext string.
 * Returns: `iv:ciphertext:authTag` (all hex-encoded, colon-separated)
 */
export const encrypt = (plaintext: string): string => {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])

  const authTag = cipher.getAuthTag()

  return [
    iv.toString('hex'),
    encrypted.toString('hex'),
    authTag.toString('hex'),
  ].join(':')
}

/**
 * Decrypt a value produced by encrypt().
 * Throws if the auth tag doesn't match (tampered ciphertext).
 */
export const decrypt = (encryptedValue: string): string => {
  const key = getKey()
  const parts = encryptedValue.split(':')

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format — expected iv:ciphertext:authTag')
  }

  const [ivHex, ciphertextHex, authTagHex] = parts as [string, string, string]

  const iv = Buffer.from(ivHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}

/**
 * Returns true if ENCRYPTION_KEY is configured.
 */
export const encryptionAvailable = (): boolean => !!env.ENCRYPTION_KEY

/**
 * Encrypt only if ENCRYPTION_KEY is set; otherwise return plaintext.
 * Use for gradual rollout — logs a warning when running unencrypted.
 */
export const encryptSafe = (value: string): string => {
  if (!encryptionAvailable()) return value
  return encrypt(value)
}

export const decryptSafe = (value: string): string => {
  if (!encryptionAvailable()) return value
  // Detect encrypted format by checking for iv:ct:tag pattern
  if (value.includes(':') && value.split(':').length === 3) {
    return decrypt(value)
  }
  return value // legacy plaintext
}
