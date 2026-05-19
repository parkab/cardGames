import { NextRequest, NextResponse } from 'next/server';
import { getRoomState, setRoomState } from '@/lib/redis';
import { publishToRoom } from '@/lib/ably';
import type { RoomState } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { roomCode, playerId } = await req.json();
    const raw = await getRoomState(roomCode);
    if (!raw) return NextResponse.json({ success: true });

    const roomState: RoomState = typeof raw === 'string' ? JSON.parse(raw) : raw as RoomState;
    roomState.players = roomState.players.filter((p) => p.id !== playerId);

    let newHostId: string | undefined;
    if (roomState.hostId === playerId && roomState.players.length > 0) {
      const nextHost = roomState.players.sort((a, b) => a.joinedAt - b.joinedAt)[0];
      nextHost.isHost = true;
      roomState.hostId = nextHost.id;
      newHostId = nextHost.id;
    }

    await setRoomState(roomCode, roomState);
    await publishToRoom(roomCode, 'room:player_left', { playerId, newHostId });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[room/leave]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
