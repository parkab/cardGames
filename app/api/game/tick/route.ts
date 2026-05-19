import { NextRequest, NextResponse } from 'next/server';
import { getRoomState, getGameState, setGameState, setRoomState } from '@/lib/redis';
import { publishToRoom } from '@/lib/ably';
import { canSolve } from '@/lib/solver';
import { shuffleDeck } from '@/lib/deck';
import { DEFAULT_SETTINGS } from '@/types';
import type { RoomState, GameState, RoomSettings } from '@/types';

type SolverSettings = Partial<Pick<RoomSettings, 'modAllowed' | 'fractionsAllowed'>>;

export async function POST(req: NextRequest) {
  try {
    const { roomCode, playerId } = await req.json();

    const [rawRoom, rawGame] = await Promise.all([
      getRoomState(roomCode),
      getGameState(roomCode),
    ]);
    if (!rawRoom || !rawGame) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

    const roomState: RoomState = typeof rawRoom === 'string' ? JSON.parse(rawRoom) : rawRoom as RoomState;
    const gameState: GameState = typeof rawGame === 'string' ? JSON.parse(rawGame) : rawGame as GameState;

    if (gameState.roundStatus !== 'active') {
      return NextResponse.json({ success: false, message: 'Round already ended.' });
    }

    const settings = roomState.settings ?? DEFAULT_SETTINGS;
    const limitMs = settings.timeLimitSeconds * 1000;
    const elapsed = Date.now() - gameState.roundStartedAt;
    if (elapsed < limitMs - 2000) {
      return NextResponse.json({ success: false, message: 'Timer has not expired yet.' });
    }

    const solverSettings: SolverSettings = {
      modAllowed: settings.modAllowed,
      fractionsAllowed: settings.fractionsAllowed,
    };

    gameState.roundStatus = 'timed_out';
    gameState.deck = shuffleDeck([...gameState.deck, ...gameState.currentHand]);

    const d = [...gameState.deck];
    let nextHand = null;
    for (let i = 0; i < 50; i++) {
      if (d.length < settings.cardsPerRound) break;
      const hand = d.slice(0, settings.cardsPerRound);
      if (canSolve(hand, solverSettings)) { nextHand = { hand, remaining: d.slice(settings.cardsPerRound) }; break; }
      d.splice(0, d.length, ...shuffleDeck(d));
    }

    await publishToRoom(roomCode, 'round:timeout', { scores: gameState.scores });

    if (nextHand) {
      const now = Date.now() + 10000;
      gameState.deck = nextHand.remaining;
      gameState.currentHand = nextHand.hand;
      gameState.roundNumber += 1;
      gameState.roundStartedAt = now;
      gameState.roundStatus = 'active';
      gameState.eliminatedThisRound = [];
      gameState.skipVotes = [];
      gameState.winnerId = null;
      await setGameState(roomCode, gameState);
      await publishToRoom(roomCode, 'round:start', {
        roundNumber: gameState.roundNumber,
        cards: gameState.currentHand,
        roundStartedAt: now,
        deckRemaining: gameState.deck.length,
      });
    } else {
      roomState.status = 'finished';
      await setRoomState(roomCode, roomState);
      await setGameState(roomCode, gameState);
      await publishToRoom(roomCode, 'game:over', {
        finalScores: gameState.scores,
        players: roomState.players,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[game/tick]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
