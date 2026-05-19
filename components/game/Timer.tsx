'use client';

interface TimerProps {
  secondsRemaining: number;
  limitSeconds?: number;
}

export default function Timer({ secondsRemaining, limitSeconds = 60 }: TimerProps) {
  const clamped = Math.max(0, Math.ceil(secondsRemaining));
  const pct = clamped / limitSeconds;

  const color =
    clamped > 30 ? 'text-green-400' :
    clamped > 15 ? 'text-yellow-400' :
    'text-red-400';

  const borderColor =
    clamped > 30 ? 'border-green-400' :
    clamped > 15 ? 'border-yellow-400' :
    'border-red-400';

  const mm = String(Math.floor(clamped / 60)).padStart(2, '0');
  const ss = String(clamped % 60).padStart(2, '0');

  // SVG ring
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const dash = circ * pct;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-20 h-20">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 72 72">
          {/* Track */}
          <circle cx="36" cy="36" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
          {/* Progress */}
          <circle
            cx="36" cy="36" r={radius}
            fill="none"
            stroke={clamped > 30 ? '#4ade80' : clamped > 15 ? '#facc15' : '#f87171'}
            strokeWidth="5"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s linear, stroke 0.5s' }}
          />
        </svg>
        <div className={`absolute inset-0 flex items-center justify-center font-mono font-bold text-lg ${color}`}>
          {mm}:{ss}
        </div>
      </div>
    </div>
  );
}
