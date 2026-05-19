import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Play21 — Make 21 With 4 Cards',
  description: 'A multiplayer math card game. Race against friends to find a mathematical expression that equals 21.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen felt-texture antialiased">{children}</body>
    </html>
  );
}
