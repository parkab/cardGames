'use client';

import type { Card } from '@/types';
import CambioCard from './CambioCard';

interface DrawnCardDisplayProps {
  card: Card;
  onDiscard: () => void;
  onSwapMode: () => void;
  isSwapMode: boolean;
  disabled?: boolean;
}

export default function DrawnCardDisplay({ card, onDiscard, onSwapMode, isSwapMode, disabled }: DrawnCardDisplayProps) {
  return (
    <div className="flex flex-col items-center gap-3 p-4 rounded-xl border border-gold/30 bg-gold/5">
      <p className="text-gold/60 text-xs tracking-widest uppercase">Drawn Card</p>
      <CambioCard card={card} revealed size="md" />
      <div className="flex gap-2">
        <button
          onClick={onDiscard}
          disabled={disabled || isSwapMode}
          className="text-xs px-3 py-1.5 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Discard
        </button>
        <button
          onClick={onSwapMode}
          disabled={disabled}
          className={`text-xs px-3 py-1.5 rounded border transition-colors ${
            isSwapMode
              ? 'border-gold bg-gold/20 text-gold'
              : 'border-gold/40 text-gold/60 hover:bg-gold/10'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {isSwapMode ? 'Select a card…' : 'Swap with hand'}
        </button>
      </div>
      {isSwapMode && (
        <p className="text-white/40 text-xs text-center">Click one of your face-down cards to swap</p>
      )}
    </div>
  );
}
