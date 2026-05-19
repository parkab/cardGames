'use client';

import { useState, useEffect } from 'react';

interface SolutionsPanelProps {
  solutions: string[];
  onHide: () => void;
  durationSeconds?: number;
  targetNumber?: number;
  winningExpression?: string | null;
}

export default function SolutionsPanel({ solutions, onHide, durationSeconds = 10, targetNumber = 21, winningExpression }: SolutionsPanelProps) {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);

  useEffect(() => {
    setTimeLeft(durationSeconds);
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { onHide(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [durationSeconds, onHide]);

  const displayed = solutions.slice(0, 40);

  return (
    <div className="mx-4 mt-3 rounded-xl border border-gold/20 bg-felt-dark/90 p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-gold/80 text-xs font-display tracking-widest uppercase">
          {solutions.length === 0 ? 'No solutions existed' : `Valid solutions (${solutions.length})`}
        </h3>
        <span className="text-white/30 text-xs font-mono tabular-nums">{timeLeft}s</span>
      </div>
      {winningExpression && (
        <div className="mb-3 pb-3 border-b border-gold/20">
          <p className="text-white/40 text-[10px] tracking-widest uppercase mb-1.5">Winner&apos;s solution</p>
          <span className="font-mono text-sm bg-gold/10 border border-gold/30 text-gold rounded px-2 py-1">
            {winningExpression} = {targetNumber}
          </span>
        </div>
      )}
      {solutions.length === 0 ? (
        <p className="text-white/40 text-xs">This hand had no valid solutions — well played for skipping!</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {displayed.map((sol, i) => (
              <span
                key={i}
                className="font-mono text-[11px] bg-black/40 border border-white/10 rounded px-2 py-1 text-white/60"
              >
                {sol} = {targetNumber}
              </span>
            ))}
          </div>
          {solutions.length > 40 && (
            <p className="text-white/30 text-xs mt-2">…and {solutions.length - 40} more</p>
          )}
        </>
      )}
    </div>
  );
}
