import { createDeck, shuffleDeck } from '@/lib/deck';

describe('createDeck', () => {
  it('creates exactly 52 cards', () => {
    expect(createDeck()).toHaveLength(52);
  });

  it('has 4 suits, 13 ranks each', () => {
    const deck = createDeck();
    const suits = new Set(deck.map((c) => c.suit));
    expect(suits.size).toBe(4);
    for (const suit of suits) {
      expect(deck.filter((c) => c.suit === suit)).toHaveLength(13);
    }
  });

  it('gives Ace a dual value [1, 11]', () => {
    const ace = createDeck().find((c) => c.rank === 'A');
    expect(ace?.value).toEqual([1, 11]);
  });

  it('gives face cards their correct numeric values', () => {
    const deck = createDeck();
    const j = deck.find((c) => c.rank === 'J');
    const q = deck.find((c) => c.rank === 'Q');
    const k = deck.find((c) => c.rank === 'K');
    expect(j?.value).toBe(11);
    expect(q?.value).toBe(12);
    expect(k?.value).toBe(13);
  });

  it('gives numeric ranks their face value', () => {
    const deck = createDeck();
    for (const rank of ['2', '3', '4', '5', '6', '7', '8', '9', '10'] as const) {
      const c = deck.find((card) => card.rank === rank);
      expect(c?.value).toBe(parseInt(rank, 10));
    }
  });

  it('has no duplicate cards', () => {
    const deck = createDeck();
    const keys = deck.map((c) => `${c.suit}-${c.rank}`);
    expect(new Set(keys).size).toBe(52);
  });
});

describe('shuffleDeck', () => {
  it('returns a deck of the same length', () => {
    const deck = createDeck();
    expect(shuffleDeck(deck)).toHaveLength(52);
  });

  it('does not mutate the original deck', () => {
    const deck = createDeck();
    const original = [...deck];
    shuffleDeck(deck);
    expect(deck).toEqual(original);
  });

  it('contains the same cards after shuffle', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    const toKey = (c: { suit: string; rank: string }) => `${c.suit}-${c.rank}`;
    expect(shuffled.map(toKey).sort()).toEqual(deck.map(toKey).sort());
  });

  it('produces a different order with high probability', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    // Probability of identical order after shuffle is 1/52! ≈ 0
    const same = deck.every((c, i) => c.suit === shuffled[i].suit && c.rank === shuffled[i].rank);
    expect(same).toBe(false);
  });
});
