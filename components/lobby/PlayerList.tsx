'use client';

import type { Player } from '@/types';

interface PlayerListProps {
  players: Player[];
  hostId: string;
  currentPlayerId: string;
}

export default function PlayerList({ players, hostId, currentPlayerId }: PlayerListProps) {
  return (
    <ul className="space-y-2">
      {players.map((player) => {
        const isHost = player.id === hostId;
        const isYou = player.id === currentPlayerId;

        return (
          <li
            key={player.id}
            className={`flex items-center gap-3 rounded-lg px-4 py-2.5
              ${isYou ? 'bg-gold/10 border border-gold/20' : 'bg-felt-light/20 border border-white/5'}
            `}
          >
            {isHost && <span className="text-sm" title="Host">👑</span>}
            <span className={`font-display flex-1 ${isYou ? 'text-gold' : 'text-white'}`}>
              {player.nickname}
              {isYou && <span className="text-white/40 text-xs ml-2">(you)</span>}
            </span>
            {!player.isConnected && (
              <span className="text-xs text-white/30">disconnected</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
