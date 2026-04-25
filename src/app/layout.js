// src/app/layout.js
import './globals.css';
import Script from 'next/script'; // 👉 THE FIX: Import the Next.js Script component

export const metadata = {
  title: 'Critique Engine',
  description: 'Telegram Art Critique Mini App',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* 👉 THE FIX: Force Telegram to load BEFORE React boots up */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body className="bg-zinc-900 text-white">
        {children}
      </body>
    </html>
  );
}