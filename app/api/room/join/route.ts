import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getRoomState, setRoomState } from '@/lib/redis';
import { publishToRoom } from '@/lib/ably';
import type { RoomState, Player } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { roomCode, nickname } = await req.json();
    if (!roomCode || !nickname) {
      return NextResponse.json({ error: 'roomCode and nickname are required.' }, { status: 400 });
    }

    const raw = await getRoomState(roomCode.toUpperCase());
    if (!raw) {
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
    }

    const roomState: RoomState = typeof raw === 'string' ? JSON.parse(raw) : raw as RoomState;

    if (roomState.status !== 'lobby') {
      return NextResponse.json({ error: 'Game already in progress.' }, { status: 409 });
    }
    if (roomState.players.length >= 8) {
      return NextResponse.json({ error: 'Room is full.' }, { status: 409 });
    }

    const playerId = uuidv4();

    // Handle duplicate nicknames
    const existingNicknames = roomState.players.map((p) => p.nickname);
    let displayNickname = nickname.trim().slice(0, 20);
    if (existingNicknames.includes(displayNickname)) {
      let suffix = 2;
      while (existingNicknames.includes(`${displayNickname} (${suffix})`)) suffix++;
      displayNickname = `${displayNickname} (${suffix})`;
    }

    const player: Player = {
      id: playerId,
      nickname: displayNickname,
      score: 0,
      isHost: false,
      isConnected: true,
      joinedAt: Date.now(),
    };

    roomState.players.push(player);
    await setRoomState(roomState.code, roomState);
    await publishToRoom(roomState.code, 'room:player_joined', { player });

    return NextResponse.json({ success: true, playerId, roomState });
  } catch (err) {
    console.error('[room/join]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
