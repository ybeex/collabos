// Diagnostic only — checks whether .env vars leak into process.env under tsx/node
const keys = ['DATABASE_URL', 'JWT_PRIVATE_KEY', 'ANTHROPIC_API_KEY', 'S3_ENDPOINT']
for (const k of keys) {
  console.log(`${k}: ${k in process.env ? 'LOADED' : 'NOT LOADED'}`)
}
