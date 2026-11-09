// Bug fix (found via tsc/lint sweep): this project had a `"lint": "next
// lint"` script but no eslint.config.mjs at all — `next lint` under
// ESLint 9 (flat config) refuses to run non-interactively without one,
// prompting to generate a config instead. This is that config, written
// directly rather than answering the interactive prompt, using the
// FlatCompat bridge Next.js's own docs recommend for `eslint-config-next`
// (which still ships its rule sets in the pre-flat-config format).
import { FlatCompat } from '@eslint/eslintrc'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
]

export default eslintConfig
