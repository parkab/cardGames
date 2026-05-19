import type { Card, Op, RoomSettings } from '@/types';

type ValidatorSettings = Partial<Pick<RoomSettings, 'modAllowed' | 'fractionsAllowed' | 'targetNumber'>>;

const BASE_OPS: Op[] = ['+', '-', '*', '/'];

function getAllowedOps(settings?: ValidatorSettings): Op[] {
  return settings?.modAllowed ? [...BASE_OPS, '%'] : BASE_OPS;
}

function applyOp(a: number, op: Op, b: number): number | null {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b !== 0 ? a / b : null;
    case '%': return b !== 0 ? a % b : null;
  }
}

function evalLTR(nums: number[], ops: Op[], fractionsOk: boolean): number | null {
  let result = nums[0];
  for (let i = 0; i < ops.length; i++) {
    const next = applyOp(result, ops[i], nums[i + 1]);
    if (next === null) return null;
    if (!fractionsOk && !Number.isInteger(next)) return null;
    result = next;
  }
  return result;
}

function getConcreteValues(cards: Card[]): number[][] {
  return cards.map((c) =>
    Array.isArray(c.value) ? (c.value as number[]) : [c.value as number]
  );
}

function numbersMatchCards(numbers: number[], cards: Card[]): boolean {
  const options = getConcreteValues(cards);

  function tryMatch(opts: number[][], chosen: number[]): boolean {
    if (opts.length === 0) {
      const pool = [...chosen];
      const used: boolean[] = new Array(pool.length).fill(false);
      for (const n of numbers) {
        const idx = pool.findIndex((v, i) => !used[i] && v === n);
        if (idx === -1) return false;
        used[idx] = true;
      }
      return true;
    }
    const [first, ...rest] = opts;
    for (const v of first) if (tryMatch(rest, [...chosen, v])) return true;
    return false;
  }

  return tryMatch(options, []);
}

export function validateSolution(
  expression: string,
  cards: Card[],
  settings?: ValidatorSettings
): boolean {
  // Normalize: insert spaces around operators so "10+3*2" works alongside "10 + 3 * 2"
  const normalized = expression.trim().replace(/([+\-*/%])/g, ' $1 ');
  const tokens = normalized.trim().split(/\s+/).filter(Boolean);
  const expectedLen = 2 * cards.length - 1;
  if (tokens.length !== expectedLen) return false;

  const numbers = tokens.filter((_, i) => i % 2 === 0).map(Number);
  const operators = tokens.filter((_, i) => i % 2 === 1) as Op[];

  const allowedOps = getAllowedOps(settings);
  if (numbers.some(isNaN)) return false;
  if (operators.some((op) => !allowedOps.includes(op))) return false;
  if (!numbersMatchCards(numbers, cards)) return false;

  const fractionsOk = settings?.fractionsAllowed ?? true;
  const target = settings?.targetNumber ?? 21;
  return evalLTR(numbers, operators, fractionsOk) === target;
}
