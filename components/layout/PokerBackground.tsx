export default function PokerBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base felt */}
      <div className="absolute inset-0 felt-texture" />

      {/* Subtle oval table highlight */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="w-[900px] h-[500px] rounded-full opacity-10"
          style={{
            background: 'radial-gradient(ellipse, rgba(201,168,76,0.15) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Corner suit watermarks */}
      <div className="absolute top-6 left-8 text-gold/5 text-8xl select-none pointer-events-none">♠</div>
      <div className="absolute top-6 right-8 text-gold/5 text-8xl select-none pointer-events-none">♥</div>
      <div className="absolute bottom-6 left-8 text-gold/5 text-8xl select-none pointer-events-none">♦</div>
      <div className="absolute bottom-6 right-8 text-gold/5 text-8xl select-none pointer-events-none">♣</div>
    </div>
  );
}
