'use client';

import type { Card } from '@/types';
import { getCambioPoints } from '@/lib/cambio';
import PlayerGrid from './PlayerGrid';
import type { HandSlot } from './PlayerGrid';

interface CambioGameOverScreenProps {
  finalHands: Record<string, (Card | null)[]>;
  scores: Record<string, number>;
  winnerIds: string[];
  callerId: string | null;
  players: Array<{ id: string; nickname: string; isHost: boolean; isConnected: boolean }>;
  currentPlayerId: string;
  isHost: boolean;
  onPlayAgain: () => void;
  onGoHome: () => void;
}

export default function CambioGameOverScreen({
  finalHands,
  scores,
  winnerIds,
  callerId,
  players,
  currentPlayerId,
  isHost,
  onPlayAgain,
  onGoHome,
}: CambioGameOverScreenProps) {
  const sorted = [...players].sort((a, b) => (scores[a.id] ?? 0) - (scores[b.id] ?? 0));

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 gap-8">
      <div className="text-center">
        <h2 className="text-5xl font-display text-gold tracking-widest mb-2">Game Over</h2>
        <p className="text-white/40 text-sm">
          {callerId
            ? `${players.find((p) => p.id === callerId)?.nickname ?? 'Someone'} called Cambio`
            : 'Deck ran out'}
        </p>
      </div>

      {/* Winner announcement */}
      <div className="text-center">
        {winnerIds.length === 1 ? (
          <p className="text-white text-xl font-display">
            <span className="text-gold">
              {players.find((p) => p.id === winnerIds[0])?.nickname ?? ''}
            </span> wins with {scores[winnerIds[0]]} pts!
          </p>
        ) : (
          <p className="text-white text-xl font-display">
            Tie! {winnerIds.map((id) => players.find((p) => p.id === id)?.nickname ?? '').join(' & ')} win!
          </p>
        )}
      </div>

      {/* Player hands revealed */}
      <div className="flex flex-wrap gap-4 justify-center max-w-3xl">
        {sorted.map((player) => {
          const hand = finalHands[player.id] ?? [];
          const slots: HandSlot[] = hand.map((c) => ({
            hasCard: c !== null,
            card: c ?? undefined,
            revealed: c !== null,
          }));
          return (
            <PlayerGrid
              key={player.id}
              playerId={player.id}
              nickname={player.nickname}
              isHost={player.isHost}
              isActive={false}
              hasCalledCambio={player.id === callerId}
              handSlots={slots}
              isCurrentPlayer={player.id === currentPlayerId}
              size="sm"
              score={scores[player.id] ?? 0}
              isWinner={winnerIds.includes(player.id)}
            />
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 items-center">
        {isHost && (
          <button
            onClick={onPlayAgain}
            className="bg-gold hover:bg-gold/80 text-felt-dark font-bold text-lg px-10 py-3 rounded-md tracking-widest transition-colors"
          >
            Play Again
          </button>
        )}
        <button
          onClick={onGoHome}
          className="text-white/40 hover:text-white text-sm transition-colors"
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
}
