import type { RoomSettings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export function normalizeSettings(raw: Partial<RoomSettings>): RoomSettings {
  return {
    timeLimitSeconds: clamp(
      raw.timeLimitSeconds ?? DEFAULT_SETTINGS.timeLimitSeconds,
      30, 300
    ),
    modAllowed: !!raw.modAllowed,
    fractionsAllowed: !!raw.fractionsAllowed,
    cardsPerRound: clamp(
      raw.cardsPerRound ?? DEFAULT_SETTINGS.cardsPerRound,
      3, 7
    ),
    targetNumber: clamp(
      raw.targetNumber ?? DEFAULT_SETTINGS.targetNumber,
      -100, 100
    ),
    infiniteMode: !!raw.infiniteMode,
  };
}
