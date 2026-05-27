import Link from 'next/link';
import PokerBackground from '@/components/layout/PokerBackground';
import Navbar from '@/components/layout/Navbar';

const GAMES = [
  {
    href: '/21',
    symbol: '21',
    name: 'Make 21',
    description: 'Use +, −, ×, ÷ with dealt cards to reach exactly 21. Left-to-right evaluation — no order of operations.',
    players: '1–10 players',
    tags: ['Math', 'Speed'],
  },
  {
    href: '/cambio',
    symbol: '♻',
    name: 'Cambio',
    description: 'Lowest score wins. Swap your cards to build the lowest possible hand before someone calls Cambio.',
    players: '2–10 players',
    tags: ['Memory', 'Bluffing'],
  },
];

export default function DashboardPage() {
  return (
    <>
      <PokerBackground />
      <div className="relative min-h-screen flex flex-col">
        <Navbar />

        <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-14 flex flex-col gap-12">

          {/* Hero */}
          <section className="text-center">
            <h1 className="text-6xl md:text-7xl font-display tracking-widest mb-3">
              <span className="text-gold">Cards</span>
              <span className="text-white">&amp;More</span>
            </h1>
            <div className="flex items-center justify-center gap-3 my-3">
              <div className="h-px w-16 bg-gold/30" />
              <span className="text-gold/50 text-lg">♠ ♥ ♦ ♣</span>
              <div className="h-px w-16 bg-gold/30" />
            </div>
            <p className="text-white/50 font-display italic tracking-widest">
              Play. Bluff. Win.
            </p>
          </section>

          {/* Games grid */}
          <section>
            <h2 className="text-gold/50 text-xs tracking-widest uppercase mb-6 text-center">Choose a Game</h2>
            <div className="flex flex-wrap gap-6 justify-center">
              {GAMES.map((game) => (
                <Link
                  key={game.href}
                  href={game.href}
                  className="
                    group relative w-56 h-80 rounded-xl gold-border bg-felt-dark
                    hover:scale-105 hover:shadow-2xl hover:shadow-gold/20
                    transition-all duration-300 overflow-hidden
                    flex flex-col items-center justify-center gap-3 p-6
                  "
                >
                  <div className="absolute inset-0 flex items-center justify-center opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none select-none">
                    <span className="text-[120px] text-gold font-display font-bold leading-none">{game.symbol}</span>
                  </div>

                  <div className="relative z-10 flex flex-col items-center gap-2 text-center">
                    <div className="w-14 h-14 rounded-full bg-gold/10 border-2 border-gold flex items-center justify-center">
                      <span className="text-gold text-2xl font-display font-bold">{game.symbol}</span>
                    </div>
                    <h3 className="text-white text-xl font-display tracking-wide">{game.name}</h3>
                    <p className="text-white/40 text-xs leading-relaxed">{game.description}</p>
                    <div className="flex items-center gap-1 text-gold/50 text-xs mt-1">
                      <span>👥</span>
                      <span>{game.players}</span>
                    </div>
                    <div className="flex gap-1 mt-1">
                      {game.tags.map((t) => (
                        <span key={t} className="text-[9px] border border-white/10 text-white/30 rounded px-1.5 py-0.5 uppercase tracking-wider">{t}</span>
                      ))}
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold scale-x-0 group-hover:scale-x-100 transition-transform" />
                </Link>
              ))}
            </div>
          </section>

        </main>

        <footer className="text-center py-4 text-white/20 text-xs border-t border-white/5">
          CardsAndMore — No account required · Free to play
        </footer>
      </div>
    </>
  );
}
