import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CardsAndMore — Card Games With Friends',
  description: 'Multiplayer card games in your browser. No account required. Play Make 21, Cambio, and more.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen felt-texture antialiased">{children}</body>
    </html>
  );
}
