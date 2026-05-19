import { NextRequest, NextResponse } from 'next/server';
import Ably from 'ably';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomCode = searchParams.get('roomCode');
    const playerId = searchParams.get('playerId');

    if (!roomCode || !playerId) {
      return NextResponse.json({ error: 'roomCode and playerId are required.' }, { status: 400 });
    }

    const client = new Ably.Rest({ key: process.env.ABLY_API_KEY! });
    const tokenRequest = await client.auth.createTokenRequest({
      clientId: playerId,
      capability: { [`room:${roomCode}`]: ['subscribe', 'publish', 'presence'] },
    });

    return NextResponse.json(tokenRequest);
  } catch (err) {
    console.error('[ably-token]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
