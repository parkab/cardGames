import { generateRoomCode } from '@/lib/roomCode';

describe('generateRoomCode', () => {
  it('returns a string of exactly 4 characters', () => {
    expect(generateRoomCode()).toHaveLength(4);
  });

  it('only uses allowed characters (no I or O)', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
      expect(code).not.toContain('I');
      expect(code).not.toContain('O');
    }
  });

  it('produces different codes across calls (probabilistic)', () => {
    const codes = new Set(Array.from({ length: 50 }, generateRoomCode));
    // 23^4 = 279,841 possibilities; chance of all 50 being identical is negligible
    expect(codes.size).toBeGreaterThan(1);
  });
});
