# Skaledler Ligi

Next.js uygulaması kendi kayıt, giriş ve çıkış API'sini kullanır. Hesaplar, tahminler, puanlar, fikstür ve profil fotoğrafları Prisma üzerinden PostgreSQL'de saklanır. Supabase hesabı veya anahtarı gerekmez.

## Yerel çalıştırma

Node.js 20+ ve PostgreSQL gerekir. `.env.example` dosyasını `.env` olarak kopyalayıp `DATABASE_URL` ve `AUTH_SECRET` değerlerini ayarlayın. Mevcut yerel `.env` dosyanız varsa koruyun.

```powershell
npm ci
npm run db:deploy
npm run db:seed
npm run dev
```

`db:seed` 20 takımı, 3. haftadan sonraki 36 lig turunu ve ilk aktif haftayı ekler. Tekrar çalıştırıldığında mevcut kullanıcıları, tahminleri veya sonuçları silmez. Kupa günleri lig fikstürüne dahil değildir.

## Vercel'e hazırlık

1. Vercel Storage/Marketplace üzerinden **Prisma Postgres** veya **Neon Postgres** bağlayın. Bağlantı dizesi `DATABASE_URL` olarak tanımlanmalı; bağlantı havuzu destekleyen URL kullanın.
2. Vercel proje ayarlarına `AUTH_SECRET` (rastgele, en az 32 bayt), `ADMIN_EMAIL` (yöneticinin kayıt olacağı e-posta) ve `ADMIN_SETUP_KEY` (rastgele kurulum kodu) değerlerini ekleyin. Bunları `NEXT_PUBLIC_` önekiyle tanımlamayın.
3. Aynı veritabanı URL'siyle, **ilk dağıtımdan önce**, `npm run db:deploy` ve `npm run db:seed` komutlarını bir kez çalıştırın. Veritabanı bağlantı bilgisini Git'e koymayın.
4. Projeyi Vercel'e dağıtın. Yönetici, `ADMIN_EMAIL` ile kayıt olurken `ADMIN_SETUP_KEY` değerini “Yönetici kurulum kodu” alanına girer. Arkadaşlar kod alanını boş bırakır.

Yeni boş veritabanının tabloları `prisma/migrations` içindedir. Mevcut başka bir Supabase veritabanındaki hesaplar bu kurulumla otomatik taşınmaz. Kullanıcıların yeniden kayıt olması gerekir; veri aktarımı istenirse ayrıca planlanmalıdır.

Otomatik OSM botu yoktur. Maç skorları yönetici panelinden girilir. Son maç sonuçlandırılınca aktif hafta bir artar.
