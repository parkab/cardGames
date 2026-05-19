import { NextRequest, NextResponse } from 'next/server';
import { getRoomState, getGameState } from '@/lib/redis';
import type { RoomState, GameState } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code')?.toUpperCase();
    if (!code) return NextResponse.json({ error: 'code is required.' }, { status: 400 });

    const [rawRoom, rawGame] = await Promise.all([
      getRoomState(code),
      getGameState(code),
    ]);

    if (!rawRoom) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

    const roomState: RoomState = typeof rawRoom === 'string' ? JSON.parse(rawRoom) : rawRoom as RoomState;
    const gameState: GameState | null = rawGame
      ? (typeof rawGame === 'string' ? JSON.parse(rawGame) : rawGame as GameState)
      : null;

    return NextResponse.json({ roomState, gameState });
  } catch (err) {
    console.error('[room/state]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
