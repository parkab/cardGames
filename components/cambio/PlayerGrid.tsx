'use client';

import CambioCard from './CambioCard';
import type { Card } from '@/types';

export interface HandSlot {
  hasCard: boolean;
  card?: Card;       // only provided for own hand or revealed slots
  revealed?: boolean;
}

interface PlayerGridProps {
  playerId: string;
  nickname: string;
  isHost: boolean;
  isActive: boolean;           // is this player's turn?
  hasCalledCambio: boolean;
  handSlots: HandSlot[];
  isCurrentPlayer: boolean;    // is this the local player?
  selectedStick?: { playerId: string; cardIndex: number } | null;
  onCardClick?: (cardIndex: number) => void;
  size?: 'sm' | 'md';
  score?: number | null;       // shown in game-over state
  isWinner?: boolean;
}

export default function PlayerGrid({
  playerId,
  nickname,
  isHost,
  isActive,
  hasCalledCambio,
  handSlots,
  isCurrentPlayer,
  selectedStick,
  onCardClick,
  size = 'md',
  score = null,
  isWinner = false,
}: PlayerGridProps) {
  return (
    <div className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-colors ${
      isActive
        ? 'border-gold/60 bg-gold/5'
        : isCurrentPlayer
        ? 'border-white/20 bg-white/5'
        : 'border-white/10 bg-black/20'
    } ${isWinner ? 'ring-2 ring-gold/60' : ''}`}>
      {/* Player name */}
      <div className="flex items-center gap-1.5 text-xs">
        {isHost && <span className="text-gold text-[10px]">♛</span>}
        <span className={`font-display tracking-wide ${isCurrentPlayer ? 'text-gold' : 'text-white/70'}`}>
          {nickname}
          {isCurrentPlayer && ' (you)'}
        </span>
        {hasCalledCambio && <span className="text-red-400 text-[10px] border border-red-400/30 rounded px-1">Cambio!</span>}
        {isActive && !hasCalledCambio && <span className="text-gold/60 text-[10px] animate-pulse">●</span>}
      </div>

      {/* Card grid (2×2 + overflow) */}
      <div className="flex flex-wrap gap-1.5 justify-center max-w-[7rem]">
        {handSlots.map((slot, idx) => {
          const isSelected = selectedStick?.playerId === playerId && selectedStick?.cardIndex === idx;
          return (
            <CambioCard
              key={idx}
              card={slot.card}
              revealed={slot.revealed}
              selected={isSelected}
              removed={!slot.hasCard}
              size={size}
              onClick={slot.hasCard && onCardClick ? () => onCardClick(idx) : undefined}
            />
          );
        })}
      </div>

      {/* Score (game-over) */}
      {score !== null && (
        <div className={`text-xs font-mono font-bold ${isWinner ? 'text-gold' : 'text-white/60'}`}>
          {score > 0 ? `+${score}` : score} pts
          {isWinner && ' 👑'}
        </div>
      )}
    </div>
  );
}
