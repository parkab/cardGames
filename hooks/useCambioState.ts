'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAbly } from './useAbly';
import type {
  Card,
  CambioPhase,
  CambioStartedPayload,
  CambioTurnStartPayload,
  CambioCardDrawnPublicPayload,
  CambioCardDiscardedPayload,
  CambioSwapCompletedPayload,
  CambioBlindSwapPayload,
  CambioStickSuccessPayload,
  CambioStickFailPayload,
  CambioCalledPayload,
  CambioGameOverPayload,
} from '@/types';

export interface CambioHandSlot {
  hasCard: boolean;
  card?: Card;
  revealed?: boolean;
}

export interface CambioPlayerState {
  id: string;
  nickname: string;
  isHost: boolean;
  isConnected: boolean;
  hasCalledCambio: boolean;
  handSlots: CambioHandSlot[];
}

export interface PeekReveal {
  targetPlayerId: string;
  cardIndex: number;
  card: Card;
  expiry: number; // ms
}

interface UseCambioStateOptions {
  roomCode: string;
  playerId: string;
  initialState: {
    phase: CambioPhase;
    currentTurnPlayerId: string;
    turnStartedAt: number;
    peekUntil: number;
    deckRemaining: number;
    discardPile: Card[];
    players: Array<{
      id: string;
      nickname: string;
      isHost: boolean;
      isConnected: boolean;
      hasCalledCambio: boolean;
      handSlots: (boolean | null | Card)[];
      handSize: number;
    }>;
    cambioCallerId: string | null;
    finalTurnsRemaining: number;
    initialPeekCards?: (Card | null)[] | null;
  };
}

function buildHandSlots(raw: (boolean | null | Card)[]): CambioHandSlot[] {
  return raw.map((slot) => {
    if (slot === null) return { hasCard: false };
    if (slot === true) return { hasCard: true };
    return { hasCard: true, card: slot as Card };
  });
}

