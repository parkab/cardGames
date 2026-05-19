'use client';

import type { Player } from '@/types';

interface ScoreboardProps {
  players: Player[];
  scores: Record<string, number>;
  eliminatedThisRound: string[];
  currentPlayerId: string;
}

export default function Scoreboard({ players, scores, eliminatedThisRound, currentPlayerId }: ScoreboardProps) {
  const sorted = [...players].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));

  return (
    <div className="gold-border rounded-lg p-4 bg-felt-dark/80">
      <h3 className="text-gold text-sm font-display tracking-widest mb-3 uppercase">Scoreboard</h3>
      <ul className="space-y-2">
        {sorted.map((player, i) => {
          const isElim = eliminatedThisRound.includes(player.id);
          const isYou = player.id === currentPlayerId;

          return (
            <li
              key={player.id}
              className={`flex items-center justify-between rounded px-3 py-1.5 text-sm
                ${isElim ? 'opacity-40 line-through' : ''}
                ${isYou ? 'bg-gold/10 border border-gold/20' : ''}
              `}
            >
              <div className="flex items-center gap-2">
                <span className="text-white/40 w-4 text-xs">{i + 1}</span>
                <span className={isYou ? 'text-gold' : 'text-white'}>
                  {player.nickname}{isYou ? ' (you)' : ''}
                </span>
                {player.isHost && <span className="text-[10px] text-gold/60">👑</span>}
                {isElim && <span className="text-[10px] text-red-400 ml-1">out</span>}
                {!player.isConnected && <span className="text-[10px] text-white/30 ml-1">•dc</span>}
              </div>
              <span className="text-gold font-bold">{scores[player.id] ?? 0}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
