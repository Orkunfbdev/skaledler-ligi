import { PrismaClient } from '@prisma/client';

const getDbUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.POSTGRES_PRISMA_URL) return process.env.POSTGRES_PRISMA_URL;
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  if (process.env.STORAGE_URL) return process.env.STORAGE_URL;
  if (process.env.STORAGE_DATABASE_URL) return process.env.STORAGE_DATABASE_URL;
  if (process.env.STORAGE_POSTGRES_URL) return process.env.STORAGE_POSTGRES_URL;
  for (const [key, value] of Object.entries(process.env)) {
    if (value && typeof value === 'string' && (value.startsWith('postgres://') || value.startsWith('postgresql://'))) {
      return value;
    }
  }
  return undefined;
};

const resolvedUrl = getDbUrl();
if (resolvedUrl && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = resolvedUrl;
}

const prisma = globalThis.__skaledlerPrisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.__skaledlerPrisma = prisma;

export default prisma;
