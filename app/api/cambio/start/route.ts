import { NextRequest, NextResponse } from 'next/server';
import { getRoomState, setRoomState, setCambioState } from '@/lib/redis';
import { publishToRoom } from '@/lib/ably';
import { dealCambio, firstPlayerIndex } from '@/lib/cambio';
import type { RoomState, CambioGameState } from '@/types';

const PEEK_DURATION = 10_000; // 10 seconds

export async function POST(req: NextRequest) {
  try {
    const { roomCode, playerId } = await req.json();

    const raw = await getRoomState(roomCode);
    if (!raw) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
    const roomState: RoomState = typeof raw === 'string' ? JSON.parse(raw) : raw as RoomState;

    if (roomState.hostId !== playerId) {
      return NextResponse.json({ error: 'Only the host can start the game.' }, { status: 403 });
    }
    if (roomState.status !== 'lobby') {
      return NextResponse.json({ error: 'Game already in progress.' }, { status: 409 });
    }
    if (roomState.players.length < 2) {
      return NextResponse.json({ error: 'Need at least 2 players to start.' }, { status: 409 });
    }

    const { deck, serverPlayers } = dealCambio(
      roomState.players.map((p) => p.id),
      roomState.players
    );

    const peekUntil = Date.now() + PEEK_DURATION;
    const firstIdx = firstPlayerIndex(serverPlayers, roomState.hostId);
    const turnStartedAt = peekUntil; // first turn starts after peek

    const cambioState: CambioGameState = {
      deck,
      discardPile: [],
      players: serverPlayers,
      currentTurnIndex: firstIdx,
      turnStartedAt,
      peekUntil,
      phase: 'initial-peek',
      drawnCard: null,
      drawnCardPlayerId: null,
      cambioCallerId: null,
      finalTurnsRemaining: 0,
      pendingAbility: null,
      stickLocked: false,
    };

    roomState.status = 'playing';
    await setCambioState(roomCode, cambioState);
    await setRoomState(roomCode, roomState);

    const firstPlayerId = serverPlayers[firstIdx].id;

    await publishToRoom(roomCode, 'cambio:started', {
      playerOrder: serverPlayers.map((p) => p.id),
      peekUntil,
      firstTurnPlayerId: firstPlayerId,
      turnStartedAt,
      deckRemaining: deck.length,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[cambio/start]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
