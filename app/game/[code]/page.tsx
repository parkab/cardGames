'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import PokerBackground from '@/components/layout/PokerBackground';
import Navbar from '@/components/layout/Navbar';
import CardDisplay from '@/components/game/CardDisplay';
import Timer from '@/components/game/Timer';
import Scoreboard from '@/components/game/Scoreboard';
import SolutionInput from '@/components/game/SolutionInput';
import EliminatedBanner from '@/components/game/EliminatedBanner';
import GameOverScreen from '@/components/game/GameOverScreen';
import SolutionsPanel from '@/components/game/SolutionsPanel';
import { useGameState } from '@/hooks/useGameState';
import { useTimer } from '@/hooks/useTimer';
import { DEFAULT_SETTINGS } from '@/types';
import type { RoomState, GameState } from '@/types';

export default function GamePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  const [playerId, setPlayerId] = useState('');
  const [initialRoom, setInitialRoom] = useState<RoomState | null>(null);
  const [initialGame, setInitialGame] = useState<GameState | null>(null);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const tickSentRef = useRef(false);

  useEffect(() => {
    const id = localStorage.getItem('playerId') ?? '';
    setPlayerId(id);
  }, []);

  // Initial fetch
  useEffect(() => {
    if (!code) return;
    async function load() {
      const res = await fetch(`/api/room/state?code=${code}`);
      if (!res.ok) { router.push('/'); return; }
      const data = await res.json();
      setInitialRoom(data.roomState);
      setInitialGame(data.gameState);
    }
    load();
  }, [code]);

  const ready = !!initialRoom && !!initialGame && !!playerId;

  const { room, game, notification, isGameOver, finalData, solutions, showSolutions, winningExpression, deckRemaining } = useGameState(
    ready
      ? { roomCode: code, playerId, initialRoom: initialRoom!, initialGame: initialGame! }
      : { roomCode: '', playerId: '', initialRoom: {} as RoomState, initialGame: {} as GameState }
  );

  const settings = room?.settings ?? DEFAULT_SETTINGS;
  const timeLimitSeconds = settings.timeLimitSeconds;

  const secondsRemaining = useTimer(
    game?.roundStartedAt ?? 0,
    game?.roundStatus === 'active',
    timeLimitSeconds
  );

  // Host sends tick when timer expires
  useEffect(() => {
    if (!ready || !game || game.roundStatus !== 'active') return;
    if (secondsRemaining > 0) { tickSentRef.current = false; return; }
    if (tickSentRef.current) return;
    if (room?.hostId !== playerId) return;

    tickSentRef.current = true;
    fetch('/api/game/tick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: code, playerId }),
    });
  }, [secondsRemaining, ready, game?.roundStatus, room?.hostId, playerId]);

  const handleSubmit = useCallback(async (expression: string) => {
    const res = await fetch('/api/game/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: code, playerId, expression }),
    });
    const data = await res.json();
    setFeedback({ msg: data.message ?? (data.correct ? 'Correct!' : 'Incorrect.'), ok: !!data.correct });
    setTimeout(() => setFeedback(null), 3000);
  }, [code, playerId]);

  const handleSkipVote = useCallback(async () => {
    await fetch('/api/game/skip-vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: code, playerId }),
    });
  }, [code, playerId]);

  const handleEndVote = useCallback(async () => {
    await fetch('/api/game/end-vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: code, playerId }),
    });
  }, [code, playerId]);

  const handlePlayAgain = useCallback(async () => {
    await fetch('/api/game/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: code, playerId }),
    });
  }, [code, playerId]);

  // Block rendering until useGameState has synced its internal state
  if (!ready || !game?.roundStatus || !room?.players) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gold text-xl font-display">
        Loading…
      </div>
    );
  }

  if (isGameOver && finalData) {
    return (
      <>
        <PokerBackground />
        <div className="relative">
          <Navbar />
          <GameOverScreen
            players={finalData.players}
            finalScores={finalData.finalScores}
            currentPlayerId={playerId}
            isHost={room.hostId === playerId}
            onPlayAgain={handlePlayAgain}
            onGoHome={() => router.push('/')}
          />
        </div>
      </>
    );
  }

  const eliminated = game.eliminatedThisRound ?? [];
  const skipVotesList = game.skipVotes ?? [];
  const endVotesList = game.endVotes ?? [];
  const isEliminated = eliminated.includes(playerId);
  const isRoundActive = game.roundStatus === 'active';
  const hasVotedSkip = skipVotesList.includes(playerId);
  const hasVotedEnd = endVotesList.includes(playerId);
  const activePlayers = (room?.players ?? []).filter(
    (p) => p.isConnected && !eliminated.includes(p.id)
  );
  const connectedCount = (room?.players ?? []).filter((p) => p.isConnected).length;

  return (
    <>
      <PokerBackground />
      <div className="relative min-h-screen flex flex-col">
        <Navbar />

        {/* Header bar */}
        <div className="flex items-center justify-between px-4 md:px-8 py-3 border-b border-gold/10 bg-felt-dark/50 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm text-white/60 flex-wrap">
            <span className="font-mono text-gold tracking-widest">{code}</span>
            <span className="text-white/20">·</span>
            <span>Round {game.roundNumber}</span>
            <span className="text-white/20">·</span>
            <span>🃏 {deckRemaining === -1 ? '∞' : deckRemaining} left</span>
            <span className="text-white/20">·</span>
            {/* Settings badges */}
            <span className="text-xs border border-white/10 rounded px-1.5 py-0.5 text-white/40">
              {settings.cardsPerRound} cards
            </span>
            <span className="text-xs border border-gold/30 text-gold/60 rounded px-1.5 py-0.5">
              target: {settings.targetNumber ?? 21}
            </span>
            <span
              className={`text-xs border rounded px-1.5 py-0.5 ${settings.modAllowed
                ? 'border-yellow-500/30 text-yellow-400/70'
                : 'border-white/10 text-white/25'}`}
            >
              % {settings.modAllowed ? 'on' : 'off'}
            </span>
            <span
              className={`text-xs border rounded px-1.5 py-0.5 ${settings.fractionsAllowed
                ? 'border-blue-500/30 text-blue-400/70'
                : 'border-white/10 text-white/25'}`}
            >
              fractions {settings.fractionsAllowed ? 'on' : 'off'}
            </span>
          </div>
          <Timer secondsRemaining={secondsRemaining} limitSeconds={timeLimitSeconds} />
        </div>

        {/* Round notification */}
        {notification && (
          <div
            className={`mx-4 mt-3 rounded-lg px-4 py-2 text-center text-sm font-display animate-slide-up
              ${notification.includes('solved') ? 'bg-green-900/40 text-green-300 border border-green-600/30' :
                notification.includes('skipped') ? 'bg-white/5 text-white/60 border border-white/10' :
                'bg-red-900/30 text-red-300 border border-red-600/30'}`}
          >
            {notification}
          </div>
        )}

        {/* Solutions panel (shown 10s after round ends) */}
        {showSolutions && (
          <SolutionsPanel
            solutions={solutions}
            onHide={() => {/* useGameState timer handles this */}}
            durationSeconds={10}
            targetNumber={settings.targetNumber ?? 21}
            winningExpression={winningExpression}
          />
        )}

        {/* Submission feedback */}
        {feedback && (
          <div
            className={`mx-4 mt-2 rounded px-4 py-2 text-center text-sm animate-fade-in
              ${feedback.ok ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}
          >
            {feedback.msg}
          </div>
        )}

        <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 px-4 md:px-8 py-6">
          {/* Left: cards + input */}
          <div className="flex flex-col gap-6">
            {/* Cards */}
            <div className="felt-texture rounded-xl p-8 flex items-center justify-center min-h-[180px] gold-border">
              {showSolutions ? (
                <span className="text-white/30 font-display">Next round starting soon…</span>
              ) : (game.currentHand ?? []).length > 0 ? (
                <CardDisplay cards={game.currentHand} />
              ) : (
                <span className="text-white/30 font-display">Dealing…</span>
              )}
            </div>

            {/* Eliminated banner */}
            {isEliminated && <EliminatedBanner />}

            {/* Input */}
            {!isEliminated && (
              <SolutionInput
                disabled={!isRoundActive || isEliminated || showSolutions}
                onSubmit={handleSubmit}
                onSkipVote={handleSkipVote}
                skipVotes={skipVotesList.length}
                skipRequired={activePlayers.length}
                hasVotedSkip={hasVotedSkip}
              />
            )}

            {/* End game early vote — visible to all players */}
            <div className="flex items-center justify-end">
              <button
                onClick={handleEndVote}
                disabled={hasVotedEnd}
                className={`text-xs px-3 py-1 rounded border transition-all
                  ${hasVotedEnd
                    ? 'border-white/20 text-white/30 cursor-not-allowed'
                    : 'border-red-500/30 text-red-400/60 hover:border-red-500/60 hover:text-red-400'}`}
              >
                End Game ({endVotesList.length}/{connectedCount}){hasVotedEnd ? ' ✓' : ''}
              </button>
            </div>
          </div>

          {/* Right: scoreboard */}
          <div>
            <Scoreboard
              players={room?.players ?? []}
              scores={game.scores ?? {}}
              eliminatedThisRound={eliminated}
              currentPlayerId={playerId}
            />
          </div>
        </main>
      </div>
    </>
  );
}
