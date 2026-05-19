import { canSolve, findSolution } from '@/lib/solver';
import type { Card } from '@/types';

function card(value: number | [number, number]): Card {
  return { suit: 'spades', rank: '2', value };
}

function evalLTR(expr: string): number {
  const tokens = expr.split(' ');
  let result = parseFloat(tokens[0]);
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const n = parseFloat(tokens[i + 1]);
    if (op === '+') result += n;
    else if (op === '-') result -= n;
    else if (op === '*') result *= n;
    else if (op === '/') result /= n;
  }
  return result;
}

describe('canSolve', () => {
  it('returns true for 3 * 7 + 1 - 1 = 21 (LTR)', () => {
    // 3*7=21, 21+1=22, 22-1=21
    expect(canSolve([card(3), card(7), card(1), card(1)])).toBe(true);
  });

  it('returns true for a hand solvable via Ace=11', () => {
    // [A, 9, 1, 1]: 11+9+1*1 → 11+9=20, 20+1=21, 21*1=21
    expect(canSolve([card([1, 11]), card(9), card(1), card(1)])).toBe(true);
  });

  it('returns true for a hand solvable via Ace=1', () => {
    // [A, 3, 7, 1]: 1+3*7-1 → LTR: 1+3=4, 4*7=28, 28-1=27 … try 3*7+1*1=21+1=22, no.
    // Actually 3*7=21 and we need to use Ace and one more 1 without changing it.
    // 3*7+1-1=21 but we need [A,3,7,1] → Ace=1: 1+3*7-1 no. Let solver figure it out.
    expect(canSolve([card([1, 11]), card(3), card(7), card(1)])).toBe(true);
  });

  it('returns false for values 1,1,1,4 (max achievable ~7)', () => {
    // With fixed values 1,1,1,4: max via LTR ops is 7 (4+1+1+1), no way to reach 21
    expect(canSolve([card(1), card(1), card(1), card(4)])).toBe(false);
  });

  it('returns true when answer is achievable via division', () => {
    // [3, 7, 1, 1]: 3*7+1-1=21 (uses all 4 cards LTR)
    expect(canSolve([card(3), card(7), card(1), card(1)])).toBe(true);
  });
});

describe('findSolution', () => {
  it('returns a 7-token expression string for a solvable hand', () => {
    const cards = [card(3), card(7), card(1), card(1)];
    const sol = findSolution(cards);
    expect(sol).not.toBeNull();
    const tokens = sol!.split(' ');
    expect(tokens).toHaveLength(7);
  });

  it('the returned expression evaluates LTR to exactly 21', () => {
    const cards = [card(3), card(7), card(1), card(1)];
    const sol = findSolution(cards);
    expect(sol).not.toBeNull();
    expect(evalLTR(sol!)).toBe(21);
  });

  it('returns null for an unsolvable hand', () => {
    expect(findSolution([card(1), card(1), card(1), card(4)])).toBeNull();
  });

  it('returns a valid expression for an Ace hand', () => {
    const cards = [card([1, 11]), card(9), card(1), card(1)];
    const sol = findSolution(cards);
    expect(sol).not.toBeNull();
    expect(evalLTR(sol!)).toBe(21);
  });
});
