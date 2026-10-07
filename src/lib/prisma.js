import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL && (process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL)) {
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
}

const prisma = globalThis.__skaledlerPrisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.__skaledlerPrisma = prisma;

export default prisma;
