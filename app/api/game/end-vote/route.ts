import { NextRequest, NextResponse } from 'next/server';
import { getRoomState, getGameState, setGameState, setRoomState } from '@/lib/redis';
import { publishToRoom } from '@/lib/ably';
import type { RoomState, GameState } from '@/types';

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

    if (roomState.status !== 'playing') {
      return NextResponse.json({ error: 'Game not in progress.' }, { status: 400 });
    }

    if (!gameState.endVotes) gameState.endVotes = [];
    if (!gameState.endVotes.includes(playerId)) {
      gameState.endVotes.push(playerId);
    }

    const connectedPlayers = roomState.players.filter((p) => p.isConnected);
    const required = connectedPlayers.length;
    const allVoted = connectedPlayers.every((p) => gameState.endVotes!.includes(p.id));

    if (allVoted) {
      roomState.status = 'finished';
      await setRoomState(roomCode, roomState);
      await setGameState(roomCode, gameState);
      await publishToRoom(roomCode, 'game:over', {
        finalScores: gameState.scores,
        players: roomState.players,
      });
    } else {
      await setGameState(roomCode, gameState);
      await publishToRoom(roomCode, 'game:end_vote', {
        endVotes: gameState.endVotes,
        required,
      });
    }

    return NextResponse.json({ success: true, voteCount: gameState.endVotes.length, required });
  } catch (err) {
    console.error('[game/end-vote]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
