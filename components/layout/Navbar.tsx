import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-gold/20">
      <Link href="/" className="text-gold font-display text-2xl tracking-widest hover:text-gold-light transition-colors">
        Play<span className="text-white">21</span>
      </Link>
      <div className="flex gap-2 text-white/40 text-xl select-none">
        <span>♠</span><span>♥</span><span>♦</span><span>♣</span>
      </div>
    </nav>
  );
}
