// Bug fix (found via a real `next build`, not just typecheck): these were
// `.js`-suffixed relative imports (Node-ESM/nodenext convention). This
// package's tsconfig uses `moduleResolution: "bundler"`, which doesn't
// require or expect that suffix — and apps/web's tsconfig path-aliases
// `@collabos/shared` straight to this file (bypassing package.json's
// `main` entirely, for fast dev iteration without a rebuild step), so
// webpack was resolving `.js` literally against a directory that only has
// `.ts` files and failing. tsc, tsx, and vitest all tolerated the old
// form; webpack didn't.
export * from './types/index';
export * from './validators/index';
export * from './constants/index';
export * from './utils/index';
//# sourceMappingURL=index.js.map