'use client';

import type { Card } from '@/types';
import { getCambioPoints } from '@/lib/cambio';

interface CambioCardProps {
  card?: Card | null;        // actual card value (only shown when revealed)
  revealed?: boolean;        // whether to show face-up
  selected?: boolean;        // highlighted for stick selection
  removed?: boolean;         // slot is empty (card was stuck/discarded)
  onClick?: () => void;
  size?: 'sm' | 'md';
}

const SUIT_SYMBOLS: Record<string, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};
const RED_SUITS = new Set(['hearts', 'diamonds']);

export default function CambioCard({ card, revealed, selected, removed, onClick, size = 'md' }: CambioCardProps) {
  if (removed) {
    return (
      <div className={`${size === 'sm' ? 'w-10 h-14' : 'w-14 h-20'} rounded border border-white/5 bg-black/10`} />
    );
  }

  const isRed = card && RED_SUITS.has(card.suit);
  const pts = card ? getCambioPoints(card.rank) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`
        ${size === 'sm' ? 'w-10 h-14' : 'w-14 h-20'}
        rounded border-2 transition-all duration-200
        flex flex-col items-center justify-center gap-0.5
        ${selected
          ? 'border-gold bg-gold/20 shadow-lg shadow-gold/30 scale-105'
          : revealed
          ? 'border-white/40 bg-white text-black'
          : 'border-gold/30 bg-felt-dark hover:border-gold/60 cursor-pointer'}
        ${!onClick ? 'cursor-default' : ''}
      `}
    >
      {revealed && card ? (
        <>
          <span className={`${size === 'sm' ? 'text-xs' : 'text-sm'} font-bold leading-none ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
            {card.rank}
          </span>
          <span className={`${size === 'sm' ? 'text-xs' : 'text-base'} leading-none ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
            {SUIT_SYMBOLS[card.suit]}
          </span>
          {pts !== null && (
            <span className={`text-[8px] leading-none font-mono ${pts <= 0 ? 'text-green-600' : pts >= 10 ? 'text-red-600' : 'text-gray-500'}`}>
              {pts > 0 ? `+${pts}` : pts}
            </span>
          )}
        </>
      ) : (
        <span className="text-gold/20 text-lg select-none">🂠</span>
      )}
    </button>
  );
}
