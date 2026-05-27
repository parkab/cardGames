export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A';
export type Op = '+' | '-' | '*' | '/' | '%';
export type GameType = 'twenty-one' | 'cambio';

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
  gameType: GameType;
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
  | 'room:settings_updated'
  | 'game:started'
  | 'round:start'
  | 'round:solved'
  | 'round:timeout'
  | 'round:skipped'
  | 'player:eliminated'
  | 'skip:vote_update'
  | 'game:end_vote'
  | 'game:over';

// ─── Cambio ──────────────────────────────────────────────────────────────────

export type CambioPhase =
  | 'initial-peek'
  | 'turn-draw'
  | 'turn-decide'
  | 'ability-9'
  | 'ability-10'
  | 'ability-jack'
  | 'ability-queen-peek'
  | 'ability-queen-decide'
  | 'final-round'
  | 'game-over';

export type CambioAbility = 'peek-own' | 'peek-opponent' | 'blind-swap' | 'queen';

// Server-side player (stores actual card values — never sent to clients as-is)
export interface CambioServerPlayer {
  id: string;
  nickname: string;
  isHost: boolean;
  isConnected: boolean;
  hand: (Card | null)[]; // null = slot removed (stuck/discarded)
  hasCalledCambio: boolean;
}

// Full server-side game state (stored in Redis as cambio:{CODE})
export interface CambioGameState {
  deck: Card[];
  discardPile: Card[];
  players: CambioServerPlayer[];
  currentTurnIndex: number;
  turnStartedAt: number;    // ms timestamp when current turn began
  peekUntil: number;        // ms timestamp when initial-peek phase ends (0 if not in peek)
  phase: CambioPhase;
  drawnCard: Card | null;
  drawnCardPlayerId: string | null;
  cambioCallerId: string | null;
  finalTurnsRemaining: number;
  pendingAbility: {
    type: CambioAbility;
    playerId: string;
    peekedTargetPlayerId?: string;
    peekedTargetCardIndex?: number;
    peekedCard?: Card; // stored server-side for queen-decide phase
  } | null;
  stickLocked: boolean; // simple mutex for stick race-condition mitigation
}

// ─── Cambio Ably event payloads ───────────────────────────────────────────────

export interface CambioStartedPayload {
  playerOrder: string[];
  peekUntil: number;
  firstTurnPlayerId: string;
  turnStartedAt: number; // same as peekUntil (first turn starts after peek)
  deckRemaining: number;
}

export interface CambioTurnStartPayload {
  currentPlayerId: string;
  turnStartedAt: number;
  deckRemaining: number;
  phase: CambioPhase;
  finalTurnsRemaining: number;
}

export interface CambioCardDrawnPublicPayload {
  playerId: string;
  deckRemaining: number;
}

export interface CambioCardDiscardedPayload {
  playerId: string;
  card: Card;
  phase: CambioPhase; // next phase (ability or turn-draw for next player)
}

export interface CambioSwapCompletedPayload {
  playerId: string;
  swappedOutCardIndex: number; // index in player's hand that was swapped out
  discardedCard: Card;         // the displaced card (now on discard pile)
  deckRemaining: number;
}

export interface CambioBlindSwapPayload {
  player1Id: string;
  card1Index: number;
  player2Id: string;
  card2Index: number;
}

export interface CambioStickSuccessPayload {
  stickerId: string;
  targetPlayerId: string;
  cardIndex: number;
  card: Card;
  // When sticking an opponent's card, sticker may transfer one of their own
  transferFromStickerId?: number;   // slot index in sticker's hand
  transferToTargetIndex?: number;   // where it lands in target's hand
}

export interface CambioStickFailPayload {
  stickerId: string;
  targetPlayerId: string;
  cardIndex: number;
  attemptedCard: Card; // reveal what the card actually was (for UX)
}

export interface CambioCalledPayload {
  callerId: string;
  finalTurnsRemaining: number;
}

export interface CambioAbilityPromptPayload {
  phase: CambioPhase;
  playerId: string;
}

export interface CambioGameOverPayload {
  finalHands: Record<string, (Card | null)[]>; // all hands revealed
  scores: Record<string, number>;
  winnerIds: string[];
  callerId: string | null;
  players: CambioServerPlayer[];
}

export type CambioAblyEventName =
  | 'cambio:started'
  | 'cambio:peek-phase-end'
  | 'cambio:turn-start'
  | 'cambio:card-drawn-public'
  | 'cambio:card-discarded'
  | 'cambio:swap-completed'
  | 'cambio:ability-prompt'
  | 'cambio:blind-swap'
  | 'cambio:stick-success'
  | 'cambio:stick-fail'
  | 'cambio:cambio-called'
  | 'cambio:game-over';
