import { NextRequest, NextResponse } from 'next/server';
import { getRoomState, getCambioState, setCambioState } from '@/lib/redis';
import { publishToRoom } from '@/lib/ably';
import { replenishDeck, nextTurnIndex } from '@/lib/cambio';
import type { RoomState, CambioGameState } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { roomCode, playerId } = await req.json();

    const [rawRoom, rawCambio] = await Promise.all([
      getRoomState(roomCode),
      getCambioState(roomCode),
    ]);
    if (!rawRoom || !rawCambio) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

    const roomState: RoomState = typeof rawRoom === 'string' ? JSON.parse(rawRoom) : rawRoom as RoomState;
    const cs: CambioGameState = typeof rawCambio === 'string' ? JSON.parse(rawCambio) : rawCambio as CambioGameState;

    // Only the host sends tick to avoid duplicate processing
    if (roomState.hostId !== playerId) {
      return NextResponse.json({ ignored: true });
    }
    if (cs.phase === 'game-over') {
      return NextResponse.json({ ignored: true });
    }

    // If in ability phase, auto-skip ability
    if (['ability-9', 'ability-10', 'ability-jack', 'ability-queen-peek', 'ability-queen-decide'].includes(cs.phase)) {
      cs.pendingAbility = null;
    }

    // If active player hasn't drawn yet, force draw-and-discard
    if (cs.phase === 'turn-draw' || cs.phase === 'final-round') {
      replenishDeck(cs);
      if (cs.deck.length > 0) {
        const card = cs.deck.shift()!;
        cs.discardPile.push(card);
        // Publish the discard publicly (no ability triggered on timeout)
        const activePlayerId = cs.players[cs.currentTurnIndex].id;
        await publishToRoom(roomCode, 'cambio:card-discarded', {
          playerId: activePlayerId,
          card,
          phase: 'turn-draw',
        });
      }
    }

    // If mid-decide (drew but didn't act), auto-discard the drawn card
    if (cs.phase === 'turn-decide' && cs.drawnCard) {
      cs.discardPile.push(cs.drawnCard);
      cs.drawnCard = null;
      cs.drawnCardPlayerId = null;
    }

    // Advance turn
    const nextIdx = nextTurnIndex(cs.currentTurnIndex, cs.players);
    cs.currentTurnIndex = nextIdx;
    cs.turnStartedAt = Date.now();

    let nextPhase: 'turn-draw' | 'final-round' = 'turn-draw';
    if (cs.cambioCallerId && cs.finalTurnsRemaining > 0) {
      cs.finalTurnsRemaining -= 1;
      if (cs.finalTurnsRemaining === 0) {
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
      cs.phase = 'final-round';
      nextPhase = 'final-round';
    } else {
      cs.phase = 'turn-draw';
    }

    await setCambioState(roomCode, cs);
    await publishToRoom(roomCode, 'cambio:turn-start', {
      currentPlayerId: cs.players[nextIdx].id,
      turnStartedAt: cs.turnStartedAt,
      deckRemaining: cs.deck.length,
      phase: nextPhase,
      finalTurnsRemaining: cs.finalTurnsRemaining,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[cambio/turn-timeout]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
