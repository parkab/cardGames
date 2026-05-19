'use client';

interface GameCardProps {
  onClick: () => void;
}

export default function GameCard({ onClick }: GameCardProps) {
  return (
    <button
      onClick={onClick}
      className="
        group relative w-64 h-80 rounded-xl gold-border bg-felt-dark
        hover:scale-105 hover:shadow-2xl hover:shadow-gold/20
        transition-all duration-300 overflow-hidden
        flex flex-col items-center justify-center gap-4 p-6
      "
    >
      {/* Background suit pattern */}
      <div className="absolute inset-0 flex items-center justify-center opacity-5 group-hover:opacity-10 transition-opacity">
        <span className="text-[180px] text-gold select-none">21</span>
      </div>

      {/* Badge */}
      <div className="relative z-10 flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-gold/10 border-2 border-gold flex items-center justify-center">
          <span className="text-gold text-3xl font-display font-bold">21</span>
        </div>
        <h3 className="text-white text-2xl font-display tracking-widest">Make 21</h3>
        <p className="text-white/50 text-sm text-center leading-relaxed">
          Make 21 with 4 cards using +, −, ×, ÷
        </p>
        <div className="flex items-center gap-1.5 text-gold/60 text-xs">
          <span>👥</span>
          <span>2–8 players</span>
        </div>
      </div>

      {/* Bottom hover indicator */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold scale-x-0 group-hover:scale-x-100 transition-transform" />
    </button>
  );
}
