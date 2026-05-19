import { NextRequest, NextResponse } from 'next/server';
import { getRoomState, getGameState, setGameState, setRoomState } from '@/lib/redis';
import { publishToRoom } from '@/lib/ably';
import { validateSolution } from '@/lib/validator';
import { canSolve } from '@/lib/solver';
import { shuffleDeck } from '@/lib/deck';
import { DEFAULT_SETTINGS } from '@/types';
import type { RoomState, GameState, Card, RoomSettings } from '@/types';

type SolverSettings = Partial<Pick<RoomSettings, 'modAllowed' | 'fractionsAllowed'>>;

function dealNextSolvable(
  deck: Card[],
  cardsPerRound: number,
  solverSettings: SolverSettings
): { hand: Card[]; remaining: Card[] } | null {
  const d = [...deck];
  for (let i = 0; i < 100; i++) {
    if (d.length < cardsPerRound) return null;
    const hand = d.slice(0, cardsPerRound);
    if (canSolve(hand, solverSettings)) return { hand, remaining: d.slice(cardsPerRound) };
    const reshuffled = shuffleDeck(d);
    d.splice(0, d.length, ...reshuffled);
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { roomCode, playerId, expression } = await req.json();

    const [rawRoom, rawGame] = await Promise.all([
      getRoomState(roomCode),
      getGameState(roomCode),
    ]);
    if (!rawRoom || !rawGame) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

    const roomState: RoomState = typeof rawRoom === 'string' ? JSON.parse(rawRoom) : rawRoom as RoomState;
    const gameState: GameState = typeof rawGame === 'string' ? JSON.parse(rawGame) : rawGame as GameState;

    const settings = roomState.settings ?? DEFAULT_SETTINGS;
    const solverSettings: SolverSettings = {
      modAllowed: settings.modAllowed,
      fractionsAllowed: settings.fractionsAllowed,
    };

    if (gameState.roundStatus !== 'active') {
      return NextResponse.json({ correct: false, message: 'Round is not active.' });
    }
    if (gameState.eliminatedThisRound.includes(playerId)) {
      return NextResponse.json({ correct: false, message: 'You are eliminated this round.' });
    }

    const isCorrect = validateSolution(expression, gameState.currentHand, solverSettings);

    if (isCorrect) {
      const player = roomState.players.find((p) => p.id === playerId);
      gameState.scores[playerId] = (gameState.scores[playerId] ?? 0) + 1;
      gameState.winnerId = playerId;
      gameState.roundStatus = 'solved';
      gameState.discardPile.push(...gameState.currentHand);

      await publishToRoom(roomCode, 'round:solved', {
        winnerId: playerId,
        winnerNickname: player?.nickname ?? 'Unknown',
        scores: gameState.scores,
      });

      const dealt = dealNextSolvable(gameState.deck, settings.cardsPerRound, solverSettings);
      if (!dealt) {
        roomState.status = 'finished';
        await setRoomState(roomCode, roomState);
        await setGameState(roomCode, gameState);
        await publishToRoom(roomCode, 'game:over', {
          finalScores: gameState.scores,
          players: roomState.players,
        });
      } else {
        const now = Date.now() + 3000;
        gameState.deck = dealt.remaining;
        gameState.currentHand = dealt.hand;
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
      }

      return NextResponse.json({ correct: true });
    } else {
      gameState.eliminatedThisRound.push(playerId);
      const player = roomState.players.find((p) => p.id === playerId);

      const activePlayers = roomState.players.filter(
        (p) => p.isConnected && !gameState.eliminatedThisRound.includes(p.id)
      );

      await publishToRoom(roomCode, 'player:eliminated', {
        playerId,
        nickname: player?.nickname ?? 'Unknown',
        eliminatedThisRound: gameState.eliminatedThisRound,
      });

      if (activePlayers.length === 0) {
        gameState.roundStatus = 'timed_out';
        gameState.deck = shuffleDeck([...gameState.deck, ...gameState.currentHand]);

        const dealt = dealNextSolvable(gameState.deck, settings.cardsPerRound, solverSettings);
        if (!dealt) {
          roomState.status = 'finished';
          await setRoomState(roomCode, roomState);
          await setGameState(roomCode, gameState);
          await publishToRoom(roomCode, 'game:over', {
            finalScores: gameState.scores,
            players: roomState.players,
          });
        } else {
          const now = Date.now() + 10000;
          gameState.deck = dealt.remaining;
          gameState.currentHand = dealt.hand;
          gameState.roundNumber += 1;
          gameState.roundStartedAt = now;
          gameState.roundStatus = 'active';
          gameState.eliminatedThisRound = [];
          gameState.skipVotes = [];
          gameState.winnerId = null;
          await setGameState(roomCode, gameState);
          await publishToRoom(roomCode, 'round:timeout', { scores: gameState.scores });
          await publishToRoom(roomCode, 'round:start', {
            roundNumber: gameState.roundNumber,
            cards: gameState.currentHand,
            roundStartedAt: now,
            deckRemaining: gameState.deck.length,
          });
        }
      } else {
        await setGameState(roomCode, gameState);
      }

      return NextResponse.json({ correct: false, message: "Incorrect answer. You're out this round." });
    }
  } catch (err) {
    console.error('[game/submit]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
