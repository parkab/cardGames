import { NextRequest, NextResponse } from 'next/server';
import { getRoomState, getGameState, setGameState } from '@/lib/redis';
import { publishToRoom } from '@/lib/ably';
import { canSolve } from '@/lib/solver';
import { createDeck, shuffleDeck } from '@/lib/deck';
import { DEFAULT_SETTINGS } from '@/types';
import type { RoomState, GameState, RoomSettings } from '@/types';

type SolverSettings = Partial<Pick<RoomSettings, 'modAllowed' | 'fractionsAllowed' | 'targetNumber'>>;

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
      return NextResponse.json({ error: 'Round is not active.' }, { status: 400 });
    }
    if (gameState.eliminatedThisRound.includes(playerId)) {
      return NextResponse.json({ error: 'Eliminated players cannot vote.' }, { status: 403 });
    }
    if (!gameState.skipVotes.includes(playerId)) {
      gameState.skipVotes.push(playerId);
    }

    const activePlayers = roomState.players.filter(
      (p) => p.isConnected && !gameState.eliminatedThisRound.includes(p.id)
    );
    const required = activePlayers.length;

    await publishToRoom(roomCode, 'skip:vote_update', {
      skipVotes: gameState.skipVotes,
      required,
    });

    if (gameState.skipVotes.length >= required) {
      const settings = roomState.settings ?? DEFAULT_SETTINGS;
      const solverSettings: SolverSettings = {
        modAllowed: settings.modAllowed,
        fractionsAllowed: settings.fractionsAllowed,
        targetNumber: settings.targetNumber ?? 21,
      };

      gameState.roundStatus = 'skipped';
      if (!settings.infiniteMode) {
        gameState.deck = shuffleDeck([...gameState.deck, ...gameState.currentHand]);
      }

      const deckSource = settings.infiniteMode ? shuffleDeck(createDeck()) : [...gameState.deck];
      const d = [...deckSource];
      let nextHand = null;
      for (let i = 0; i < 50; i++) {
        if (d.length < settings.cardsPerRound) break;
        const hand = d.slice(0, settings.cardsPerRound);
        if (canSolve(hand, solverSettings)) { nextHand = { hand, remaining: d.slice(settings.cardsPerRound) }; break; }
        d.splice(0, d.length, ...shuffleDeck(d));
      }

      await publishToRoom(roomCode, 'round:skipped', { scores: gameState.scores });

      if (nextHand) {
        const now = Date.now() + 10000;
        gameState.deck = settings.infiniteMode ? [] : nextHand.remaining;
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
          deckRemaining: settings.infiniteMode ? -1 : gameState.deck.length,
        });
      }
    } else {
      await setGameState(roomCode, gameState);
    }

    return NextResponse.json({ success: true, voteCount: gameState.skipVotes.length, required });
  } catch (err) {
    console.error('[game/skip-vote]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
