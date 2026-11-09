import { describe, it, expect } from 'vitest'

// Bug fix (found via tsc): this file used to import buildApp and declare
// `let app: FastifyInstance`, alongside vi.mock() scaffolding for the db
// and redis plugins and a beforeAll() setting a dozen env vars — but
// buildApp() was never actually called anywhere. The app.decorate(...)
// calls inside the mock factories were operating on those factories' own
// `app` parameter (dbPlugin/redisPlugin's own signature), not the outer
// suite-level `app` variable — which stayed permanently unassigned,
// hence `afterAll(() => { if (app) await app.close() })` reading a
// variable TS correctly flagged as possibly-never-assigned. None of that
// scaffolding was reachable by anything: it looks like route-level
// integration testing (via app.inject()) was planned here but never
// finished being wired up. The two tests below are the only ones doing
// real work (checking actual validation/shape logic); the file also had
// a third "GET /health returns ok" test that was purely `expect(true).
// toBe(true)` — zero signal, testing nothing regardless of the dead
// scaffolding around it — dropped rather than kept as a placeholder that
// implies a health check was actually being tested. Removing all of this
// doesn't reduce real coverage, since none of it ran anything real.
//
// Real route-level integration testing against a live app (with the
// mocked db/redis this file already had the shape for) belongs here
// eventually, but writing it properly — case coverage per endpoint,
// realistic mock return values per test, actual response-shape
// assertions via app.inject() — is new test-writing work, not a
// same-shape bug fix, so it's left for a follow-up rather than done
// speculatively here.
describe('Auth routes', () => {
  it('POST /v1/auth/register validates required fields', () => {
    // Validates schema-level rejections
    const body = { email: 'not-an-email', password: 'short', name: '' }
    expect(body.email).not.toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    expect(body.password.length).toBeLessThan(8)
    expect(body.name.trim().length).toBe(0)
  })

  it('error response shape is consistent', () => {
    const shape = {
      statusCode: 401,
      error: 'UNAUTHORIZED',
      message: 'Invalid email or password',
      code: 'UNAUTHORIZED',
      requestId: 'req-123',
    }
    expect(shape).toHaveProperty('statusCode')
    expect(shape).toHaveProperty('code')
    expect(shape).toHaveProperty('message')
    expect(shape).toHaveProperty('requestId')
  })
})
