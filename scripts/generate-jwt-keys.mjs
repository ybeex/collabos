#!/usr/bin/env node
/**
 * Generates RS256 keypair for JWT signing.
 * Run: node scripts/generate-jwt-keys.mjs
 * Then copy the output into your .env file.
 */
import { generateKeyPairSync } from 'crypto'

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

const escape = (pem) => pem.replace(/\n/g, '\\n')

console.log(`
# Copy these into your .env file:

JWT_PRIVATE_KEY="${escape(privateKey)}"
JWT_PUBLIC_KEY="${escape(publicKey)}"
`)
