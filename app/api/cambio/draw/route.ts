import { NextRequest, NextResponse } from 'next/server';
import { getRoomState, getCambioState, setCambioState } from '@/lib/redis';
import { publishToRoom } from '@/lib/ably';
import { replenishDeck } from '@/lib/cambio';
import type { RoomState, CambioGameState } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { roomCode, playerId } = await req.json();

    const [rawRoom, rawCambio] = await Promise.all([
      getRoomState(roomCode),
      getCambioState(roomCode),
    ]);
    if (!rawRoom || !rawCambio) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

    const cs: CambioGameState = typeof rawCambio === 'string' ? JSON.parse(rawCambio) : rawCambio as CambioGameState;
    const activePlayer = cs.players[cs.currentTurnIndex];

    if (activePlayer.id !== playerId) {
      return NextResponse.json({ error: 'Not your turn.' }, { status: 403 });
    }
    if (cs.phase !== 'turn-draw' && cs.phase !== 'final-round') {
      return NextResponse.json({ error: 'Cannot draw now.' }, { status: 409 });
    }

    replenishDeck(cs);

    if (cs.deck.length === 0) {
      // Deck exhausted — trigger immediate game over
      const { computeScores, determineWinners } = await import('@/lib/cambio');
      const scores = computeScores(cs.players);
      const winnerIds = determineWinners(cs.players, scores, cs.cambioCallerId);
      cs.phase = 'game-over';
      const finalHands: Record<string, typeof cs.players[0]['hand']> = {};
      cs.players.forEach((p) => { finalHands[p.id] = p.hand; });
      await setCambioState(roomCode, cs);
      await publishToRoom(roomCode, 'cambio:game-over', {
        finalHands,
        scores,
        winnerIds,
        callerId: cs.cambioCallerId,
        players: cs.players,
      });
      return NextResponse.json({ deckEmpty: true });
    }

    const card = cs.deck.shift()!;
    cs.drawnCard = card;
    cs.drawnCardPlayerId = playerId;
    cs.phase = 'turn-decide';

    await setCambioState(roomCode, cs);
    await publishToRoom(roomCode, 'cambio:card-drawn-public', {
      playerId,
      deckRemaining: cs.deck.length,
    });

    // Return card value only to the drawing player (via HTTP response)
    return NextResponse.json({ card, deckRemaining: cs.deck.length });
  } catch (err) {
    console.error('[cambio/draw]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
