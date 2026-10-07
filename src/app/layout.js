import "./globals.css";

export const metadata = {
  title: "Skaledler Ligi",
  description: "Skaledler Ligi Resmi Arenası",
  icons: {
    icon: [
      { url: "/icon.png" },
      { url: "/favicon.ico" }
    ],
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <head>
        <link rel="icon" href="/icon.png" />
      </head>
      <body className="min-h-screen bg-black text-[#e7e9ea] font-sans antialiased flex flex-col justify-between">
        <main className="w-full max-w-7xl mx-auto flex-1">
          {children}
        </main>
        <footer className="w-full border-t border-[#2f3336]/60 py-8 px-4 mt-12 bg-[#0a0a0c]/90 backdrop-blur-md">
          <div className="max-w-4xl mx-auto space-y-3.5">
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-white font-mono uppercase tracking-wider">
              <span>⚖️</span>
              <span>Yasal Bilgilendirme, Hukuki Beyan & Sorumluluk Reddi</span>
            </div>

            <div className="text-[11px] leading-relaxed text-[#71767b] space-y-2.5 bg-black/60 p-4 rounded-xl border border-[#2f3336]/60">
              <p>
                <strong className="text-gray-300">1. Platformun Mahiyeti, Sanal OSM Ligi & Oyunlaştırma:</strong> Bu platform, bağımsız bir arkadaş topluluğunun <strong>Online Soccer Manager (OSM)</strong> mobil futbol oyunu simülasyonlarını keyifli kılmak amacıyla kurulmuş, kâr amacı gütmeyen sanal bir istatistik, eğlence ve oyunlaştırma (gamification) ortamıdır. Sosyal platformlar ve video oyunlarındaki öngörü ve skor sistemleri gibi tamamen rekreasyonel dostluk ve eğlence maksadıyla çalışmaktadır.
              </p>
              <p>
                <strong className="text-gray-300">2. Ticari Mal/Hizmet Satın Alma Yasağı & Sıfır Ticari Nitelik:</strong> Sistemde öngörüler yoluyla elde edilen veya tutulan puanlar ile <strong className="text-white">kesinlikle hiçbir ticari işlem yapılamaz; herhangi bir mal, hizmet, abonelik, hediye çeki, dijital ürün veya fiziksel emtia satın alınamaz</strong>. Platformun hiçbir ticari işletmeyle bağlantısı veya e-ticaret/ödeme altyapısı bulunmamaktadır. Puanlar satılamaz, nakde çevrilemez veya ticari amaçla devredilemez.
              </p>
              <p>
                <strong className="text-gray-300">3. Finansal İşlem ve Maddi Değer Yokluğu:</strong> Sitede kesinlikle <strong className="text-white">gerçek para yatırma, para çekme, bakiye satın alma, nakit ödül veya herhangi bir finansal menfaat elde etme unsuru bulunmamaktadır</strong>. Sistemde yer alan "Puan", "Kupon", "Oran" ve "Bakiye" gibi ibareler tamamen oyun içi sanal prestij ve lig sıralaması niteliğinde olup, hiçbir parasal veya ekonomik değere sahip değildir.
              </p>
              <p>
                <strong className="text-gray-300">4. Hukuki Dayanak (7258 Sayılı Kanun & TCK m. 228 Kapsamı):</strong> Platform gerçek dünya spor müsabakalarına dayalı bir bahis ortamı olmayıp; Türk Ceza Kanunu Madde 228 (Kumar) kapsamında aranan maddi kazanç gayesi ve kâr/zarar unsuru barındırmaz. 7258 sayılı Futbol ve Diğer Spor Müsabakalarında Bahis ve Şans Oyunları Düzenlenmesi Hakkında Kanun kapsamında herhangi bir yasadışı bahis, kumar veya şans oyunu faaliyeti teşkil etmez.
              </p>
              <p className="text-[10px] text-[#53575b] pt-2 border-t border-[#2f3336]/40">
                Online Soccer Manager (OSM) ticari markası ve telif hakları Gamebasics BV / Miniclip şirketine aittir. Bu site bağımsız bir arkadaş topluluğu projesidir ve OSM ile herhangi bir resmi bağı veya sponsorluğu bulunmamaktadır.
              </p>
            </div>

            <div className="text-[10px] text-[#53575b] font-mono text-center">
              © 2026 Skaledler Ligi • Yalnızca Arkadaşlar Arası Sanal OSM Simülasyonu, Gamification & Eğlence Amaçlıdır
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
