import { NextRequest, NextResponse } from 'next/server';
import { getCambioState, setCambioState } from '@/lib/redis';
import { publishToRoom } from '@/lib/ably';
import { nextTurnIndex } from '@/lib/cambio';
import type { CambioGameState } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const {
      roomCode,
      playerId,
      type,
      cardIndex,
      targetPlayerId,
      targetCardIndex,
      myCardIndex,
      skip,
    } = await req.json();

    const rawCambio = await getCambioState(roomCode);
    if (!rawCambio) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
    const cs: CambioGameState = typeof rawCambio === 'string' ? JSON.parse(rawCambio) : rawCambio as CambioGameState;

    if (cs.players[cs.currentTurnIndex].id !== playerId) {
      return NextResponse.json({ error: 'Not your turn.' }, { status: 403 });
    }

    const myPlayer = cs.players.find((p) => p.id === playerId)!;

    // ─── Ability: 9 — peek own card ──────────────────────────────────────────
    if (type === 'peek-own' || cs.phase === 'ability-9') {
      if (cardIndex === undefined || cardIndex < 0 || cardIndex >= myPlayer.hand.length || myPlayer.hand[cardIndex] === null) {
        return NextResponse.json({ error: 'Invalid card index.' }, { status: 400 });
      }
      const peekedCard = myPlayer.hand[cardIndex]!;
      await advanceTurn(cs, roomCode);
      // Return peeked card privately in HTTP response
      return NextResponse.json({ card: peekedCard, slot: cardIndex });
    }

    // ─── Ability: 10 — peek opponent ─────────────────────────────────────────
    if (type === 'peek-opponent' || cs.phase === 'ability-10') {
      const target = cs.players.find((p) => p.id === targetPlayerId);
      if (!target) return NextResponse.json({ error: 'Target not found.' }, { status: 400 });
      if (targetCardIndex === undefined || targetCardIndex < 0 || targetCardIndex >= target.hand.length || target.hand[targetCardIndex] === null) {
        return NextResponse.json({ error: 'Invalid target card.' }, { status: 400 });
      }
      const peekedCard = target.hand[targetCardIndex]!;
      await advanceTurn(cs, roomCode);
      return NextResponse.json({ card: peekedCard, targetPlayerId, slot: targetCardIndex });
    }

    // ─── Ability: Jack — blind swap (optional) ───────────────────────────────
    if (type === 'blind-swap' || cs.phase === 'ability-jack') {
      if (skip) {
        await advanceTurn(cs, roomCode);
        return NextResponse.json({ success: true, skipped: true });
      }
      if (myCardIndex === undefined || targetPlayerId === undefined || targetCardIndex === undefined) {
        return NextResponse.json({ error: 'Missing swap parameters.' }, { status: 400 });
      }
      const target = cs.players.find((p) => p.id === targetPlayerId);
      if (!target) return NextResponse.json({ error: 'Target not found.' }, { status: 400 });
      if (myPlayer.hand[myCardIndex] === null || target.hand[targetCardIndex] === null) {
        return NextResponse.json({ error: 'Invalid swap target.' }, { status: 400 });
      }
      // Swap without looking
      const tmp = myPlayer.hand[myCardIndex];
      myPlayer.hand[myCardIndex] = target.hand[targetCardIndex];
      target.hand[targetCardIndex] = tmp;

      await advanceTurn(cs, roomCode);
      await publishToRoom(roomCode, 'cambio:blind-swap', {
        player1Id: playerId,
        card1Index: myCardIndex,
        player2Id: targetPlayerId,
        card2Index: targetCardIndex,
      });
      return NextResponse.json({ success: true });
    }

    // ─── Ability: Queen — peek then optionally swap ───────────────────────────
    if (type === 'queen-peek' || cs.phase === 'ability-queen-peek') {
      const target = cs.players.find((p) => p.id === targetPlayerId);
      if (!target) return NextResponse.json({ error: 'Target not found.' }, { status: 400 });
      if (targetCardIndex === undefined || targetCardIndex < 0 || target.hand[targetCardIndex] === null) {
        return NextResponse.json({ error: 'Invalid target card.' }, { status: 400 });
      }
      const peekedCard = target.hand[targetCardIndex]!;
      // Store peek info server-side for the decide phase
      cs.pendingAbility = {
        type: 'queen',
        playerId,
        peekedTargetPlayerId: targetPlayerId,
        peekedTargetCardIndex: targetCardIndex,
        peekedCard,
      };
      cs.phase = 'ability-queen-decide';
      await setCambioState(roomCode, cs);
      await publishToRoom(roomCode, 'cambio:ability-prompt', { phase: 'ability-queen-decide', playerId });
      // Return peeked card privately
      return NextResponse.json({ card: peekedCard, targetPlayerId, slot: targetCardIndex });
    }

    // ─── Ability: Queen decide — swap or skip ────────────────────────────────
    if (type === 'queen-decide' || cs.phase === 'ability-queen-decide') {
      if (skip || myCardIndex === undefined) {
        // Skip — no swap
        cs.pendingAbility = null;
        await advanceTurn(cs, roomCode);
        return NextResponse.json({ success: true, skipped: true });
      }
      const pending = cs.pendingAbility;
      if (!pending?.peekedTargetPlayerId || pending.peekedTargetCardIndex === undefined) {
        return NextResponse.json({ error: 'No pending peek.' }, { status: 409 });
      }
      const target = cs.players.find((p) => p.id === pending.peekedTargetPlayerId!);
      if (!target) return NextResponse.json({ error: 'Target gone.' }, { status: 400 });
      if (myPlayer.hand[myCardIndex] === null) return NextResponse.json({ error: 'Invalid own card.' }, { status: 400 });

      const displaced = myPlayer.hand[myCardIndex];
      myPlayer.hand[myCardIndex] = target.hand[pending.peekedTargetCardIndex!];
      target.hand[pending.peekedTargetCardIndex!] = displaced;

      cs.pendingAbility = null;
      await advanceTurn(cs, roomCode);
      await publishToRoom(roomCode, 'cambio:blind-swap', {
        player1Id: playerId,
        card1Index: myCardIndex,
        player2Id: pending.peekedTargetPlayerId,
        card2Index: pending.peekedTargetCardIndex,
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown ability type.' }, { status: 400 });
  } catch (err) {
    console.error('[cambio/ability]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

async function advanceTurn(cs: CambioGameState, roomCode: string) {
  cs.pendingAbility = null;
  const nextIdx = nextTurnIndex(cs.currentTurnIndex, cs.players);
  cs.currentTurnIndex = nextIdx;
  cs.turnStartedAt = Date.now();

  let nextPhase: 'turn-draw' | 'final-round' = 'turn-draw';
  if (cs.cambioCallerId && cs.finalTurnsRemaining > 0) {
    cs.finalTurnsRemaining -= 1;
    if (cs.finalTurnsRemaining === 0) {
      const { computeScores, determineWinners } = await import('@/lib/cambio');
      const scores = computeScores(cs.players);
      const winnerIds = determineWinners(cs.players, scores, cs.cambioCallerId);
      cs.phase = 'game-over';
      const finalHands: Record<string, typeof cs.players[0]['hand']> = {};
      cs.players.forEach((p) => { finalHands[p.id] = p.hand; });
      await setCambioState(roomCode, cs);
      await publishToRoom(roomCode, 'cambio:game-over', {
        finalHands, scores, winnerIds, callerId: cs.cambioCallerId, players: cs.players,
      });
      return;
    }
    cs.phase = 'final-round';
    nextPhase = 'final-round';
  } else {
    cs.phase = 'turn-draw';
  }

  await setCambioState(roomCode, cs);
  await publishToRoom(roomCode, 'cambio:turn-start', {
    currentPlayerId: cs.players[cs.currentTurnIndex].id,
    turnStartedAt: cs.turnStartedAt,
    deckRemaining: cs.deck.length,
    phase: nextPhase,
    finalTurnsRemaining: cs.finalTurnsRemaining,
  });
}
