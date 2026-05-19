'use client';

import type { Player } from '@/types';
import Button from '@/components/ui/Button';

interface GameOverScreenProps {
  players: Player[];
  finalScores: Record<string, number>;
  currentPlayerId: string;
  isHost: boolean;
  onPlayAgain: () => void;
  onGoHome: () => void;
}

export default function GameOverScreen({
  players,
  finalScores,
  currentPlayerId,
  isHost,
  onPlayAgain,
  onGoHome,
}: GameOverScreenProps) {
  const sorted = [...players].sort((a, b) => (finalScores[b.id] ?? 0) - (finalScores[a.id] ?? 0));
  const topScore = finalScores[sorted[0]?.id] ?? 0;
  const winners = sorted.filter((p) => (finalScores[p.id] ?? 0) === topScore);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 animate-fade-in">
      <h1 className="text-5xl font-display text-gold mb-2 tracking-widest">Game Over</h1>
      <p className="text-white/50 mb-8">
        {winners.length === 1
          ? `${winners[0].nickname} wins! 🏆`
          : `It's a tie! ${winners.map((w) => w.nickname).join(' & ')} 🏆`}
      </p>

      <div className="w-full max-w-sm gold-border rounded-xl p-6 bg-felt-dark/80 mb-8">
        <h2 className="text-gold text-sm tracking-widest uppercase mb-4">Final Scores</h2>
        <ul className="space-y-3">
          {sorted.map((player, i) => {
            const isWinner = winners.some((w) => w.id === player.id);
            const isYou = player.id === currentPlayerId;

            return (
              <li
                key={player.id}
                className={`flex items-center justify-between rounded-lg px-3 py-2
                  ${isWinner ? 'bg-gold/10 border border-gold/30' : ''}
                  ${isYou && !isWinner ? 'bg-white/5' : ''}
                `}
              >
                <div className="flex items-center gap-2">
                  <span className="text-white/40 w-5 text-sm">{i + 1}.</span>
                  {isWinner && <span className="text-sm">🏆</span>}
                  <span className={isWinner ? 'text-gold font-bold' : isYou ? 'text-white' : 'text-white/70'}>
                    {player.nickname}{isYou ? ' (you)' : ''}
                  </span>
                </div>
                <span className={`font-bold font-mono ${isWinner ? 'text-gold' : 'text-white/70'}`}>
                  {finalScores[player.id] ?? 0} pts
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col items-center gap-3">
        {isHost ? (
          <Button size="lg" onClick={onPlayAgain}>
            Play Again
          </Button>
        ) : (
          <p className="text-white/40 text-sm">Waiting for host to start a new game…</p>
        )}
        <button
          onClick={onGoHome}
          className="text-white/40 text-sm hover:text-white transition-colors"
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
}
