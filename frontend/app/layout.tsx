import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

import { AppProviders } from './_components/AppProviders';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'Projeto1',
  description: 'Starter SaaS — Next.js + Laravel + Supabase',
};

/**
 * Script inline para evitar FOUC do tema. Roda antes do React hidratar,
 * lê localStorage e aplica data-theme em <html>. Conteúdo em string para
 * que o Next emita sem otimizar. Mantenha curto.
 */
const themeBootScript = `
(function(){
  try {
    var raw = localStorage.getItem('ui-store');
    var theme = 'system';
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.state && parsed.state.theme) {
        theme = parsed.state.theme;
      }
    }
    var resolved = theme;
    if (theme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', resolved);
  } catch (_) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: themeBootScript }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-surface text-text-primary antialiased`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
