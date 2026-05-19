'use client';

import { useEffect, useState, useRef } from 'react';
import { useAbly } from './useAbly';
import { findAllSolutions } from '@/lib/solver';
import type {
  RoomState,
  GameState,
  Card,
  Player,
  RoomSettings,
  RoundStartPayload,
  RoundSolvedPayload,
  RoundEndPayload,
  PlayerEliminatedPayload,
  SkipVoteUpdatePayload,
  GameOverPayload,
  EndVoteUpdatePayload,
} from '@/types';

interface UseGameStateOptions {
  roomCode: string;
  playerId: string;
  initialRoom: RoomState;
  initialGame: GameState;
}

type SolverSettings = Partial<Pick<RoomSettings, 'modAllowed' | 'fractionsAllowed' | 'targetNumber'>>;

export function useGameState({ roomCode, playerId, initialRoom, initialGame }: UseGameStateOptions) {
  const [room, setRoom] = useState<RoomState>(initialRoom);
  const [game, _setGame] = useState<GameState>(initialGame);
  const gameRef = useRef<GameState>(initialGame);
  const settingsRef = useRef<SolverSettings | undefined>(initialRoom?.settings);

  // Wrapper that keeps gameRef in sync
  function setGame(updater: (prev: GameState) => GameState) {
    _setGame((prev) => {
      const next = updater(prev);
      gameRef.current = next;
      return next;
    });
  }

  // Re-sync when real initial data first arrives (useState ignores subsequent initialValue changes)
  useEffect(() => {
    if (roomCode && initialGame?.roundStatus) {
      setRoom(initialRoom);
      _setGame(initialGame);
      gameRef.current = initialGame;
      settingsRef.current = initialRoom?.settings;
      setDeckRemaining(initialGame?.deck?.length ?? 0);
    }
  }, [roomCode, initialGame?.roundStatus]);

  useEffect(() => {
    settingsRef.current = initialRoom?.settings;
  }, [initialRoom?.settings]);

  const [notification, setNotification] = useState<string | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [finalData, setFinalData] = useState<GameOverPayload | null>(null);
  const [solutions, setSolutions] = useState<string[]>([]);
  const [showSolutions, setShowSolutions] = useState(false);
  const [winningExpression, setWinningExpression] = useState<string | null>(null);
  const [deckRemaining, setDeckRemaining] = useState(initialGame?.deck?.length ?? 0);
  const solutionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { subscribe, unsubscribe, connected } = useAbly(roomCode, playerId);

  function revealSolutions() {
    const hand: Card[] = gameRef.current?.currentHand ?? [];
    if (hand.length === 0) return;
    const sols = findAllSolutions(hand, settingsRef.current);
    setSolutions(sols);
    setShowSolutions(true);
    if (solutionTimerRef.current) clearTimeout(solutionTimerRef.current);
    solutionTimerRef.current = setTimeout(() => {
      setShowSolutions(false);
      setNotification(null);
    }, 10000);
  }

  useEffect(() => {
    subscribe('game:started', (data) => {
      const { gameState: newGame, settings: newSettings } = data as { gameState: GameState; settings?: RoomSettings };
      // Reset all game-over and round state for a fresh game
      setIsGameOver(false);
      setFinalData(null);
      setNotification(null);
      setSolutions([]);
      setShowSolutions(false);
      setWinningExpression(null);
      if (solutionTimerRef.current) clearTimeout(solutionTimerRef.current);
      if (newSettings) {
        setRoom((prev) => ({ ...prev, settings: newSettings }));
        settingsRef.current = newSettings;
      }
      setGame(() => newGame);
      setDeckRemaining(newGame.deck?.length ?? 0);
    });

    subscribe('room:player_joined', (data) => {
      const { player } = data as { player: Player };
      setRoom((prev) => ({
        ...prev,
        players: prev.players.find((p) => p.id === player.id)
          ? prev.players
          : [...prev.players, player],
      }));
    });

    subscribe('room:player_left', (data) => {
      const { playerId: leftId, newHostId } = data as { playerId: string; newHostId?: string };
      setRoom((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.id === leftId ? { ...p, isConnected: false } : p
        ),
        hostId: newHostId ?? prev.hostId,
      }));
    });

    subscribe('round:start', (data) => {
      const payload = data as RoundStartPayload;
      setDeckRemaining(payload.deckRemaining);
      setWinningExpression(null);
      setGame((prev) => ({
        ...prev,
        currentHand: payload.cards,
        roundNumber: payload.roundNumber,
        roundStartedAt: payload.roundStartedAt,
        roundStatus: 'active',
        eliminatedThisRound: [],
        skipVotes: [],
        endVotes: [],
        winnerId: null,
      }));
      // Keep notification visible (shows who won / "time's up" during the buffer)
    });

    subscribe('round:solved', (data) => {
      const payload = data as RoundSolvedPayload;
      setWinningExpression(payload.expression);
      revealSolutions();
      setGame((prev) => ({
        ...prev,
        roundStatus: 'solved',
        scores: payload.scores,
        winnerId: payload.winnerId,
      }));
      setNotification(`${payload.winnerNickname} solved it! +1 point`);
    });

    subscribe('round:timeout', (data) => {
      const payload = data as RoundEndPayload;
      revealSolutions();
      setGame((prev) => ({ ...prev, roundStatus: 'timed_out', scores: payload.scores }));
      setNotification("Time's up! No winner this round.");
    });

    subscribe('round:skipped', (data) => {
      const payload = data as RoundEndPayload;
      revealSolutions();
      setGame((prev) => ({ ...prev, roundStatus: 'skipped', scores: payload.scores }));
      setNotification('Round skipped.');
    });

    subscribe('player:eliminated', (data) => {
      const payload = data as PlayerEliminatedPayload;
      setGame((prev) => ({
        ...prev,
        eliminatedThisRound: payload.eliminatedThisRound,
      }));
    });

    subscribe('skip:vote_update', (data) => {
      const payload = data as SkipVoteUpdatePayload;
      setGame((prev) => ({ ...prev, skipVotes: payload.skipVotes }));
    });

    subscribe('game:end_vote', (data) => {
      const payload = data as EndVoteUpdatePayload;
      setGame((prev) => ({ ...prev, endVotes: payload.endVotes }));
    });

    subscribe('game:over', (data) => {
      const payload = data as GameOverPayload;
      setIsGameOver(true);
      setFinalData(payload);
    });

    return () => {
      unsubscribe('game:started');
      unsubscribe('room:player_joined');
      unsubscribe('room:player_left');
      unsubscribe('round:start');
      unsubscribe('round:solved');
      unsubscribe('round:timeout');
      unsubscribe('round:skipped');
      unsubscribe('player:eliminated');
      unsubscribe('skip:vote_update');
      unsubscribe('game:end_vote');
      unsubscribe('game:over');
    };
  }, [roomCode, playerId]);

  return { room, game, notification, isGameOver, finalData, connected, solutions, showSolutions, winningExpression, deckRemaining };
}
