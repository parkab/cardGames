'use client';

interface HeroSectionProps {
  onPlayClick: () => void;
}

export default function HeroSection({ onPlayClick }: HeroSectionProps) {
  return (
    <section className="flex flex-col items-center justify-center text-center py-20 px-4">
      {/* Logo */}
      <h1 className="text-7xl md:text-8xl font-display tracking-widest mb-3">
        <span className="text-gold">Play</span>
        <span className="text-white">21</span>
      </h1>

      {/* Decorative divider */}
      <div className="flex items-center gap-3 my-4">
        <div className="h-px w-20 bg-gold/30" />
        <span className="text-gold/60 text-xl">♠ ♥ ♦ ♣</span>
        <div className="h-px w-20 bg-gold/30" />
      </div>

      {/* Tagline */}
      <p className="text-white/60 text-xl font-display tracking-widest italic mb-10">
        Play. Solve. Win.
      </p>

      {/* CTA */}
      <button
        onClick={onPlayClick}
        className="group relative overflow-hidden bg-gold hover:bg-gold-light text-felt-dark font-bold text-xl px-10 py-4 rounded-md tracking-widest transition-all duration-200 shadow-lg hover:shadow-gold/30"
      >
        Play Now
      </button>
    </section>
  );
}
