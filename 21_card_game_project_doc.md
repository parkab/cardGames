# Project Documentation: "21" Multiplayer Card Game Website

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Game Rules & Logic](#4-game-rules--logic)
5. [Pages & UI](#5-pages--ui)
6. [Component Breakdown](#6-component-breakdown)
7. [Backend & Real-Time Architecture](#7-backend--real-time-architecture)
8. [Data Models](#8-data-models)
9. [Game State Machine](#9-game-state-machine)
10. [API & WebSocket Events](#10-api--websocket-events)
11. [Solver Algorithm](#11-solver-algorithm)
12. [Deployment](#12-deployment)
13. [Edge Cases & Rules Clarifications](#13-edge-cases--rules-clarifications)

---

## 1. Project Overview

A browser-based multiplayer card game platform with a poker-themed aesthetic. The initial game offered is **"21"** — a fast-paced arithmetic puzzle where players race to find a mathematical expression using four dealt cards that equals exactly 21.

**Key characteristics:**
- Guest-based play with player-chosen nicknames (no account required)
- Lobby system using 4-letter room codes
- Real-time multiplayer via WebSockets
- 2–8 players per room
- Automatic solution validation and reshuffling for unsolvable hands
- Fixed 60-second countdown timer per round
- Skip voting (unanimous) and host migration

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | Next.js 14 (App Router) | SSR + client components, easy Vercel deploy |
| Styling | Tailwind CSS | Utility-first, fast theming |
| Real-time | Ably (managed WebSockets) | Generous free tier, Vercel-compatible, no persistent server needed |
| State (server) | Upstash Redis | Serverless-friendly key-value store for room/game state |
| Deployment | Vercel | Zero-config Next.js hosting |
| Language | TypeScript | Type safety across client and server |

> **Why Ably over raw WebSockets?** Vercel serverless functions are stateless and do not support long-lived WebSocket connections. Ably acts as a managed pub/sub layer, letting Next.js API routes publish events while clients subscribe via Ably's SDK.

> **Why Upstash Redis?** It offers a REST-compatible, serverless Redis instance that works perfectly with Vercel's edge/serverless functions for storing ephemeral room and game state.

---

## 3. Project Structure

```
/
├── app/
│   ├── page.tsx                  # Landing / homepage
│   ├── lobby/
│   │   └── [code]/
│   │       └── page.tsx          # Lobby waiting room
│   ├── game/
│   │   └── [code]/
│   │       └── page.tsx          # Active game screen
│   └── api/
│       ├── room/
│       │   ├── create/route.ts   # POST: create a new room
│       │   └── join/route.ts     # POST: join an existing room
│       ├── game/
│       │   ├── start/route.ts    # POST: host starts the game
│       │   ├── submit/route.ts   # POST: player submits a solution
│       │   ├── skip-vote/route.ts# POST: player votes to skip
│       │   └── tick/route.ts     # POST: called by a cron or client to advance timer
│       └── ably-token/route.ts   # GET: issues Ably auth token for client
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   └── PokerBackground.tsx
│   ├── home/
│   │   ├── GameCard.tsx          # Clickable game tile on homepage
│   │   └── HeroSection.tsx
│   ├── lobby/
│   │   ├── PlayerList.tsx
│   │   ├── RoomCodeDisplay.tsx
│   │   └── StartButton.tsx
│   ├── game/
│   │   ├── CardDisplay.tsx       # The 4 dealt cards
│   │   ├── SolutionInput.tsx     # Text input + submit button
│   │   ├── Scoreboard.tsx
│   │   ├── Timer.tsx
│   │   ├── SkipVoteButton.tsx
│   │   ├── EliminatedBanner.tsx
│   │   └── GameOverScreen.tsx
│   └── ui/
│       ├── Modal.tsx
│       ├── Button.tsx
│       └── Input.tsx
├── lib/
│   ├── ably.ts                   # Ably client + server helpers
│   ├── redis.ts                  # Upstash Redis client
│   ├── solver.ts                 # 21-solver algorithm
│   ├── deck.ts                   # Deck creation + shuffling
│   ├── validator.ts              # Solution string parser + evaluator
│   └── roomCode.ts               # 4-letter room code generator
├── types/
│   └── index.ts                  # Shared TypeScript types
└── hooks/
    ├── useAbly.ts                # Subscribes to room channel
    ├── useGameState.ts           # Derived game state from Ably events
    └── useTimer.ts               # Countdown timer hook
```

---

## 4. Game Rules & Logic

### 4.1 Card Values

| Card | Value |
|---|---|
| 2–10 | Face value (2–10) |
| Jack | 11 |
| Queen | 12 |
| King | 13 |
| Ace | 1 **or** 11 (whichever helps reach 21) |

A standard 52-card deck is used. Cards are shuffled at the start of the game and consumed as rounds are played. When the deck is exhausted or fewer than 4 cards remain, the game ends.

### 4.2 Round Flow

1. 4 cards are dealt from the top of the deck.
2. The server runs the solver algorithm against all possible expressions. If no solution exists, the cards are reshuffled back into the deck and 4 new cards are dealt. This repeats until a solvable hand is found.
3. Cards and a 60-second countdown are shown to all players.
4. Players type a mathematical expression in the solution input and submit.
5. The server validates the submission:
   - Must use each of the 4 card values **exactly once**.
   - Operators allowed: `+`, `-`, `*`, `/`.
   - Order of operations is **not applied** — the expression is evaluated strictly **left to right**.
   - Division must result in a whole number (no fractions allowed as final answers, though intermediate fractions may be produced depending on the evaluator — see Section 11).
   - The result must equal exactly **21**.
6. **Correct solution:** The submitting player earns 1 point. The 4 cards are discarded. A new round begins.
7. **Incorrect solution:** The submitting player is **eliminated for this round only** and sits out until the next round begins.
8. **Timer runs out:** No player earns a point. The 4 cards are reshuffled into the deck.
9. **Skip vote:** If all currently active (non-eliminated) players vote to skip, the round ends with no points awarded and the 4 cards are reshuffled into the deck.
10. **All players eliminated in a round:** The round ends with no winner; cards are reshuffled.

### 4.3 Game End Conditions

The game ends when:
- Fewer than 4 cards remain in the deck and no solvable hand can be formed, OR
- All 52 cards have been discarded (all rounds solved).

At game end, the player(s) with the highest score win.

### 4.4 Ace Handling

The Ace is treated as both 1 and 11 during solving and validation. When the server validates a player's submission, it tests the expression with the Ace as 1 AND as 11. If either yields 21 using the correct cards, it is accepted.

When displaying cards to players, show the Ace as "A" with a visual indicator like "1 / 11".

---

## 5. Pages & UI

### 5.1 Homepage (`/`)

**Theme:** Dark poker table aesthetic. Deep green (`#1a4a2e`) or dark felt-green background, gold accents (`#c9a84c`), red/black card suit motifs, subtle card texture overlay.

**Layout:**
- Full-height hero section with a poker table felt texture background.
- Site name / logo at the top (e.g., "Card Club" or your chosen brand name) in a serif or display font with gold styling.
- A tagline such as *"Play. Solve. Win."*
- Below the hero: a section titled **"Games"** with one clickable game tile for "21".

**Game Tile for "21":**
- Styled like a poker chip or casino placard.
- Shows the game name, a brief one-line description ("Make 21 with 4 cards"), and a player count indicator ("2–8 players").
- Clicking navigates to a modal or a dedicated `/play/21` route.

**Modal (triggered on clicking "21"):**
- Two large buttons: **"Create Lobby"** and **"Join Lobby"**.
- A nickname input field (required before either action, max 20 characters, alphanumeric + spaces).
- "Create Lobby" → generates a room code and redirects to `/lobby/[CODE]`.
- "Join Lobby" → shows a 4-letter code input field, then redirects to `/lobby/[CODE]` if the room exists and is not full / in-progress.

### 5.2 Lobby Waiting Room (`/lobby/[code]`)

**Theme:** Same poker aesthetic. Felt background, gold borders.

**Layout:**
- Room code displayed prominently at the top with a **"Copy"** button.
- List of players who have joined, showing nicknames. Host has a crown icon.
- Player count indicator (e.g., "3 / 8 players").
- A **"Start Game"** button, visible only to the host, enabled only when ≥ 2 players are present.
- A **"Leave"** button for all players.
- A short instructional blurb about how to play "21".

**Behavior:**
- The player list updates in real time as players join or leave.
- If the host leaves, the next player in the join order becomes the new host automatically.
- If a non-host player navigates away, they are removed from the lobby.
- The room code is displayed in all caps. Players share this code out-of-band to invite friends.

### 5.3 Game Screen (`/game/[code]`)

**Layout sections (top to bottom):**

1. **Header bar:** Room code, round number (e.g., "Round 4"), cards remaining in deck, timer.
2. **Card display:** 4 large playing cards shown face-up in the center.
3. **Solution input:** A text input field with placeholder like `e.g. 3 * 9 - 8 + 2`, a **Submit** button, and a **Vote to Skip** button.
4. **Player status panel:** All players listed with their score, and a visual indicator if they are eliminated this round (greyed out / strikethrough).
5. **Skip vote tracker:** Shows how many players have voted to skip (e.g., "2 / 4 voted to skip").

**Eliminated state (for the current player):**
- The solution input is disabled.
- A banner shows: *"You've been eliminated this round. You'll rejoin next round."*

**Timer:**
- A visible countdown from 60 to 0.
- Color shifts from green → yellow → red as time runs low (e.g., green above 30s, yellow 15–30s, red below 15s).
- When it hits 0, an animation plays and the round ends.

**Round result notification:**
- A brief full-screen or overlay toast/banner appears after each round:
  - "[Player] solved it! (+1 point)" in green, OR
  - "Time's up! No winner this round." in red/amber, OR
  - "Round skipped." in grey.

**Game over screen:**
- Replaces the game screen when the game ends.
- Shows final scores for all players in ranked order.
- Winner(s) highlighted.
- A **"Play Again"** button (returns to lobby) — only the host can trigger a new game; others see a waiting state.

---

## 6. Component Breakdown

### `CardDisplay`
- Receives an array of 4 card objects `{ suit, rank, displayValue }`.
- Renders each as a styled card with suit symbol (♠ ♥ ♦ ♣), rank, and color (red for hearts/diamonds, black/white for spades/clubs).
- Animate cards dealing in at the start of each round (slide + fade).

### `SolutionInput`
- Controlled text input.
- Only allows characters: digits 0–9, spaces, `+`, `-`, `*`, `/`, `(` `)` — though parentheses are optional/cosmetic since order of operations is ignored. Consider stripping them before evaluation.
- On submit, sends the raw expression string to the API.
- Disabled when the current player is eliminated or the round is over.

### `Timer`
- Accepts `secondsRemaining` prop.
- Displays MM:SS format.
- Color-coded ring or bar that depletes.
- Driven by local state initialized from server-side `roundStartedAt` timestamp to avoid drift.

### `Scoreboard`
- Lists all players sorted by score descending.
- Shows: rank, nickname, score, and round status (active / eliminated this round / disconnected).

### `SkipVoteButton`
- Shows current vote count vs. required (all active players).
- Toggles voted state for the current player.
- Disabled if already voted or already eliminated.

---

## 7. Backend & Real-Time Architecture

### 7.1 Overview

Because Vercel does not support persistent WebSocket servers, real-time communication is handled by **Ably**. Each room corresponds to an Ably channel named `room:[CODE]`. The Next.js API routes act as publishers; all clients subscribe to the channel.

```
Client A ──POST /api/game/submit──► Next.js API Route
                                        │
                                   validates solution
                                        │
                                   updates Redis state
                                        │
                                   publishes event to Ably channel "room:ABCD"
                                        │
          ◄────────────────────── Ably pushes event to all subscribed clients
Client B ◄──────────────────────── (Client A, B, C, D all receive update)
```

### 7.2 Ably Setup

- Each client requests a short-lived Ably token from `GET /api/ably-token`.
- The token scopes the client to their room channel.
- Clients use the Ably JS SDK to subscribe: `channel.subscribe(eventName, handler)`.
- The server uses the Ably REST SDK (in API routes) to publish events.

### 7.3 Redis State

All game and lobby state lives in Upstash Redis. Keys are prefixed by room code. See Section 8 for data models.

Redis is the source of truth. Ably events carry payloads so clients can update their local state without needing to re-fetch Redis on every event.

### 7.4 Timer Architecture

The timer is **client-side**, initialized from a server-provided `roundStartedAt` Unix timestamp stored in Redis and included in each round-start event. Each client computes `secondsRemaining = 60 - (Date.now() - roundStartedAt) / 1000`.

When the timer hits zero **on the client**, the client that is the current host sends a `POST /api/game/tick` to officially end the round. To prevent duplicate calls, the API route checks if the round is already over in Redis before acting.

> Alternative: Use Vercel Cron Jobs (1-minute minimum granularity) or Upstash QStash to schedule a round-end callback. For a 60-second timer, a QStash delayed message sent at round start is the most reliable approach.

---

## 8. Data Models

### 8.1 TypeScript Types (`types/index.ts`)

```typescript
type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A';

interface Card {
  suit: Suit;
  rank: Rank;
  value: number; // For Ace: stored as [1, 11]; others are fixed
}

interface Player {
  id: string;           // UUID assigned at session creation
  nickname: string;
  score: number;
  isHost: boolean;
  isConnected: boolean;
  joinedAt: number;     // Unix ms, used for host succession ordering
}

interface RoomState {
  code: string;
  status: 'lobby' | 'playing' | 'finished';
  players: Player[];
  hostId: string;
  createdAt: number;
}

interface GameState {
  deck: Card[];             // Remaining cards in the deck (ordered)
  discardPile: Card[];      // Cards already used in solved rounds
  currentHand: Card[];      // The 4 cards currently on the table
  roundNumber: number;
  roundStartedAt: number;   // Unix ms timestamp
  roundStatus: 'active' | 'solved' | 'timed_out' | 'skipped';
  eliminatedThisRound: string[];  // Player IDs eliminated this round
  skipVotes: string[];            // Player IDs who voted to skip
  winnerId: string | null;        // Player ID who solved this round
  scores: Record<string, number>; // playerId → score
}
```

### 8.2 Redis Key Schema

| Key | Type | Value |
|---|---|---|
| `room:{CODE}` | Hash | Serialized `RoomState` JSON |
| `game:{CODE}` | Hash | Serialized `GameState` JSON |
| `room:{CODE}:ttl` | String | Expiry marker — all keys expire 2 hours after last activity |

Set a TTL of 7200 seconds on all room keys. Refresh the TTL on any activity.

---

## 9. Game State Machine

```
[Lobby]
   │  host clicks Start Game (≥2 players)
   ▼
[Round Start]
   │  server deals 4 cards, runs solver
   │  if unsolvable → reshuffle and re-deal (loop)
   │  publish round:start event with cards + roundStartedAt
   ▼
[Round Active]  ◄─────────────────────────────────────────────────────┐
   │                                                                   │
   ├── player submits solution                                         │
   │     ├── correct → publish round:solved, award point              │
   │     │     └── → [Round End: Solved]                              │
   │     └── wrong → publish player:eliminated (for this round)       │
   │           └── if all players eliminated → [Round End: No Winner] │
   │                                                                   │
   ├── player votes to skip                                            │
   │     └── if all active (non-eliminated) players voted             │
   │           → publish round:skipped → [Round End: Skipped]         │
   │                                                                   │
   └── timer reaches 0                                                 │
         → publish round:timeout → [Round End: Timeout]               │
                                                                       │
[Round End]                                                            │
   │  update scores in Redis                                           │
   │  check game-over conditions:                                      │
   │    - deck has < 4 cards remaining                                 │
   │    - no solvable hand can be formed from remaining cards          │
   ├── game not over → wait 3 seconds → [Round Start] ────────────────┘
   └── game over → publish game:over → [Game Over]

[Game Over]
   │  show final scores
   └── host can start a new game → reset GameState → [Round Start]
```

---

## 10. API & WebSocket Events

### 10.1 REST API Routes

#### `POST /api/room/create`
**Body:** `{ nickname: string }`
**Response:** `{ roomCode: string, playerId: string }`
- Generates a unique 4-letter room code (all caps, retry if collision).
- Creates `RoomState` in Redis with the creator as host.
- Returns the room code and a UUID for the player (stored in a session cookie or localStorage).

#### `POST /api/room/join`
**Body:** `{ roomCode: string, nickname: string }`
**Response:** `{ success: boolean, playerId: string, roomState: RoomState }` or error
- Validates the room exists, is in `lobby` status, and has fewer than 8 players.
- Adds the player to `RoomState`.
- Publishes `room:player_joined` to the Ably channel.

#### `POST /api/game/start`
**Body:** `{ roomCode: string, playerId: string }`
**Response:** `{ success: boolean }`
- Validates the requester is the host.
- Initializes `GameState`: creates and shuffles a 52-card deck.
- Deals the first hand (with solver check and reshuffle loop).
- Sets `room.status = 'playing'`.
- Publishes `game:started` and `round:start` events.

#### `POST /api/game/submit`
**Body:** `{ roomCode: string, playerId: string, expression: string }`
**Response:** `{ correct: boolean, message?: string }`
- Validates the round is active and the player is not eliminated.
- Parses and evaluates the expression left-to-right.
- Checks that the numbers used in the expression exactly match the 4 card values (with Ace dual-value support).
- If correct: awards point, discards cards, publishes `round:solved`, advances round.
- If incorrect: marks player as eliminated this round, publishes `player:eliminated`.

#### `POST /api/game/skip-vote`
**Body:** `{ roomCode: string, playerId: string }`
**Response:** `{ success: boolean, voteCount: number, required: number }`
- Records the skip vote for this player.
- If all active (non-eliminated, connected) players have voted: ends round, reshuffles cards, publishes `round:skipped`.

#### `POST /api/game/tick`
**Body:** `{ roomCode: string, playerId: string }`
**Response:** `{ success: boolean }`
- Called by the host client when their local timer hits 0.
- Server checks if the round is still active (guards against duplicate calls).
- If active: reshuffles the current hand back into the deck, publishes `round:timeout`, advances to next round or ends game.

#### `GET /api/ably-token`
**Query:** `?roomCode=ABCD&playerId=...`
**Response:** Ably `TokenRequest` object
- Issues a capability-scoped token for `room:ABCD` channel only.

### 10.2 Ably Event Payloads (Server → Clients)

All events are published to the channel `room:{CODE}`.

| Event Name | Payload |
|---|---|
| `room:player_joined` | `{ player: Player }` |
| `room:player_left` | `{ playerId: string, newHostId?: string }` |
| `game:started` | `{ gameState: GameState }` |
| `round:start` | `{ roundNumber: number, cards: Card[], roundStartedAt: number, deckRemaining: number }` |
| `round:solved` | `{ winnerId: string, winnerNickname: string, scores: Record<string, number> }` |
| `round:timeout` | `{ scores: Record<string, number> }` |
| `round:skipped` | `{ scores: Record<string, number> }` |
| `player:eliminated` | `{ playerId: string, nickname: string, eliminatedThisRound: string[] }` |
| `skip:vote_update` | `{ skipVotes: string[], required: number }` |
| `game:over` | `{ finalScores: Record<string, number>, players: Player[] }` |

---

## 11. Solver Algorithm

The solver must determine whether any combination of the 4 card values can equal 21 using `+`, `-`, `*`, `/` evaluated strictly left-to-right (no order of operations).

### 11.1 Left-to-Right Evaluation

Left-to-right evaluation means `3 * 9 - 8 + 2` is computed as:
```
3 * 9 = 27
27 - 8 = 19
19 + 2 = 21  ✓
```
This is **not** standard mathematical order of operations.

### 11.2 Algorithm

```typescript
// lib/solver.ts

const OPERATORS = ['+', '-', '*', '/'] as const;
type Op = typeof OPERATORS[number];

function applyOp(a: number, op: Op, b: number): number | null {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b !== 0 ? a / b : null; // null = invalid
  }
}

function evalLeftToRight(nums: number[], ops: Op[]): number | null {
  let result = nums[0];
  for (let i = 0; i < ops.length; i++) {
    const next = applyOp(result, ops[i], nums[i + 1]);
    if (next === null) return null;
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

function* opCombinations(n: number): Generator<Op[]> {
  // All n-length arrays of operators (4^n combinations)
  const ops = OPERATORS;
  function* helper(current: Op[]): Generator<Op[]> {
    if (current.length === n) { yield current; return; }
    for (const op of ops) yield* helper([...current, op]);
  }
  yield* helper([]);
}

export function canSolve(cards: Card[]): boolean {
  const values = expandAceValues(cards); // returns array of value-arrays for each card
  // Try all combinations of concrete values for each card (Ace can be 1 or 11)
  for (const nums of cartesianProduct(values)) {
    for (const perm of permutations(nums)) {
      for (const ops of opCombinations(3)) {
        const result = evalLeftToRight(perm, ops);
        if (result === 21) return true;
      }
    }
  }
  return false;
}

export function findSolution(cards: Card[]): string | null {
  const values = expandAceValues(cards);
  for (const nums of cartesianProduct(values)) {
    for (const perm of permutations(nums)) {
      for (const ops of opCombinations(3)) {
        if (evalLeftToRight(perm, ops) === 21) {
          return `${perm[0]} ${ops[0]} ${perm[1]} ${ops[1]} ${perm[2]} ${ops[2]} ${perm[3]}`;
        }
      }
    }
  }
  return null;
}
```

**Complexity:** 4! permutations × 4³ operator combinations × Ace variants = at most 24 × 64 × 2 = 3,072 evaluations per hand. This is negligible — runs in microseconds.

### 11.3 Solution Validator

When a player submits a solution string like `"3 * 9 - 8 + 2"`:

1. Tokenize the string into numbers and operators.
2. Verify it has exactly 4 numbers and 3 operators.
3. Verify the multiset of numbers matches the multiset of card values (accounting for Ace = 1 or 11).
4. Evaluate left-to-right.
5. Check result === 21.

```typescript
// lib/validator.ts
export function validateSolution(expression: string, cards: Card[]): boolean {
  const tokens = expression.trim().split(/\s+/);
  if (tokens.length !== 7) return false; // 4 numbers, 3 operators interleaved

  const numbers = tokens.filter((_, i) => i % 2 === 0).map(Number);
  const operators = tokens.filter((_, i) => i % 2 === 1) as Op[];

  if (numbers.some(isNaN)) return false;
  if (operators.some(op => !OPERATORS.includes(op))) return false;

  // Check numbers match card values (with Ace flexibility)
  if (!numbersMatchCards(numbers, cards)) return false;

  return evalLeftToRight(numbers, operators) === 21;
}
```

---

## 12. Deployment

### 12.1 Environment Variables

Create a `.env.local` for development and add the same to Vercel's environment variable settings.

```
ABLY_API_KEY=your_ably_api_key_here
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token_here
```

### 12.2 Vercel Setup

1. Push the repository to GitHub.
2. Import the project in Vercel.
3. Add the three environment variables above.
4. Deploy. Next.js is auto-detected; no special build config needed.

### 12.3 Ably Setup

1. Create a free account at [ably.com](https://ably.com).
2. Create an app and copy the **Root API Key** into `ABLY_API_KEY`.
3. The server uses the key to publish and issue tokens. Clients use tokens (never the raw key).

### 12.4 Upstash Redis Setup

1. Create a free account at [upstash.com](https://upstash.com).
2. Create a Redis database (select the region closest to your Vercel deployment region).
3. Copy the REST URL and REST token into the env vars above.

### 12.5 NPM Packages to Install

```bash
npm install ably @upstash/redis uuid
npm install -D @types/uuid
```

---

## 13. Edge Cases & Rules Clarifications

| Scenario | Behavior |
|---|---|
| Host disconnects mid-game | The player with the earliest `joinedAt` timestamp among remaining connected players becomes the new host. A `room:player_left` event with `newHostId` is published. |
| All players disconnect | Room state persists in Redis for 2 hours, then expires. If players reconnect with the same `playerId` (from cookie/localStorage) within that window, they rejoin seamlessly. |
| Player tries to join a game in progress | The join API returns an error: "Game already in progress." |
| Duplicate room code on creation | The creation API retries with a new random code (up to 5 attempts, then returns an error). |
| Player submits an expression with division resulting in a non-integer along the way | Allowed — only the final result must equal 21. E.g., `3 / 2 * 14 = 21` is valid (3/2 = 1.5, 1.5 * 14 = 21). |
| Ace in a solution | The validator tries the Ace as both 1 and 11. If either interpretation produces a valid solution, it is accepted. |
| Only 1 player remains (others disconnected) | The game continues; that player competes against the timer for points. |
| Player rejoins mid-round after a disconnect | They rejoin as active but are not retroactively eliminated for the current round even if they were gone during it. |
| 60-second timer expires while skip vote is pending | Timer takes priority — round ends as a timeout, not a skip. Skip votes are reset. |
| Nickname conflict in a room | Allow duplicates but append a number suffix on the UI side (e.g., "Alex" and "Alex (2)") so players can tell them apart. |
| Player submits the same wrong answer twice | Allowed — the player is already eliminated after the first wrong answer; subsequent submissions are ignored (input is disabled). |
| New game after game over | Host clicks "Play Again" → `GameState` is reset (new shuffled deck, scores zeroed, all players re-activated) → returns to lobby screen → host can start when ready. |

---

*End of documentation.*
