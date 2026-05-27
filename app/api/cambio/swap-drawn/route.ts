import { NextRequest, NextResponse } from 'next/server';
import { getCambioState, setCambioState } from '@/lib/redis';
import { publishToRoom } from '@/lib/ably';
import { nextTurnIndex } from '@/lib/cambio';
import type { CambioGameState } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { roomCode, playerId, cardIndex } = await req.json();

    const rawCambio = await getCambioState(roomCode);
    if (!rawCambio) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
    const cs: CambioGameState = typeof rawCambio === 'string' ? JSON.parse(rawCambio) : rawCambio as CambioGameState;

    if (cs.players[cs.currentTurnIndex].id !== playerId) {
      return NextResponse.json({ error: 'Not your turn.' }, { status: 403 });
    }
    if (cs.phase !== 'turn-decide') {
      return NextResponse.json({ error: 'No card to swap.' }, { status: 409 });
    }

    const myPlayer = cs.players.find((p) => p.id === playerId)!;
    if (cardIndex < 0 || cardIndex >= myPlayer.hand.length || myPlayer.hand[cardIndex] === null) {
      return NextResponse.json({ error: 'Invalid card index.' }, { status: 400 });
    }

    const displaced = myPlayer.hand[cardIndex]!;
    myPlayer.hand[cardIndex] = cs.drawnCard;
    cs.discardPile.push(displaced);
    cs.drawnCard = null;
    cs.drawnCardPlayerId = null;

    // Advance turn (no ability triggered)
    const nextIdx = nextTurnIndex(cs.currentTurnIndex, cs.players);
    cs.currentTurnIndex = nextIdx;
    cs.turnStartedAt = Date.now();

    let nextPhase: 'turn-draw' | 'final-round' = 'turn-draw';
    if (cs.cambioCallerId && cs.finalTurnsRemaining > 0) {
      cs.finalTurnsRemaining -= 1;
      if (cs.finalTurnsRemaining === 0) {
        return triggerGameOver(cs, roomCode);
      }
      cs.phase = 'final-round';
      nextPhase = 'final-round';
    } else {
      cs.phase = 'turn-draw';
    }

    await setCambioState(roomCode, cs);
    await publishToRoom(roomCode, 'cambio:swap-completed', {
      playerId,
      swappedOutCardIndex: cardIndex,
      discardedCard: displaced,
      deckRemaining: cs.deck.length,
    });
    await publishToRoom(roomCode, 'cambio:turn-start', {
      currentPlayerId: cs.players[cs.currentTurnIndex].id,
      turnStartedAt: cs.turnStartedAt,
      deckRemaining: cs.deck.length,
      phase: nextPhase,
      finalTurnsRemaining: cs.finalTurnsRemaining,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[cambio/swap-drawn]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

async function triggerGameOver(cs: CambioGameState, roomCode: string) {
  const { computeScores, determineWinners } = await import('@/lib/cambio');
  const scores = computeScores(cs.players);
  const winnerIds = determineWinners(cs.players, scores, cs.cambioCallerId);
  cs.phase = 'game-over';
  const finalHands: Record<string, typeof cs.players[0]['hand']> = {};
  cs.players.forEach((p) => { finalHands[p.id] = p.hand; });
  await setCambioState(roomCode, cs);
  await publishToRoom(roomCode, 'cambio:game-over', {
    finalHands, scores, winnerIds, callerId: cs.cambioCallerId, players: cs.players,
  });
  return NextResponse.json({ success: true, gameOver: true });
}
