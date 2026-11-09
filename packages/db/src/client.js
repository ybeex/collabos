import { PrismaClient } from '@prisma/client';
const createPrismaClient = () => {
    return new PrismaClient({
        log: process.env['NODE_ENV'] === 'development'
            ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
            : ['warn', 'error'],
        errorFormat: 'minimal',
    });
};
// Global singleton to prevent multiple instances in development (hot reload)
const globalForPrisma = globalThis;
export const db = globalForPrisma.prisma ?? createPrismaClient();
if (process.env['NODE_ENV'] !== 'production') {
    globalForPrisma.prisma = db;
}
//# sourceMappingURL=client.js.map