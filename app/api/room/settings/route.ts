import { NextRequest, NextResponse } from 'next/server';
import { getRoomState, setRoomState } from '@/lib/redis';
import { publishToRoom } from '@/lib/ably';
import { normalizeSettings } from '@/lib/settings';
import type { RoomState } from '@/types';

export async function PUT(req: NextRequest) {
  try {
    const { roomCode, playerId, settings: rawSettings } = await req.json();

    const raw = await getRoomState(roomCode);
    if (!raw) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

    const roomState: RoomState = typeof raw === 'string' ? JSON.parse(raw) : raw as RoomState;

    if (roomState.hostId !== playerId) {
      return NextResponse.json({ error: 'Only the host can change settings.' }, { status: 403 });
    }
    if (roomState.status !== 'lobby') {
      return NextResponse.json({ error: 'Settings can only be changed in the lobby.' }, { status: 409 });
    }

    roomState.settings = normalizeSettings(rawSettings ?? {});
    await setRoomState(roomCode, roomState);
    await publishToRoom(roomCode, 'room:settings_updated', { settings: roomState.settings });

    return NextResponse.json({ success: true, settings: roomState.settings });
  } catch (err) {
    console.error('[room/settings]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
