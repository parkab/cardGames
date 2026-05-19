'use client';

import type { Card } from '@/types';

interface CardDisplayProps {
  cards: Card[];
}

const SUIT_SYMBOLS: Record<string, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const RED_SUITS = new Set(['hearts', 'diamonds']);

function getDisplayValue(card: Card): string {
  if (Array.isArray(card.value)) return 'A';
  return card.rank;
}

function getSubLabel(card: Card): string | null {
  if (Array.isArray(card.value)) return '1 / 11';
  return null;
}

export default function CardDisplay({ cards }: CardDisplayProps) {
  return (
    <div className="flex gap-4 md:gap-6 justify-center flex-wrap">
      {cards.map((card, i) => {
        const isRed = RED_SUITS.has(card.suit);
        const symbol = SUIT_SYMBOLS[card.suit];
        const display = getDisplayValue(card);
        const sub = getSubLabel(card);

        return (
          <div
            key={`${card.rank}-${card.suit}-${i}`}
            className="playing-card bg-white w-24 h-36 md:w-28 md:h-40 flex flex-col relative select-none"
            style={{
              animationDelay: `${i * 80}ms`,
              animation: 'dealIn 0.4s ease-out both',
            }}
          >
            {/* Top-left rank + suit */}
            <div className={`absolute top-2 left-2.5 flex flex-col items-center leading-none ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
              <span className="text-lg font-bold">{display}</span>
              <span className="text-sm">{symbol}</span>
            </div>

            {/* Center suit */}
            <div className={`flex-1 flex items-center justify-center text-4xl ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
              {symbol}
            </div>

            {/* Ace label */}
            {sub && (
              <div className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-gray-500 font-mono">
                {sub}
              </div>
            )}

            {/* Bottom-right (inverted) */}
            <div className={`absolute bottom-2 right-2.5 flex flex-col items-center leading-none rotate-180 ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
              <span className="text-lg font-bold">{display}</span>
              <span className="text-sm">{symbol}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
