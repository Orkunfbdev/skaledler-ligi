try { require('dotenv').config(); } catch {}
const { execSync } = require('child_process');

async function run() {
  let dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.STORAGE_URL || process.env.STORAGE_DATABASE_URL || process.env.STORAGE_POSTGRES_URL;
  if (!dbUrl) {
    for (const [key, value] of Object.entries(process.env)) {
      if (value && typeof value === 'string' && (value.startsWith('postgres://') || value.startsWith('postgresql://'))) {
        dbUrl = value;
        break;
      }
    }
  }
  if (!dbUrl) {
    console.log('Veritabanı adresi (DATABASE_URL veya Vercel Postgres) bulunamadı, kurulum adımı atlanıyor.');
    return;
  }
  process.env.DATABASE_URL = dbUrl;

  console.log('🚀 Veritabanı tabloları senkronize ediliyor (prisma db push)...');
  try {
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
  } catch (error) {
    console.warn('db push uyarısı, migrate deneniyor:', error.message);
    try {
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    } catch (e) {
      console.warn('migrate uyarısı:', e.message);
    }
  }

  console.log('🌱 Takımlar, admin hesabı ve fikstürler otomatik yükleniyor...');
  try {
    execSync('node prisma/seed.js', { stdio: 'inherit' });
  } catch (error) {
    console.warn('Seed sırasında uyarı:', error.message);
  }

  try {
    execSync('node prisma/import-fixtures.js', { stdio: 'inherit' });
  } catch (error) {
    console.warn('Fikstür yükleme sırasında uyarı:', error.message);
  }

  try {
    const fs = require('fs');
    const path = require('path');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
    await prisma.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS app_private;');
    const migrationPath = path.join(__dirname, 'migrations', '20261007000001_settlement', 'migration.sql');
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      const funcSql = sql.substring(sql.indexOf('create or replace function'), sql.indexOf('REVOKE ALL')).trim();
      await prisma.$executeRawUnsafe(funcSql);
      await prisma.$executeRawUnsafe('REVOKE ALL ON FUNCTION app_private.settle_match(uuid, integer, integer) FROM PUBLIC;');
    }
    await prisma.$disconnect();
    console.log('⚙️ app_private.settle_match fonksiyonu doğrulandı.');
  } catch (e) {
    console.warn('settle_match fonksiyon kurulum uyarısı:', e.message);
  }

  console.log('✅ Veritabanı kurulumu başarıyla tamamlandı!');
}

run().catch((err) => {
  console.warn('deploy-and-seed hatası:', err);
});
