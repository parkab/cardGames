import { NextRequest, NextResponse } from 'next/server';
import { getRoomState, getCambioState } from '@/lib/redis';
import type { RoomState, CambioGameState } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code')?.toUpperCase();
    const playerId = searchParams.get('playerId') ?? '';

    if (!code) return NextResponse.json({ error: 'code required.' }, { status: 400 });

    const [rawRoom, rawCambio] = await Promise.all([
      getRoomState(code),
      getCambioState(code),
    ]);

    if (!rawRoom) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
    if (!rawCambio) return NextResponse.json({ error: 'Game not started.' }, { status: 404 });

    const roomState: RoomState = typeof rawRoom === 'string' ? JSON.parse(rawRoom) : rawRoom as RoomState;
    const cs: CambioGameState = typeof rawCambio === 'string' ? JSON.parse(rawCambio) : rawCambio as CambioGameState;

    // Sanitize: each player only sees their own hand values; opponents see slot count
    const playerData = cs.players.map((p) => {
      const isMe = p.id === playerId;
      return {
        id: p.id,
        nickname: p.nickname,
        isHost: p.isHost,
        isConnected: p.isConnected,
        hasCalledCambio: p.hasCalledCambio,
        // For self: include card values (for initial-peek display); for others: slot presence only
        handSlots: p.hand.map((c) => (c !== null ? (isMe ? c : true) : null)),
        handSize: p.hand.filter(Boolean).length,
      };
    });

    // Include own hand values during initial-peek phase (bottom 2 slots)
    const myPlayer = cs.players.find((p) => p.id === playerId);
    const initialPeekCards = (cs.phase === 'initial-peek' && myPlayer)
      ? [myPlayer.hand[2], myPlayer.hand[3]]
      : null;

    // Drawn card only visible to the player who drew it
    const drawnCard = cs.drawnCardPlayerId === playerId ? cs.drawnCard : null;
    const iAmDrawer = cs.drawnCardPlayerId === playerId;

    return NextResponse.json({
      roomState,
      cambioState: {
        phase: cs.phase,
        currentTurnIndex: cs.currentTurnIndex,
        currentTurnPlayerId: cs.players[cs.currentTurnIndex]?.id ?? null,
        turnStartedAt: cs.turnStartedAt,
        peekUntil: cs.peekUntil,
        deckRemaining: cs.deck.length,
        discardPile: cs.discardPile,
        players: playerData,
        drawnCard,
        iAmDrawer,
        cambioCallerId: cs.cambioCallerId,
        finalTurnsRemaining: cs.finalTurnsRemaining,
        pendingAbilityPhase: cs.pendingAbility?.type ?? null,
        initialPeekCards,
      },
    });
  } catch (err) {
    console.error('[cambio/state]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
