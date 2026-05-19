import { NextRequest, NextResponse } from 'next/server';
import { getRoomState, setRoomState, setGameState } from '@/lib/redis';
import { publishToRoom } from '@/lib/ably';
import { createDeck, shuffleDeck } from '@/lib/deck';
import { canSolve } from '@/lib/solver';
import { DEFAULT_SETTINGS } from '@/types';
import type { RoomState, GameState, Card, RoomSettings } from '@/types';

type SolverSettings = Partial<Pick<RoomSettings, 'modAllowed' | 'fractionsAllowed' | 'targetNumber'>>;

function dealSolvableHand(
  deck: Card[],
  cardsPerRound: number,
  solverSettings: SolverSettings
): { hand: Card[]; remaining: Card[] } | null {
  const d = [...deck];
  for (let attempt = 0; attempt < 100; attempt++) {
    if (d.length < cardsPerRound) return null;
    const hand = d.slice(0, cardsPerRound);
    if (canSolve(hand, solverSettings)) {
      return { hand, remaining: d.slice(cardsPerRound) };
    }
    const reshuffled = shuffleDeck(d);
    d.splice(0, d.length, ...reshuffled);
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { roomCode, playerId } = await req.json();
    const raw = await getRoomState(roomCode);
    if (!raw) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

    const roomState: RoomState = typeof raw === 'string' ? JSON.parse(raw) : raw as RoomState;

    if (roomState.hostId !== playerId) {
      return NextResponse.json({ error: 'Only the host can start the game.' }, { status: 403 });
    }
    if (roomState.players.length < 2) {
      return NextResponse.json({ error: 'Need at least 2 players to start.' }, { status: 400 });
    }

    const settings = roomState.settings ?? DEFAULT_SETTINGS;
    const solverSettings: SolverSettings = {
      modAllowed: settings.modAllowed,
      fractionsAllowed: settings.fractionsAllowed,
      targetNumber: settings.targetNumber ?? 21,
    };

    const shuffled = shuffleDeck(createDeck());
    const dealt = dealSolvableHand(shuffled, settings.cardsPerRound, solverSettings);
    if (!dealt) {
      return NextResponse.json({ error: 'Could not deal a solvable hand.' }, { status: 500 });
    }

    const scores: Record<string, number> = {};
    for (const p of roomState.players) scores[p.id] = 0;

    const now = Date.now();
    const gameState: GameState = {
      deck: settings.infiniteMode ? [] : dealt.remaining,
      discardPile: [],
      currentHand: dealt.hand,
      roundNumber: 1,
      roundStartedAt: now,
      roundStatus: 'active',
      eliminatedThisRound: [],
      skipVotes: [],
      winnerId: null,
      scores,
    };

    roomState.status = 'playing';
    await setRoomState(roomCode, roomState);
    await setGameState(roomCode, gameState);

    await publishToRoom(roomCode, 'game:started', { gameState });
    await publishToRoom(roomCode, 'round:start', {
      roundNumber: gameState.roundNumber,
      cards: gameState.currentHand,
      roundStartedAt: now,
      deckRemaining: settings.infiniteMode ? -1 : gameState.deck.length,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[game/start]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
