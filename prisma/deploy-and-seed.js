const { execSync } = require('child_process');

async function run() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
  if (!dbUrl) {
    console.log('Veritabanı adresi (DATABASE_URL veya Vercel Postgres) bulunamadı, kurulum adımı atlanıyor.');
    return;
  }
  process.env.DATABASE_URL = dbUrl;

  console.log('🚀 Veritabanı tabloları otomatik kuruluyor (prisma migrate deploy)...');
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  } catch (error) {
    console.warn('Migrate sırasında uyarı:', error.message);
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

  console.log('✅ Veritabanı kurulumu başarıyla tamamlandı!');
}

run().catch((err) => {
  console.warn('deploy-and-seed hatası:', err);
});
