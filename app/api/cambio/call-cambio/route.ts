import { NextRequest, NextResponse } from 'next/server';
import { getCambioState, setCambioState } from '@/lib/redis';
import { publishToRoom } from '@/lib/ably';
import { nextTurnIndex } from '@/lib/cambio';
import type { CambioGameState } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { roomCode, playerId } = await req.json();

    const rawCambio = await getCambioState(roomCode);
    if (!rawCambio) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
    const cs: CambioGameState = typeof rawCambio === 'string' ? JSON.parse(rawCambio) : rawCambio as CambioGameState;

    if (cs.players[cs.currentTurnIndex].id !== playerId) {
      return NextResponse.json({ error: 'Not your turn.' }, { status: 403 });
    }
    if (cs.phase !== 'turn-draw' && cs.phase !== 'final-round') {
      return NextResponse.json({ error: 'Cannot call Cambio now.' }, { status: 409 });
    }
    if (cs.discardPile.length === 0) {
      return NextResponse.json({ error: 'Discard pile must be non-empty to call Cambio.' }, { status: 409 });
    }
    if (cs.cambioCallerId) {
      return NextResponse.json({ error: 'Cambio already called.' }, { status: 409 });
    }

    cs.cambioCallerId = playerId;
    const connectedOthers = cs.players.filter((p) => p.id !== playerId && p.isConnected).length;
    cs.finalTurnsRemaining = connectedOthers;

    // Advance to next player for final round
    const nextIdx = nextTurnIndex(cs.currentTurnIndex, cs.players);
    cs.currentTurnIndex = nextIdx;
    cs.turnStartedAt = Date.now();
    cs.phase = 'final-round';

    if (connectedOthers === 0) {
      // Solo play or everyone else disconnected — game over immediately
      const { computeScores, determineWinners } = await import('@/lib/cambio');
      const scores = computeScores(cs.players);
      const winnerIds = determineWinners(cs.players, scores, cs.cambioCallerId);
      cs.phase = 'game-over';
      const finalHands: Record<string, typeof cs.players[0]['hand']> = {};
      cs.players.forEach((p) => { finalHands[p.id] = p.hand; });
      await setCambioState(roomCode, cs);
      await publishToRoom(roomCode, 'cambio:cambio-called', { callerId: playerId, finalTurnsRemaining: 0 });
      await publishToRoom(roomCode, 'cambio:game-over', {
        finalHands, scores, winnerIds, callerId: cs.cambioCallerId, players: cs.players,
      });
      return NextResponse.json({ success: true, gameOver: true });
    }

    await setCambioState(roomCode, cs);
    await publishToRoom(roomCode, 'cambio:cambio-called', {
      callerId: playerId,
      finalTurnsRemaining: connectedOthers,
    });
    await publishToRoom(roomCode, 'cambio:turn-start', {
      currentPlayerId: cs.players[nextIdx].id,
      turnStartedAt: cs.turnStartedAt,
      deckRemaining: cs.deck.length,
      phase: 'final-round',
      finalTurnsRemaining: cs.finalTurnsRemaining,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[cambio/call-cambio]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
