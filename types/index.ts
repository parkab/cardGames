export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A';
export type Op = '+' | '-' | '*' | '/' | '%';

export interface Card {
  suit: Suit;
  rank: Rank;
  value: number | [number, number]; // Ace: [1, 11], others: fixed number
}

export interface Player {
  id: string;
  nickname: string;
  score: number;
  isHost: boolean;
  isConnected: boolean;
  joinedAt: number;
}

export interface RoomSettings {
  timeLimitSeconds: number;   // 30–300, default 60
  modAllowed: boolean;        // default false
  fractionsAllowed: boolean;  // default false
  cardsPerRound: number;      // 3–7, default 4
  targetNumber: number;       // -50–50, default 21
  infiniteMode: boolean;      // cards drawn with replacement, game ends via end-vote only
}

export const DEFAULT_SETTINGS: RoomSettings = {
  timeLimitSeconds: 60,
  modAllowed: false,
  fractionsAllowed: false,
  cardsPerRound: 4,
  targetNumber: 21,
  infiniteMode: false,
};

export interface RoomState {
  code: string;
  status: 'lobby' | 'playing' | 'finished';
  players: Player[];
  hostId: string;
  createdAt: number;
  settings: RoomSettings;
}

export interface GameState {
  deck: Card[];
  discardPile: Card[];
  currentHand: Card[];
  roundNumber: number;
  roundStartedAt: number;
  roundStatus: 'active' | 'solved' | 'timed_out' | 'skipped';
  eliminatedThisRound: string[];
  skipVotes: string[];
  endVotes?: string[];
  winnerId: string | null;
  scores: Record<string, number>;
}

// Ably event payloads
export interface RoundStartPayload {
  roundNumber: number;
  cards: Card[];
  roundStartedAt: number;
  deckRemaining: number;
}

export interface RoundSolvedPayload {
  winnerId: string;
  winnerNickname: string;
  expression: string;
  scores: Record<string, number>;
}

export interface RoundEndPayload {
  scores: Record<string, number>;
}

export interface PlayerEliminatedPayload {
  playerId: string;
  nickname: string;
  eliminatedThisRound: string[];
}

export interface SkipVoteUpdatePayload {
  skipVotes: string[];
  required: number;
}

export interface GameOverPayload {
  finalScores: Record<string, number>;
  players: Player[];
}

export interface EndVoteUpdatePayload {
  endVotes: string[];
  required: number;
}

export type AblyEventName =
  | 'room:player_joined'
  | 'room:player_left'
  | 'game:started'
  | 'round:start'
  | 'round:solved'
  | 'round:timeout'
  | 'round:skipped'
  | 'player:eliminated'
  | 'skip:vote_update'
  | 'game:end_vote'
  | 'game:over';
