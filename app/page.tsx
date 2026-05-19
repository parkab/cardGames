import Link from 'next/link';
import PokerBackground from '@/components/layout/PokerBackground';
import Navbar from '@/components/layout/Navbar';

const GAMES = [
  {
    href: '/21',
    number: '21',
    name: 'Make 21',
    description: 'Use +, −, ×, ÷ with 4 cards to reach exactly 21.',
    players: '2–8 players',
    suits: ['♠', '♥', '♦', '♣'],
  },
  // Add more games here as the platform grows
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
              <span className="text-gold">Play</span>
              <span className="text-white">21</span>
            </h1>
            <div className="flex items-center justify-center gap-3 my-3">
              <div className="h-px w-16 bg-gold/30" />
              <span className="text-gold/50 text-lg">♠ ♥ ♦ ♣</span>
              <div className="h-px w-16 bg-gold/30" />
            </div>
            <p className="text-white/50 font-display italic tracking-widest">
              Play. Solve. Win.
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
                    group relative w-56 h-72 rounded-xl gold-border bg-felt-dark
                    hover:scale-105 hover:shadow-2xl hover:shadow-gold/20
                    transition-all duration-300 overflow-hidden
                    flex flex-col items-center justify-center gap-3 p-6
                  "
                >
                  {/* Faint background number */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none select-none">
                    <span className="text-[160px] text-gold font-display font-bold leading-none">{game.number}</span>
                  </div>

                  <div className="relative z-10 flex flex-col items-center gap-2 text-center">
                    <div className="w-14 h-14 rounded-full bg-gold/10 border-2 border-gold flex items-center justify-center">
                      <span className="text-gold text-2xl font-display font-bold">{game.number}</span>
                    </div>
                    <h3 className="text-white text-xl font-display tracking-wide">{game.name}</h3>
                    <p className="text-white/40 text-xs leading-relaxed">{game.description}</p>
                    <div className="flex items-center gap-1 text-gold/50 text-xs mt-1">
                      <span>👥</span>
                      <span>{game.players}</span>
                    </div>
                  </div>

                  {/* Bottom hover bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold scale-x-0 group-hover:scale-x-100 transition-transform" />
                </Link>
              ))}

              {/* Placeholder "coming soon" card */}
              <div className="w-56 h-72 rounded-xl border border-white/5 bg-felt-dark/30 flex flex-col items-center justify-center gap-3 p-6 opacity-40">
                <div className="text-4xl">🎴</div>
                <p className="text-white/40 text-sm text-center">More games coming soon</p>
              </div>
            </div>
          </section>

        </main>

        <footer className="text-center py-4 text-white/20 text-xs border-t border-white/5">
          Play21 — No account required · Free to play
        </footer>
      </div>
    </>
  );
}
