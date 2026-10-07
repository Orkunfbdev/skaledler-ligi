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
      <body className="min-h-screen bg-black text-[#e7e9ea] font-sans antialiased">
        <main className="w-full max-w-7xl mx-auto min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
