import { PrismaClient } from '@prisma/client'

const createPrismaClient = (): PrismaClient => {
  return new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
        : ['warn', 'error'],
    errorFormat: 'minimal',
  })
}

// Global singleton to prevent multiple instances in development (hot reload)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = db
}
