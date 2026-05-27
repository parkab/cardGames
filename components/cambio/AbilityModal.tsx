'use client';

import type { CambioPhase, Card } from '@/types';

interface AbilityModalProps {
  phase: CambioPhase;
  peekedCard?: Card | null;        // shown after peek-own / peek-opponent / queen-peek
  peekSecondsLeft?: number;        // countdown for peek reveal
  targetPlayerId?: string | null;  // for queen-decide: who was peeked
  onSkip?: () => void;             // for jack / queen-decide
  onQueenDecideSwap?: () => void;  // queen-decide: choose to swap
}

const SUIT_SYMBOLS: Record<string, string> = {
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
};
const RED_SUITS = new Set(['hearts', 'diamonds']);

function PeekedCardView({ card, secondsLeft }: { card: Card; secondsLeft?: number }) {
  const isRed = RED_SUITS.has(card.suit);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-20 h-28 rounded-lg border-2 border-white/40 bg-white flex flex-col items-center justify-center gap-1">
        <span className={`text-2xl font-bold leading-none ${isRed ? 'text-red-600' : 'text-gray-900'}`}>{card.rank}</span>
        <span className={`text-2xl leading-none ${isRed ? 'text-red-600' : 'text-gray-900'}`}>{SUIT_SYMBOLS[card.suit]}</span>
      </div>
      {secondsLeft !== undefined && (
        <p className="text-white/40 text-xs">Hiding in {secondsLeft}s…</p>
      )}
    </div>
  );
}

export default function AbilityModal({
  phase,
  peekedCard,
  peekSecondsLeft,
  targetPlayerId,
  onSkip,
  onQueenDecideSwap,
}: AbilityModalProps) {
  const isVisible = [
    'ability-9', 'ability-10', 'ability-jack', 'ability-queen-peek', 'ability-queen-decide',
  ].includes(phase);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4">
      <div className="bg-felt-dark border border-gold/30 rounded-xl p-6 max-w-sm w-full flex flex-col gap-4 shadow-2xl">
        {phase === 'ability-9' && (
          <>
            <h3 className="text-gold font-display text-lg tracking-wide text-center">Peek Your Own Card</h3>
            {peekedCard ? (
              <PeekedCardView card={peekedCard} secondsLeft={peekSecondsLeft} />
            ) : (
              <p className="text-white/60 text-sm text-center">Click one of your face-down cards to peek at it.</p>
            )}
          </>
        )}

        {phase === 'ability-10' && (
          <>
            <h3 className="text-gold font-display text-lg tracking-wide text-center">Peek an Opponent&apos;s Card</h3>
            {peekedCard ? (
              <>
                <PeekedCardView card={peekedCard} secondsLeft={peekSecondsLeft} />
                <p className="text-white/40 text-xs text-center">Remember it!</p>
              </>
            ) : (
              <p className="text-white/60 text-sm text-center">Click one of your opponent&apos;s face-down cards to peek.</p>
            )}
          </>
        )}

        {phase === 'ability-jack' && (
          <>
            <h3 className="text-gold font-display text-lg tracking-wide text-center">Blind Swap</h3>
            <p className="text-white/60 text-sm text-center">
              Click one of your cards, then click an opponent&apos;s card to swap them without looking.
            </p>
            <button
              onClick={onSkip}
              className="text-white/40 text-sm hover:text-white transition-colors text-center"
            >
              Skip (don&apos;t swap)
            </button>
          </>
        )}

        {phase === 'ability-queen-peek' && (
          <>
            <h3 className="text-gold font-display text-lg tracking-wide text-center">Queen: Peek &amp; Swap</h3>
            <p className="text-white/60 text-sm text-center">
              Click one of your opponent&apos;s cards to peek at it. You&apos;ll then choose whether to swap.
            </p>
          </>
        )}

        {phase === 'ability-queen-decide' && (
          <>
            <h3 className="text-gold font-display text-lg tracking-wide text-center">Swap or Skip?</h3>
            {peekedCard && <PeekedCardView card={peekedCard} secondsLeft={peekSecondsLeft} />}
            {peekedCard && (
              <p className="text-white/50 text-xs text-center">
                Click one of your cards to swap with this one, or skip.
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={onQueenDecideSwap}
                className="flex-1 py-2 rounded border border-gold/40 text-gold/80 text-sm hover:bg-gold/10 transition-colors"
              >
                Swap
              </button>
              <button
                onClick={onSkip}
                className="flex-1 py-2 rounded border border-white/20 text-white/50 text-sm hover:bg-white/5 transition-colors"
              >
                Skip
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
