import { normalizeSettings } from '@/lib/settings';
import { DEFAULT_SETTINGS } from '@/types';

describe('normalizeSettings', () => {
  describe('defaults', () => {
    it('returns defaults when called with empty object', () => {
      const result = normalizeSettings({});
      expect(result).toEqual(DEFAULT_SETTINGS);
    });

    it('fills in missing fields with defaults', () => {
      const result = normalizeSettings({ modAllowed: true });
      expect(result.timeLimitSeconds).toBe(DEFAULT_SETTINGS.timeLimitSeconds);
      expect(result.cardsPerRound).toBe(DEFAULT_SETTINGS.cardsPerRound);
      expect(result.targetNumber).toBe(DEFAULT_SETTINGS.targetNumber);
      expect(result.fractionsAllowed).toBe(false);
      expect(result.infiniteMode).toBe(false);
      expect(result.modAllowed).toBe(true);
    });
  });

  describe('valid values pass through unchanged', () => {
    it('preserves a fully specified valid settings object', () => {
      const input = {
        timeLimitSeconds: 90,
        modAllowed: true,
        fractionsAllowed: true,
        cardsPerRound: 5,
        targetNumber: 42,
        infiniteMode: true,
      };
      expect(normalizeSettings(input)).toEqual(input);
    });
  });

  describe('timeLimitSeconds clamping', () => {
    it('clamps below 30 up to 30', () => {
      expect(normalizeSettings({ timeLimitSeconds: 0 }).timeLimitSeconds).toBe(30);
    });

    it('clamps above 300 down to 300', () => {
      expect(normalizeSettings({ timeLimitSeconds: 9999 }).timeLimitSeconds).toBe(300);
    });

    it('accepts boundary value 30', () => {
      expect(normalizeSettings({ timeLimitSeconds: 30 }).timeLimitSeconds).toBe(30);
    });

    it('accepts boundary value 300', () => {
      expect(normalizeSettings({ timeLimitSeconds: 300 }).timeLimitSeconds).toBe(300);
    });
  });

  describe('cardsPerRound clamping', () => {
    it('clamps below 3 up to 3', () => {
      expect(normalizeSettings({ cardsPerRound: 1 }).cardsPerRound).toBe(3);
    });

    it('clamps above 7 down to 7', () => {
      expect(normalizeSettings({ cardsPerRound: 100 }).cardsPerRound).toBe(7);
    });

    it('accepts boundary value 3', () => {
      expect(normalizeSettings({ cardsPerRound: 3 }).cardsPerRound).toBe(3);
    });

    it('accepts boundary value 7', () => {
      expect(normalizeSettings({ cardsPerRound: 7 }).cardsPerRound).toBe(7);
    });
  });

  describe('targetNumber clamping', () => {
    it('clamps below -100 up to -100', () => {
      expect(normalizeSettings({ targetNumber: -999 }).targetNumber).toBe(-100);
    });

    it('clamps above 100 down to 100', () => {
      expect(normalizeSettings({ targetNumber: 999 }).targetNumber).toBe(100);
    });

    it('accepts boundary value -100', () => {
      expect(normalizeSettings({ targetNumber: -100 }).targetNumber).toBe(-100);
    });

    it('accepts boundary value 100', () => {
      expect(normalizeSettings({ targetNumber: 100 }).targetNumber).toBe(100);
    });

    it('accepts 0', () => {
      expect(normalizeSettings({ targetNumber: 0 }).targetNumber).toBe(0);
    });

    it('accepts negative values within range', () => {
      expect(normalizeSettings({ targetNumber: -42 }).targetNumber).toBe(-42);
    });
  });

  describe('boolean coercion', () => {
    it('coerces truthy values to true for modAllowed', () => {
      expect(normalizeSettings({ modAllowed: true }).modAllowed).toBe(true);
    });

    it('coerces falsy values to false for modAllowed', () => {
      expect(normalizeSettings({ modAllowed: false }).modAllowed).toBe(false);
    });

    it('coerces truthy values to true for fractionsAllowed', () => {
      expect(normalizeSettings({ fractionsAllowed: true }).fractionsAllowed).toBe(true);
    });

    it('coerces truthy values to true for infiniteMode', () => {
      expect(normalizeSettings({ infiniteMode: true }).infiniteMode).toBe(true);
    });

    it('defaults all booleans to false', () => {
      const result = normalizeSettings({});
      expect(result.modAllowed).toBe(false);
      expect(result.fractionsAllowed).toBe(false);
      expect(result.infiniteMode).toBe(false);
    });
  });

  describe('play again scenario', () => {
    it('applies settings override correctly for a typical play again flow', () => {
      const original = { ...DEFAULT_SETTINGS };
      const override = {
        ...original,
        targetNumber: -10,
        cardsPerRound: 5,
        modAllowed: true,
        timeLimitSeconds: 120,
      };
      const result = normalizeSettings(override);
      expect(result.targetNumber).toBe(-10);
      expect(result.cardsPerRound).toBe(5);
      expect(result.modAllowed).toBe(true);
      expect(result.timeLimitSeconds).toBe(120);
      expect(result.fractionsAllowed).toBe(false);
      expect(result.infiniteMode).toBe(false);
    });

    it('clamps out-of-range values from a malicious override', () => {
      const result = normalizeSettings({
        timeLimitSeconds: -1,
        cardsPerRound: 99,
        targetNumber: 200,
      });
      expect(result.timeLimitSeconds).toBe(30);
      expect(result.cardsPerRound).toBe(7);
      expect(result.targetNumber).toBe(100);
    });
  });
});
