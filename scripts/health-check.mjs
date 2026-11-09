#!/usr/bin/env node
/**
 * Health check script — verifies all services are reachable.
 * Usage: node scripts/health-check.mjs
 */
const API_URL = process.env.API_URL ?? 'http://localhost:3001'
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000'

const check = async (name, url) => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
    const ok = res.ok || res.status === 404 // 404 means the server is up
    console.log(`${ok ? '✓' : '✗'} ${name}: ${res.status} (${url})`)
    return ok
  } catch (err) {
    console.log(`✗ ${name}: ${err.message} (${url})`)
    return false
  }
}

const results = await Promise.all([
  check('API health', `${API_URL}/health`),
  check('API docs', `${API_URL}/docs`),
  check('Web', WEB_URL),
])

const allOk = results.every(Boolean)
process.exit(allOk ? 0 : 1)
