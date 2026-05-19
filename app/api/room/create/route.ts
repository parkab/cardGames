import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { generateRoomCode } from '@/lib/roomCode';
import { redis, setRoomState } from '@/lib/redis';
import { DEFAULT_SETTINGS } from '@/types';
import type { RoomState, RoomSettings, Player } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { nickname, settings: rawSettings } = await req.json();
    if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0) {
      return NextResponse.json({ error: 'Nickname is required.' }, { status: 400 });
    }

    const playerId = uuidv4();
    let roomCode = '';
    let attempts = 0;

    while (attempts < 5) {
      const candidate = generateRoomCode();
      const existing = await redis.get(`room:${candidate}`);
      if (!existing) { roomCode = candidate; break; }
      attempts++;
    }
    if (!roomCode) {
      return NextResponse.json({ error: 'Could not generate unique room code.' }, { status: 500 });
    }

    const settings: RoomSettings = {
      timeLimitSeconds: clamp(rawSettings?.timeLimitSeconds ?? DEFAULT_SETTINGS.timeLimitSeconds, 30, 300),
      modAllowed: !!rawSettings?.modAllowed,
      fractionsAllowed: !!rawSettings?.fractionsAllowed,
      cardsPerRound: clamp(rawSettings?.cardsPerRound ?? DEFAULT_SETTINGS.cardsPerRound, 3, 7),
    };

    const host: Player = {
      id: playerId,
      nickname: nickname.trim().slice(0, 20),
      score: 0,
      isHost: true,
      isConnected: true,
      joinedAt: Date.now(),
    };

    const roomState: RoomState = {
      code: roomCode,
      status: 'lobby',
      players: [host],
      hostId: playerId,
      createdAt: Date.now(),
      settings,
    };

    await setRoomState(roomCode, roomState);

    return NextResponse.json({ roomCode, playerId });
  } catch (err) {
    console.error('[room/create]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}
