import type { Card, Op, RoomSettings } from '@/types';

type SolverSettings = Partial<Pick<RoomSettings, 'modAllowed' | 'fractionsAllowed' | 'targetNumber'>>;

const BASE_OPS: Op[] = ['+', '-', '*', '/'];

function getOps(settings?: SolverSettings): Op[] {
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

function* permutations<T>(arr: T[]): Generator<T[]> {
  if (arr.length <= 1) { yield arr; return; }
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) yield [arr[i], ...perm];
  }
}

function* opCombos(n: number, ops: Op[]): Generator<Op[]> {
  function* helper(cur: Op[]): Generator<Op[]> {
    if (cur.length === n) { yield cur; return; }
    for (const op of ops) yield* helper([...cur, op]);
  }
  yield* helper([]);
}

function getCardValues(card: Card): number[] {
  return Array.isArray(card.value) ? (card.value as number[]) : [card.value as number];
}

function* cartesian(arrays: number[][]): Generator<number[]> {
  if (arrays.length === 0) { yield []; return; }
  const [first, ...rest] = arrays;
  for (const val of first)
    for (const combo of cartesian(rest))
      yield [val, ...combo];
}

function buildExpr(nums: number[], ops: Op[]): string {
  const parts: string[] = [];
  nums.forEach((n, i) => { parts.push(String(n)); if (i < ops.length) parts.push(ops[i]); });
  return parts.join(' ');
}

function* iterate(cards: Card[], settings?: SolverSettings): Generator<{ perm: number[]; ops: Op[] }> {
  const allOps = getOps(settings);
  const numOps = cards.length - 1;
  for (const nums of cartesian(cards.map(getCardValues)))
    for (const perm of permutations(nums))
      for (const ops of opCombos(numOps, allOps))
        yield { perm, ops };
}

export function canSolve(cards: Card[], settings?: SolverSettings): boolean {
  const fractionsOk = settings?.fractionsAllowed ?? true;
  const target = settings?.targetNumber ?? 21;
  for (const { perm, ops } of iterate(cards, settings))
    if (evalLTR(perm, ops, fractionsOk) === target) return true;
  return false;
}

export function findSolution(cards: Card[], settings?: SolverSettings): string | null {
  const fractionsOk = settings?.fractionsAllowed ?? true;
  const target = settings?.targetNumber ?? 21;
  for (const { perm, ops } of iterate(cards, settings))
    if (evalLTR(perm, ops, fractionsOk) === target) return buildExpr(perm, ops);
  return null;
}

export function findAllSolutions(cards: Card[], settings?: SolverSettings): string[] {
  const fractionsOk = settings?.fractionsAllowed ?? true;
  const target = settings?.targetNumber ?? 21;
  const seen = new Set<string>();
  for (const { perm, ops } of iterate(cards, settings))
    if (evalLTR(perm, ops, fractionsOk) === target) seen.add(buildExpr(perm, ops));
  return [...seen].sort((a, b) => a.length - b.length);
}