export function useCambioState({ roomCode, playerId, initialState }: UseCambioStateOptions) {
  const [phase, setPhase] = useState<CambioPhase>(initialState.phase);
  const [currentTurnPlayerId, setCurrentTurnPlayerId] = useState(initialState.currentTurnPlayerId);
  const [turnStartedAt, setTurnStartedAt] = useState(initialState.turnStartedAt);
  const [peekUntil] = useState(initialState.peekUntil);
  const [deckRemaining, setDeckRemaining] = useState(initialState.deckRemaining);
  const [discardPile, setDiscardPile] = useState<Card[]>(initialState.discardPile);
  const [cambioCallerId, setCambioCallerId] = useState<string | null>(initialState.cambioCallerId);
  const [finalTurnsRemaining, setFinalTurnsRemaining] = useState(initialState.finalTurnsRemaining);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameOverData, setGameOverData] = useState<CambioGameOverPayload | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Peek reveals (temporary card value displays)
  const [peekReveals, setPeekReveals] = useState<PeekReveal[]>(() => {
    // Initial peek phase: reveal bottom 2 cards (indices 2 and 3)
    if (initialState.phase === 'initial-peek' && initialState.initialPeekCards) {
      const cards = initialState.initialPeekCards;
      const now = Date.now();
      const revs: PeekReveal[] = [];
      [2, 3].forEach((idx) => {
        const c = cards[idx - 2]; // initialPeekCards[0] = slot 2, [1] = slot 3
        if (c) revs.push({ targetPlayerId: playerId, cardIndex: idx, card: c, expiry: initialState.peekUntil });
      });
      return revs;
    }
    return [];
  });

  // Player hands — start from initial state
  const [players, setPlayers] = useState<CambioPlayerState[]>(() =>
    initialState.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      isHost: p.isHost,
      isConnected: p.isConnected,
      hasCalledCambio: p.hasCalledCambio,
      handSlots: buildHandSlots(p.handSlots as (boolean | null | Card)[]),
    }))
  );

  const { subscribe, unsubscribe, connected } = useAbly(roomCode, playerId);

  // Clean up expired peek reveals
  useEffect(() => {
    if (peekReveals.length === 0) return;
    const next = Math.min(...peekReveals.map((r) => r.expiry));
    const delay = Math.max(0, next - Date.now());
    const timer = setTimeout(() => {
      const now = Date.now();
      setPeekReveals((prev) => prev.filter((r) => r.expiry > now));
    }, delay + 50);
    return () => clearTimeout(timer);
  }, [peekReveals]);

  // Transition from initial-peek to turn-draw when peek window expires
  useEffect(() => {
    if (phase !== 'initial-peek') return;
    const delay = Math.max(0, peekUntil - Date.now());
    const timer = setTimeout(() => setPhase('turn-draw'), delay + 100);
    return () => clearTimeout(timer);
  }, [phase, peekUntil]);

  // Helper: add a peek reveal with 5-second duration
  const addPeekReveal = useCallback((targetPlayerId: string, cardIndex: number, card: Card, durationMs = 5000) => {
    setPeekReveals((prev) => [
      ...prev.filter((r) => !(r.targetPlayerId === targetPlayerId && r.cardIndex === cardIndex)),
      { targetPlayerId, cardIndex, card, expiry: Date.now() + durationMs },
    ]);
  }, []);

  // Check if a hand slot has an active peek reveal
  const getPeekReveal = useCallback((targetPlayerId: string, cardIndex: number): Card | undefined => {
    return peekReveals.find((r) => r.targetPlayerId === targetPlayerId && r.cardIndex === cardIndex && r.expiry > Date.now())?.card;
  }, [peekReveals]);

  useEffect(() => {
    subscribe('cambio:started', (data) => {
      const payload = data as CambioStartedPayload;
      setCurrentTurnPlayerId(payload.firstTurnPlayerId);
      setTurnStartedAt(payload.turnStartedAt);
      setDeckRemaining(payload.deckRemaining);
    });

    subscribe('cambio:turn-start', (data) => {
      const payload = data as CambioTurnStartPayload;
      setCurrentTurnPlayerId(payload.currentPlayerId);
      setTurnStartedAt(payload.turnStartedAt);
      setDeckRemaining(payload.deckRemaining);
      setPhase(payload.phase);
      setFinalTurnsRemaining(payload.finalTurnsRemaining);
      setNotification(null);
    });

    subscribe('cambio:card-drawn-public', (data) => {
      const payload = data as CambioCardDrawnPublicPayload;
      setDeckRemaining(payload.deckRemaining);
      setPhase('turn-decide');
    });

    subscribe('cambio:card-discarded', (data) => {
      const payload = data as CambioCardDiscardedPayload;
      setDiscardPile((prev) => [...prev, payload.card]);
      setPhase(payload.phase);
    });

    subscribe('cambio:swap-completed', (data) => {
      const payload = data as CambioSwapCompletedPayload;
      setDiscardPile((prev) => [...prev, payload.discardedCard]);
      setDeckRemaining(payload.deckRemaining);
      setPhase('turn-draw');
      // Update swapping player's hand slot
      setPlayers((prev) => prev.map((p) => {
        if (p.id !== payload.playerId) return p;
        const slots = [...p.handSlots];
        slots[payload.swappedOutCardIndex] = { hasCard: true }; // new card face-down
        return { ...p, handSlots: slots };
      }));
    });

    subscribe('cambio:blind-swap', (data) => {
      const payload = data as CambioBlindSwapPayload;
      setPlayers((prev) => prev.map((p) => {
        if (p.id === payload.player1Id || p.id === payload.player2Id) {
          // Just update slot presence; card values remain unknown to observer
          return { ...p, handSlots: [...p.handSlots] };
        }
        return p;
      }));
      setNotification('Cards swapped.');
      setTimeout(() => setNotification(null), 3000);
    });

    subscribe('cambio:stick-success', (data) => {
      const payload = data as CambioStickSuccessPayload;
      // Remove stuck card from target's hand
      setPlayers((prev) => prev.map((p) => {
        if (p.id === payload.targetPlayerId) {
          const slots = [...p.handSlots];
          slots[payload.cardIndex] = { hasCard: false };
          // Handle transfer in
          if (payload.transferToTargetIndex !== undefined) {
            while (slots.length <= payload.transferToTargetIndex) slots.push({ hasCard: false });
            slots[payload.transferToTargetIndex] = { hasCard: true };
          }
          return { ...p, handSlots: slots };
        }
        if (p.id === payload.stickerId && payload.transferFromStickerId !== undefined) {
          const slots = [...p.handSlots];
          slots[payload.transferFromStickerId] = { hasCard: false };
          return { ...p, handSlots: slots };
        }
        return p;
      }));
      setDiscardPile((prev) => [...prev, payload.card]);
      const stickerNick = (players.find((p) => p.id === payload.stickerId))?.nickname ?? payload.stickerId;
      setNotification(`${stickerNick} stuck a card! ✓`);
      setTimeout(() => setNotification(null), 3000);
    });

    subscribe('cambio:stick-fail', (data) => {
      const payload = data as CambioStickFailPayload;
      if (payload.stickerId === playerId) {
        setNotification('Wrong! Penalty card added.');
      } else {
        const nick = (players.find((p) => p.id === payload.stickerId))?.nickname ?? payload.stickerId;
        setNotification(`${nick} missed a stick — penalty card!`);
      }
      // Add a penalty card slot to the sticker's hand
      setPlayers((prev) => prev.map((p) => {
        if (p.id !== payload.stickerId) return p;
        return { ...p, handSlots: [...p.handSlots, { hasCard: true }] };
      }));
      setTimeout(() => setNotification(null), 3000);
    });

    subscribe('cambio:cambio-called', (data) => {
      const payload = data as CambioCalledPayload;
      setCambioCallerId(payload.callerId);
      setFinalTurnsRemaining(payload.finalTurnsRemaining);
      setPhase('final-round');
      const callerNick = (players.find((p) => p.id === payload.callerId))?.nickname ?? payload.callerId;
      setNotification(`${callerNick} called Cambio! ${payload.finalTurnsRemaining} turn(s) left.`);
      // Mark caller in player list
      setPlayers((prev) => prev.map((p) =>
        p.id === payload.callerId ? { ...p, hasCalledCambio: true } : p
      ));
    });

    subscribe('cambio:game-over', (data) => {
      const payload = data as CambioGameOverPayload;
      setIsGameOver(true);
      setGameOverData(payload);
      setPhase('game-over');
    });

    subscribe('room:player_joined', (data) => {
      const { player } = data as { player: { id: string; nickname: string; isHost: boolean; isConnected: boolean } };
      setPlayers((prev) => {
        if (prev.find((p) => p.id === player.id)) return prev;
        return [...prev, { ...player, hasCalledCambio: false, handSlots: [] }];
      });
    });

    subscribe('room:player_left', (data) => {
      const { playerId: leftId, newHostId } = data as { playerId: string; newHostId?: string };
      setPlayers((prev) => prev.map((p) => {
        if (p.id === leftId) return { ...p, isConnected: false };
        if (newHostId && p.id === newHostId) return { ...p, isHost: true };
        return p;
      }));
    });

    return () => {
      unsubscribe('cambio:started');
      unsubscribe('cambio:turn-start');
      unsubscribe('cambio:card-drawn-public');
      unsubscribe('cambio:card-discarded');
      unsubscribe('cambio:swap-completed');
      unsubscribe('cambio:blind-swap');
      unsubscribe('cambio:stick-success');
      unsubscribe('cambio:stick-fail');
      unsubscribe('cambio:cambio-called');
      unsubscribe('cambio:game-over');
      unsubscribe('room:player_joined');
      unsubscribe('room:player_left');
    };
  }, [roomCode, playerId]);

  // Build enriched players (with peek reveals applied)
  const enrichedPlayers: CambioPlayerState[] = players.map((p) => ({
    ...p,
    handSlots: p.handSlots.map((slot, idx) => {
      if (!slot.hasCard) return slot;
      const peeked = getPeekReveal(p.id, idx);
      if (peeked) return { hasCard: true, card: peeked, revealed: true };
      return slot;
    }),
  }));

  return {
    phase,
    currentTurnPlayerId,
    turnStartedAt,
    peekUntil,
    deckRemaining,
    discardPile,
    players: enrichedPlayers,
    cambioCallerId,
    finalTurnsRemaining,
    isGameOver,
    gameOverData,
    notification,
    connected,
    addPeekReveal,
    setPhase,
    setPlayers,
    setDiscardPile,
    setDeckRemaining,
  };
}
