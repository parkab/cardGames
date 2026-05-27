'use client';

import { useEffect, useRef, useState } from 'react';
import Ably from 'ably';
import type { AblyEventName, CambioAblyEventName } from '@/types';

type AnyEventName = AblyEventName | CambioAblyEventName;

type Handler = (data: unknown) => void;

export function useAbly(roomCode: string, playerId: string) {
  const clientRef = useRef<Ably.Realtime | null>(null);
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!roomCode || !playerId) return;

    const client = new Ably.Realtime({
      authUrl: `/api/ably-token?roomCode=${roomCode}&playerId=${playerId}`,
      clientId: playerId,
    });
    clientRef.current = client;

    client.connection.on('connected', () => setConnected(true));
    client.connection.on('disconnected', () => setConnected(false));

    const channel = client.channels.get(`room:${roomCode}`);
    channelRef.current = channel;

    return () => {
      channel.detach();
      client.close();
    };
  }, [roomCode, playerId]);

  function subscribe(eventName: AnyEventName, handler: Handler) {
    channelRef.current?.subscribe(eventName, (msg) => handler(msg.data));
  }

  function unsubscribe(eventName: AnyEventName) {
    channelRef.current?.unsubscribe(eventName);
  }

  return { connected, subscribe, unsubscribe };
}
