import type { JWTPayload } from './auth.js'

// Bug fix (found via a real `tsc` typecheck — apps/api had never been
// compiled against real @fastify/jwt types before, since Prisma-generate
// being blocked meant every prior verification attempt stopped before
// reaching this file too): @fastify/jwt computes FastifyRequest['user']'s
// type via a conditional type keyed off `declare module '@fastify/jwt' {
// interface FastifyJWT { user: ... } }` (see node_modules/@fastify/jwt/
// types/jwt.d.ts — UserType = FastifyJWT extends { user: infer T } ? T :
// SignPayloadType). Augmenting `FastifyRequest.user` directly, as this
// file did, is the wrong extension point per that package's own design —
// it never took effect, so `req.user` silently widened to
// @fastify/jwt's fallback `string | object | Buffer` everywhere,
// defeating type safety on every authenticated route (~15+ files access
// `req.user.sub`). Augmenting FastifyJWT itself is the fix.
declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: JWTPayload
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    workspaceRole?: string
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}
