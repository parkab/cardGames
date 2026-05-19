import Ably from 'ably';

// Server-side REST client (publishes events)
let _restClient: Ably.Rest | null = null;

export function getAblyServer(): Ably.Rest {
  if (!_restClient) {
    _restClient = new Ably.Rest({ key: process.env.ABLY_API_KEY! });
  }
  return _restClient;
}

export function getRoomChannelName(code: string): string {
  return `room:${code}`;
}

export async function publishToRoom(
  code: string,
  eventName: string,
  data: unknown
): Promise<void> {
  const client = getAblyServer();
  const channel = client.channels.get(getRoomChannelName(code));
  await channel.publish(eventName, data);
}
