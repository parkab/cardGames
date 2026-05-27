import type { Rank, Card, CambioAbility, CambioServerPlayer, CambioGameState } from '@/types';
import { createDeck, shuffleDeck } from '@/lib/deck';

// ─── Point values for scoring ─────────────────────────────────────────────────
export function getCambioPoints(rank: Rank): number {
  if (rank === 'A') return -1;
  if (rank === 'K') return 0;
  if (rank === 'J') return 11;
  if (rank === 'Q') return 12;
  return parseInt(rank, 10); // 2–10
}

export function getHandScore(hand: (Card | null)[]): number {
  return hand.reduce<number>((sum, c) => sum + (c ? getCambioPoints(c.rank) : 0), 0);
}

// ─── Action abilities ─────────────────────────────────────────────────────────
export function getCambioAbility(rank: Rank): CambioAbility | null {
  if (rank === '9') return 'peek-own';
  if (rank === '10') return 'peek-opponent';
  if (rank === 'J') return 'blind-swap';
  if (rank === 'Q') return 'queen';
  return null;
}

// ─── Initial deal ─────────────────────────────────────────────────────────────
export function dealCambio(playerIds: string[], players: { id: string; nickname: string; isHost: boolean; isConnected: boolean }[]): {
  deck: Card[];
  serverPlayers: CambioServerPlayer[];
} {
  const deck = shuffleDeck(createDeck());
  const serverPlayers: CambioServerPlayer[] = players.map((p) => ({
    id: p.id,
    nickname: p.nickname,
    isHost: p.isHost,
    isConnected: p.isConnected,
    hand: [],
    hasCalledCambio: false,
  }));

  // Deal 4 cards to each player (index 0–3, bottom row = 2,3)
  for (let i = 0; i < 4; i++) {
    for (const sp of serverPlayers) {
      sp.hand.push(deck.shift()!);
    }
  }

  return { deck, serverPlayers };
}

// ─── Scoring and tiebreakers ─────────────────────────────────────────────────
export function computeScores(players: CambioServerPlayer[]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const p of players) {
    scores[p.id] = getHandScore(p.hand);
  }
  return scores;
}

export function determineWinners(players: CambioServerPlayer[], scores: Record<string, number>, cambioCallerId: string | null): string[] {
  const minScore = Math.min(...Object.values(scores));
  const tied = players.filter((p) => scores[p.id] === minScore);
  if (tied.length === 1) return [tied[0].id];

  // Tiebreaker 1: caller loses if tied with non-callers
  const nonCallerTied = tied.filter((p) => p.id !== cambioCallerId);
  if (nonCallerTied.length < tied.length && nonCallerTied.length > 0) {
    // Caller is tied with non-callers → caller loses, re-run with non-callers
    return determineWinnersAmongNonCallers(nonCallerTied, scores);
  }

  // All tied are non-callers (or no caller involved)
  return determineWinnersAmongNonCallers(tied, scores);
}

function determineWinnersAmongNonCallers(players: CambioServerPlayer[], scores: Record<string, number>): string[] {
  // Tiebreaker 2: compare hands card by card (lowest individual card wins)
  const sortedHands = players.map((p) => ({
    id: p.id,
    sorted: p.hand
      .filter(Boolean)
      .map((c) => getCambioPoints(c!.rank))
      .sort((a, b) => a - b),
  }));

  const maxLen = Math.max(...sortedHands.map((h) => h.sorted.length));
  for (let i = 0; i < maxLen; i++) {
    const vals = sortedHands.map((h) => h.sorted[i] ?? Infinity);
    const minVal = Math.min(...vals);
    const stillTied = sortedHands.filter((h) => (h.sorted[i] ?? Infinity) === minVal);
    if (stillTied.length < sortedHands.length) {
      return stillTied.map((h) => h.id);
    }
  }

  // Tiebreaker 3: shared win
  return players.map((p) => p.id);
}

// ─── Turn advancement ─────────────────────────────────────────────────────────
export function nextTurnIndex(currentIndex: number, players: CambioServerPlayer[]): number {
  const n = players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (currentIndex + i) % n;
    if (players[idx].isConnected) return idx;
  }
  return currentIndex; // all disconnected, stay
}

// ─── Deck replenishment from discard ─────────────────────────────────────────
export function replenishDeck(state: CambioGameState): void {
  if (state.deck.length > 0) return;
  if (state.discardPile.length <= 1) return;
  // Keep top discard, shuffle the rest back
  const top = state.discardPile.pop()!;
  state.deck = shuffleDeck(state.discardPile);
  state.discardPile = [top];
}

// ─── Determine first player index (right of host) ────────────────────────────
export function firstPlayerIndex(players: CambioServerPlayer[], hostId: string): number {
  const hostIdx = players.findIndex((p) => p.id === hostId);
  return (hostIdx + 1) % players.length;
}
