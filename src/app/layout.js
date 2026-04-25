// src/app/layout.js
import './globals.css';

export const metadata = {
  title: 'Critique Engine',
  description: 'Telegram Art Critique Mini App',
};

export default function RootLayout({ children }) {
  return (
    // Add suppressHydrationWarning here to stop Next.js from panicking 
    // when Telegram injects its theme colors!
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" async></script>
      </head>
      <body className="bg-zinc-900 text-white">
        {children}
      </body>
    </html>
  );
}