import { validateSolution } from '@/lib/validator';
import type { Card } from '@/types';

function card(value: number | [number, number]): Card {
  return { suit: 'spades', rank: '2', value };
}

const cards3711 = [card(3), card(7), card(1), card(1)];

describe('validateSolution', () => {
  it('accepts a correct LTR expression', () => {
    // 3*7+1-1 LTR: 3*7=21, 21+1=22, 22-1=21
    expect(validateSolution('3 * 7 + 1 - 1', cards3711)).toBe(true);
  });

  it('rejects an expression whose LTR result is not 21', () => {
    // 3+7+1+1=12
    expect(validateSolution('3 + 7 + 1 + 1', cards3711)).toBe(false);
  });

  it('rejects wrong card count (fewer than 4 numbers)', () => {
    expect(validateSolution('3 + 7 + 1', cards3711)).toBe(false);
  });

  it('rejects extra tokens', () => {
    expect(validateSolution('3 + 7 + 1 - 1 + 0', cards3711)).toBe(false);
  });

  it('rejects numbers not matching the dealt cards', () => {
    // 5 is not in cards3711
    expect(validateSolution('5 + 7 + 1 + 8', cards3711)).toBe(false);
  });

  it('rejects invalid operators', () => {
    expect(validateSolution('3 ^ 7 + 1 - 1', cards3711)).toBe(false);
  });

  it('accepts expression using Ace as 11', () => {
    // [A, 9, 1, 1]: 11+9+1*1=21
    const aceCards = [card([1, 11]), card(9), card(1), card(1)];
    expect(validateSolution('11 + 9 + 1 * 1', aceCards)).toBe(true);
  });

  it('accepts expression using Ace as 1', () => {
    // [A, 3, 7, 1]: using Ace as 1 — 3*7+1-1=21
    const aceCards = [card([1, 11]), card(3), card(7), card(1)];
    expect(validateSolution('3 * 7 + 1 - 1', aceCards)).toBe(true);
  });

  it('rejects using a card value twice when only one exists', () => {
    // cards3711 has two 1s and one 3 and one 7
    // using three 7s should fail
    expect(validateSolution('7 + 7 + 7 + 0', cards3711)).toBe(false);
  });

  it('rejects NaN token', () => {
    expect(validateSolution('3 + abc + 1 - 1', cards3711)).toBe(false);
  });

  it('rejects division by zero (result is null, not 21)', () => {
    const divCards = [card(3), card(0), card(7), card(1)];
    expect(validateSolution('3 / 0 + 7 + 1', divCards)).toBe(false);
  });

  it('accepts correct expression without spaces', () => {
    expect(validateSolution('3*7+1-1', cards3711)).toBe(true);
  });

  it('accepts correct expression with mixed spacing', () => {
    expect(validateSolution('3 *7+1- 1', cards3711)).toBe(true);
  });

  it('rejects spaceless expression with wrong result', () => {
    expect(validateSolution('3+7+1+1', cards3711)).toBe(false);
  });
});
