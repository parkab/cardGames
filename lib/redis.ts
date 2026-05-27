import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const ROOM_TTL = 7200; // 2 hours in seconds

export async function getRoomState(code: string) {
  const data = await redis.get(`room:${code}`);
  return data ?? null;
}

export async function setRoomState(code: string, state: unknown) {
  await redis.set(`room:${code}`, JSON.stringify(state), { ex: ROOM_TTL });
}

export async function getGameState(code: string) {
  const data = await redis.get(`game:${code}`);
  return data ?? null;
}

export async function setGameState(code: string, state: unknown) {
  await redis.set(`game:${code}`, JSON.stringify(state), { ex: ROOM_TTL });
}

export async function deleteRoom(code: string) {
  await redis.del(`room:${code}`, `game:${code}`);
}

export async function getCambioState(code: string) {
  const data = await redis.get(`cambio:${code}`);
  return data ?? null;
}

export async function setCambioState(code: string, state: unknown) {
  await redis.set(`cambio:${code}`, JSON.stringify(state), { ex: ROOM_TTL });
}
