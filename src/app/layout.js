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
        <footer className="w-full border-t border-[#2f3336]/60 py-6 px-4 mt-8 bg-[#0a0a0c]/80 backdrop-blur-sm text-center">
          <div className="max-w-3xl mx-auto space-y-2">
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#a0a5a9] font-mono uppercase tracking-wider">
              <span>⚖️</span>
              <span>Yasal Bilgilendirme & Sorumluluk Reddi</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#71767b]">
              Bu platform, yalnızca arkadaşlar arasında eğlence ve rekabet amacıyla tasarlanmış kâr amacı gütmeyen sanal bir tahmin oyunudur. Sitede kesinlikle <strong className="text-[#a0a5a9]">gerçek para yatırma, para çekme, bakiye satışı veya nakit kazanç sağlama gibi hiçbir finansal işlem bulunmamaktadır</strong>. Sistemde kullanılan tüm puanlar, kuponlar ve sıralamalar tamamen oyun içi sanal simülasyon niteliğindedir; kumar veya bahis faaliyeti teşkil etmez.
            </p>
            <div className="text-[10px] text-[#53575b] font-mono">
              © 2026 Skaledler Ligi • Yalnızca Arkadaşlar Arası Eğlence Amaçlıdır
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
