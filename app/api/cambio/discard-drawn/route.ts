import { NextRequest, NextResponse } from 'next/server';
import { getCambioState, setCambioState } from '@/lib/redis';
import { publishToRoom } from '@/lib/ably';
import { getCambioAbility, nextTurnIndex } from '@/lib/cambio';
import type { CambioGameState, CambioPhase } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { roomCode, playerId } = await req.json();

    const rawCambio = await getCambioState(roomCode);
    if (!rawCambio) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
    const cs: CambioGameState = typeof rawCambio === 'string' ? JSON.parse(rawCambio) : rawCambio as CambioGameState;

    if (cs.players[cs.currentTurnIndex].id !== playerId) {
      return NextResponse.json({ error: 'Not your turn.' }, { status: 403 });
    }
    if (cs.phase !== 'turn-decide') {
      return NextResponse.json({ error: 'No card to discard.' }, { status: 409 });
    }

    const card = cs.drawnCard!;
    cs.discardPile.push(card);
    cs.drawnCard = null;
    cs.drawnCardPlayerId = null;

    const ability = getCambioAbility(card.rank);
    let nextPhase: CambioPhase;

    if (ability) {
      // Enter ability phase
      cs.pendingAbility = { type: ability, playerId };
      nextPhase = ability === 'peek-own' ? 'ability-9'
        : ability === 'peek-opponent' ? 'ability-10'
        : ability === 'blind-swap' ? 'ability-jack'
        : 'ability-queen-peek';
    } else {
      // No ability — advance to next player
      const nextIdx = nextTurnIndex(cs.currentTurnIndex, cs.players);
      cs.currentTurnIndex = nextIdx;
      cs.turnStartedAt = Date.now();

      // Check if final-round is complete
      if (cs.cambioCallerId && cs.finalTurnsRemaining > 0) {
        cs.finalTurnsRemaining -= 1;
        if (cs.finalTurnsRemaining === 0) {
          return triggerGameOver(cs, roomCode);
        }
        cs.phase = 'final-round';
        nextPhase = 'final-round';
      } else {
        cs.phase = cs.cambioCallerId ? 'final-round' : 'turn-draw';
        nextPhase = cs.phase;
      }

      await setCambioState(roomCode, cs);
      await publishToRoom(roomCode, 'cambio:card-discarded', { playerId, card, phase: nextPhase });
      await publishToRoom(roomCode, 'cambio:turn-start', {
        currentPlayerId: cs.players[cs.currentTurnIndex].id,
        turnStartedAt: cs.turnStartedAt,
        deckRemaining: cs.deck.length,
        phase: nextPhase,
        finalTurnsRemaining: cs.finalTurnsRemaining,
      });
      return NextResponse.json({ success: true, phase: nextPhase });
    }

    cs.phase = nextPhase;
    await setCambioState(roomCode, cs);
    await publishToRoom(roomCode, 'cambio:card-discarded', { playerId, card, phase: nextPhase });
    await publishToRoom(roomCode, 'cambio:ability-prompt', { phase: nextPhase, playerId });
    return NextResponse.json({ success: true, phase: nextPhase });
  } catch (err) {
    console.error('[cambio/discard-drawn]', err);
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
