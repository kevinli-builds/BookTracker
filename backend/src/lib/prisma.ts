import { PrismaClient } from '@prisma/client';

// Reuse a single client across hot-reloads / warm serverless invocations so we
// don't open a new connection pool on every reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
