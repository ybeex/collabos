// Bug fix (found via lint sweep, same as apps/web's eslint.config.mjs):
// this project had a `"lint": "eslint src --ext .ts"` script, but no
// eslint.config.js at all — ESLint 9 (flat config) refuses to run
// without one, and `eslint` itself was only ever available here by
// accident of npm-workspace hoisting from apps/web's devDependencies
// (not declared as apps/api's own dependency — same "used but never
// declared" pattern as the livekit-client/bullmq/ws fixes earlier this
// session).
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // This codebase relies heavily on Fastify's own runtime validation
      // (zod .parse()) rather than exhaustive compile-time typing at
      // every boundary, and on intentional `unknown` boundaries for job
      // queue payloads (see jobs/queues/worker-registry.ts) — downgrading
      // rather than disabling keeps these visible without blocking CI on
      // patterns this project uses deliberately.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
)
