import { NextRequest, NextResponse } from 'next/server';
import { getCambioState, setCambioState } from '@/lib/redis';
import { publishToRoom } from '@/lib/ably';
import type { CambioGameState, Card } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const {
      roomCode,
      stickerId,
      targetPlayerId,
      targetCardIndex,
      // Only for sticking own card onto opponent's discard (opponent stick success transfer)
      transferCardIndex,
    } = await req.json();

    const rawCambio = await getCambioState(roomCode);
    if (!rawCambio) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
    const cs: CambioGameState = typeof rawCambio === 'string' ? JSON.parse(rawCambio) : rawCambio as CambioGameState;

    // Simple mutex check
    if (cs.stickLocked) {
      return NextResponse.json({ error: 'Stick in progress, try again.' }, { status: 409 });
    }
    if (cs.discardPile.length === 0) {
      return NextResponse.json({ error: 'Nothing to stick to.' }, { status: 409 });
    }
    if (['initial-peek', 'game-over'].includes(cs.phase)) {
      return NextResponse.json({ error: 'Cannot stick during this phase.' }, { status: 409 });
    }

    const sticker = cs.players.find((p) => p.id === stickerId);
    const target = cs.players.find((p) => p.id === targetPlayerId);
    if (!sticker || !target) return NextResponse.json({ error: 'Player not found.' }, { status: 404 });

    if (targetCardIndex < 0 || targetCardIndex >= target.hand.length || target.hand[targetCardIndex] === null) {
      return NextResponse.json({ error: 'Invalid target card.' }, { status: 400 });
    }

    const targetCard = target.hand[targetCardIndex] as Card;
    const discardTop = cs.discardPile[cs.discardPile.length - 1];

    cs.stickLocked = true;

    if (targetCard.rank === discardTop.rank) {
      // ─── Stick success ────────────────────────────────────────────────────
      target.hand[targetCardIndex] = null;
      cs.discardPile.push(targetCard);
      cs.stickLocked = false;

      let transferPayload: { transferFromStickerId?: number; transferToTargetIndex?: number } = {};

      const isOpponentStick = stickerId !== targetPlayerId;
      if (isOpponentStick && transferCardIndex !== undefined && transferCardIndex !== null) {
        // Sticker transfers one of their cards to the target's grid
        if (sticker.hand[transferCardIndex] !== null) {
          const transferCard = sticker.hand[transferCardIndex];
          sticker.hand[transferCardIndex] = null;
          // Find first empty slot in target's hand or add new slot
          const emptySlot = target.hand.findIndex((c) => c === null);
          if (emptySlot !== -1) {
            target.hand[emptySlot] = transferCard;
            transferPayload = { transferFromStickerId: transferCardIndex, transferToTargetIndex: emptySlot };
          } else {
            target.hand.push(transferCard);
            transferPayload = { transferFromStickerId: transferCardIndex, transferToTargetIndex: target.hand.length - 1 };
          }
        }
      }

      await setCambioState(roomCode, cs);
      await publishToRoom(roomCode, 'cambio:stick-success', {
        stickerId,
        targetPlayerId,
        cardIndex: targetCardIndex,
        card: targetCard,
        ...transferPayload,
      });
      return NextResponse.json({ success: true, card: targetCard });
    } else {
      // ─── Stick failure — penalty card ────────────────────────────────────
      const penaltyCard = cs.deck.shift();
      if (penaltyCard) {
        sticker.hand.push(penaltyCard);
      }
      cs.stickLocked = false;
      await setCambioState(roomCode, cs);
      await publishToRoom(roomCode, 'cambio:stick-fail', {
        stickerId,
        targetPlayerId,
        cardIndex: targetCardIndex,
        attemptedCard: targetCard,
      });
      return NextResponse.json({ success: false, deckRemaining: cs.deck.length });
    }
  } catch (err) {
    console.error('[cambio/stick]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
