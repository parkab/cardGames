'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import PokerBackground from '@/components/layout/PokerBackground';
import Navbar from '@/components/layout/Navbar';
import PlayerGrid from '@/components/cambio/PlayerGrid';
import DrawnCardDisplay from '@/components/cambio/DrawnCardDisplay';
import AbilityModal from '@/components/cambio/AbilityModal';
import CambioGameOverScreen from '@/components/cambio/CambioGameOverScreen';
import Timer from '@/components/game/Timer';
import { useCambioState } from '@/hooks/useCambioState';
import { useTimer } from '@/hooks/useTimer';
import type { Card, CambioPhase } from '@/types';

const TURN_LIMIT = 60;

// ─── Loading wrapper ──────────────────────────────────────────────────────────

export default function CambioGamePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [playerId, setPlayerId] = useState('');
  const [initialState, setInitialState] = useState<Parameters<typeof useCambioState>[0]['initialState'] | null>(null);
  const [initialDrawnCard, setInitialDrawnCard] = useState<Card | null>(null);

  useEffect(() => {
    setPlayerId(localStorage.getItem('playerId') ?? '');
  }, []);

  useEffect(() => {
    if (!code || !playerId) return;
    fetch(`/api/cambio/state?code=${code}&playerId=${playerId}`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => {
        if (data.cambioState?.drawnCard) setInitialDrawnCard(data.cambioState.drawnCard);
        setInitialState(data.cambioState);
      })
      .catch(() => router.push('/'));
  }, [code, playerId]);

  if (!initialState || !playerId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gold text-xl font-display">
        Loading…
      </div>
    );
  }

  return (
    <CambioGameInner
      code={code}
      playerId={playerId}
      initialState={initialState}
      initialDrawnCard={initialDrawnCard}
    />
  );
}

// ─── Full game component (receives real initialState, no dummy fallback) ──────

function CambioGameInner({
  code,
  playerId,
  initialState,
  initialDrawnCard,
}: {
  code: string;
  playerId: string;
  initialState: Parameters<typeof useCambioState>[0]['initialState'];
  initialDrawnCard: Card | null;
}) {
  const router = useRouter();

  const [drawnCard, setDrawnCard] = useState<Card | null>(initialDrawnCard);
  const [swapMode, setSwapMode] = useState(false);

  const [abilityPeekedCard, setAbilityPeekedCard] = useState<Card | null>(null);
  const [abilityPeekTarget, setAbilityPeekTarget] = useState<{ playerId: string; cardIndex: number } | null>(null);
  const [abilityPeekSecondsLeft, setAbilityPeekSecondsLeft] = useState(0);
  const [queenDecideMode, setQueenDecideMode] = useState(false);

  const [stickSelection, setStickSelection] = useState<{ playerId: string; cardIndex: number } | null>(null);
  const [stickFeedback, setStickFeedback] = useState<string | null>(null);

  // Countdown for initial peek phase
  const [initialPeekCountdown, setInitialPeekCountdown] = useState(0);

  const tickSentRef = useRef(false);

  const state = useCambioState({ roomCode: code, playerId, initialState });

  const {
    phase, currentTurnPlayerId, turnStartedAt, peekUntil, deckRemaining,
    discardPile, players, cambioCallerId, finalTurnsRemaining,
    isGameOver, gameOverData, notification, addPeekReveal,
  } = state;

  const isMyTurn = currentTurnPlayerId === playerId;
  const iAmCambioCallerLocked = cambioCallerId === playerId;

  // Turn timer (disabled during initial-peek and game-over)
  const secondsRemaining = useTimer(turnStartedAt, isMyTurn && phase !== 'initial-peek' && phase !== 'game-over', TURN_LIMIT);

  // Initial-peek countdown display
  useEffect(() => {
    if (phase !== 'initial-peek') { setInitialPeekCountdown(0); return; }
    const update = () => setInitialPeekCountdown(Math.max(0, Math.ceil((peekUntil - Date.now()) / 1000)));
    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [phase, peekUntil]);

  // Ability peek countdown
  useEffect(() => {
    if (!abilityPeekedCard) { setAbilityPeekSecondsLeft(0); return; }
    const interval = setInterval(() => {
      setAbilityPeekSecondsLeft((s) => {
        if (s <= 1) {
          setAbilityPeekedCard(null);
          setAbilityPeekTarget(null);
          clearInterval(interval);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [abilityPeekedCard]);

  // Host sends timeout tick when timer hits 0
  useEffect(() => {
    if (!isMyTurn) return;
    if (phase === 'initial-peek' || phase === 'game-over') return;
    if (secondsRemaining > 0) { tickSentRef.current = false; return; }
    if (tickSentRef.current) return;
    tickSentRef.current = true;
    fetch('/api/cambio/turn-timeout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: code, playerId }),
    });
  }, [secondsRemaining, isMyTurn, phase, code, playerId]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handleDraw = useCallback(async () => {
    const res = await fetch('/api/cambio/draw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: code, playerId }),
    });
    const data = await res.json();
    if (res.ok && data.card) {
      setDrawnCard(data.card);
      state.setPhase('turn-decide');
    }
  }, [code, playerId]);

  const handleDiscard = useCallback(async () => {
    const res = await fetch('/api/cambio/discard-drawn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: code, playerId }),
    });
    const data = await res.json();
    if (res.ok) {
      setDrawnCard(null);
      setSwapMode(false);
      state.setPhase(data.phase as CambioPhase);
      // Discard pile update comes via cambio:card-discarded Ably event
    }
  }, [code, playerId]);

  const handleSwapCard = useCallback(async (cardIndex: number) => {
    if (!drawnCard) return;
    const res = await fetch('/api/cambio/swap-drawn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: code, playerId, cardIndex }),
    });
    if (res.ok) {
      setDrawnCard(null);
      setSwapMode(false);
      state.setPlayers((prev) => prev.map((p) => {
        if (p.id !== playerId) return p;
        const slots = [...p.handSlots];
        slots[cardIndex] = { hasCard: true };
        return { ...p, handSlots: slots };
      }));
    }
  }, [code, playerId, drawnCard]);

  const handleCallCambio = useCallback(async () => {
    await fetch('/api/cambio/call-cambio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: code, playerId }),
    });
  }, [code, playerId]);

  // ─── Ability handlers ────────────────────────────────────────────────────────

  const handleAbilityCardClick = useCallback(async (targetPId: string, cardIndex: number) => {
    if (!isMyTurn) return;

    if (phase === 'ability-queen-decide' && queenDecideMode && targetPId === playerId) {
      const res = await fetch('/api/cambio/ability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: code, playerId, type: 'queen-decide', myCardIndex: cardIndex }),
      });
      if (res.ok) { setQueenDecideMode(false); setAbilityPeekedCard(null); }
      return;
    }

    if (phase === 'ability-jack') {
      if (!abilityPeekTarget) {
        if (targetPId === playerId) setAbilityPeekTarget({ playerId: targetPId, cardIndex });
      } else if (targetPId !== playerId) {
        const res = await fetch('/api/cambio/ability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomCode: code, playerId, type: 'blind-swap',
            myCardIndex: abilityPeekTarget.cardIndex,
            targetPlayerId: targetPId, targetCardIndex: cardIndex,
          }),
        });
        if (res.ok) setAbilityPeekTarget(null);
      }
      return;
    }

    if (phase === 'ability-9' && targetPId === playerId) {
      const res = await fetch('/api/cambio/ability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: code, playerId, type: 'peek-own', cardIndex }),
      });
      const data = await res.json();
      if (res.ok && data.card) {
        addPeekReveal(playerId, cardIndex, data.card, 5000);
        setAbilityPeekedCard(data.card);
        setAbilityPeekSecondsLeft(5);
      }
      return;
    }

    if (phase === 'ability-10' && targetPId !== playerId) {
      const res = await fetch('/api/cambio/ability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: code, playerId, type: 'peek-opponent', targetPlayerId: targetPId, targetCardIndex: cardIndex }),
      });
      const data = await res.json();
      if (res.ok && data.card) {
        addPeekReveal(targetPId, cardIndex, data.card, 5000);
        setAbilityPeekedCard(data.card);
        setAbilityPeekSecondsLeft(5);
      }
      return;
    }

    if (phase === 'ability-queen-peek' && targetPId !== playerId) {
      const res = await fetch('/api/cambio/ability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: code, playerId, type: 'queen-peek', targetPlayerId: targetPId, targetCardIndex: cardIndex }),
      });
      const data = await res.json();
      if (res.ok && data.card) {
        addPeekReveal(targetPId, cardIndex, data.card, 5000);
        setAbilityPeekedCard(data.card);
        setAbilityPeekTarget({ playerId: targetPId, cardIndex });
        setAbilityPeekSecondsLeft(5);
        state.setPhase('ability-queen-decide');
      }
      return;
    }
  }, [isMyTurn, phase, abilityPeekTarget, queenDecideMode, code, playerId, addPeekReveal]);

  const handleAbilitySkip = useCallback(async () => {
    const type = phase === 'ability-jack' ? 'blind-swap' : 'queen-decide';
    await fetch('/api/cambio/ability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: code, playerId, type, skip: true }),
    });
    setAbilityPeekedCard(null);
    setAbilityPeekTarget(null);
    setQueenDecideMode(false);
  }, [code, playerId, phase]);

  // ─── Stick handlers ──────────────────────────────────────────────────────────

  const handleCardClickForStick = useCallback((targetPId: string, cardIndex: number) => {
    if (phase === 'initial-peek' || phase === 'game-over') return;

    if (isMyTurn && ['ability-9', 'ability-10', 'ability-jack', 'ability-queen-peek', 'ability-queen-decide'].includes(phase)) {
      handleAbilityCardClick(targetPId, cardIndex);
      return;
    }

    if (stickSelection?.playerId === targetPId && stickSelection?.cardIndex === cardIndex) {
      setStickSelection(null);
    } else {
      setStickSelection({ playerId: targetPId, cardIndex });
    }
  }, [phase, isMyTurn, stickSelection, handleAbilityCardClick]);

  const handleDiscardPileClick = useCallback(async () => {
    if (!stickSelection || discardPile.length === 0) return;
    const { playerId: targetPId, cardIndex } = stickSelection;
    setStickSelection(null);

    const isOwnCard = targetPId === playerId;
    const res = await fetch('/api/cambio/stick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: code, stickerId: playerId, targetPlayerId: targetPId, targetCardIndex: cardIndex }),
    });
    const data = await res.json();
    if (res.ok) {
      setStickFeedback(data.success ? (isOwnCard ? 'Stick! ✓' : 'Stuck their card! ✓') : 'Wrong! Penalty added. ✗');
    } else {
      setStickFeedback(data.error ?? 'Stick failed.');
    }
    setTimeout(() => setStickFeedback(null), 3000);
  }, [stickSelection, discardPile, code, playerId]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (isGameOver && gameOverData) {
    return (
      <>
        <PokerBackground />
        <div className="relative">
          <Navbar />
          <CambioGameOverScreen
            finalHands={gameOverData.finalHands as Record<string, (import('@/types').Card | null)[]>}
            scores={gameOverData.scores}
            winnerIds={gameOverData.winnerIds}
            callerId={gameOverData.callerId}
            players={players.map((p) => ({ id: p.id, nickname: p.nickname, isHost: p.isHost, isConnected: p.isConnected }))}
            currentPlayerId={playerId}
            isHost={players.find((p) => p.id === playerId)?.isHost ?? false}
            onPlayAgain={async () => {
              await fetch('/api/cambio/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomCode: code, playerId }),
              });
            }}
            onGoHome={() => router.push('/')}
          />
        </div>
      </>
    );
  }

  const discardTop = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;
  const myPlayer = players.find((p) => p.id === playerId);
  const otherPlayers = players.filter((p) => p.id !== playerId);
  const N = otherPlayers.length;

  // Distribute opponents around the table
  let topPlayers = otherPlayers;
  let leftPlayers: typeof otherPlayers = [];
  let rightPlayers: typeof otherPlayers = [];

  if (N === 4) {
    leftPlayers = [otherPlayers[0]];
    topPlayers = [otherPlayers[1], otherPlayers[2]];
    rightPlayers = [otherPlayers[3]];
  } else if (N === 5) {
    leftPlayers = [otherPlayers[0]];
    topPlayers = [otherPlayers[1], otherPlayers[2], otherPlayers[3]];
    rightPlayers = [otherPlayers[4]];
  } else if (N >= 6) {
    leftPlayers = otherPlayers.slice(0, 2);
    rightPlayers = otherPlayers.slice(N - 2);
    topPlayers = otherPlayers.slice(2, N - 2);
  }

  const canDraw = isMyTurn && (phase === 'turn-draw' || phase === 'final-round') && !iAmCambioCallerLocked;
  const canCallCambio = isMyTurn && (phase === 'turn-draw' || phase === 'final-round')
    && discardPile.length > 0 && !cambioCallerId && !iAmCambioCallerLocked;
  const abilityActive = isMyTurn && ['ability-9', 'ability-10', 'ability-jack', 'ability-queen-peek', 'ability-queen-decide'].includes(phase);

  const SUIT_SYMBOLS: Record<string, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
  const RED_SUITS = new Set(['hearts', 'diamonds']);

  return (
    <>
      <PokerBackground />
      <div className="relative min-h-screen flex flex-col">
        <Navbar />

        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gold/10 bg-felt-dark/50 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm text-white/60 flex-wrap">
            <span className="font-mono text-gold tracking-widest">{code}</span>
            <span className="text-white/20">·</span>
            <span>🃏 {deckRemaining} left</span>
            {cambioCallerId && (
              <>
                <span className="text-white/20">·</span>
                <span className="text-red-400 text-xs border border-red-400/30 rounded px-1.5 py-0.5">
                  Cambio called ({finalTurnsRemaining} turns left)
                </span>
              </>
            )}
            {phase === 'initial-peek' && (
              <>
                <span className="text-white/20">·</span>
                <span className="text-blue-400 text-xs border border-blue-400/30 rounded px-1.5 py-0.5 animate-pulse">
                  Memorize your bottom 2 cards{initialPeekCountdown > 0 ? ` (${initialPeekCountdown}s)` : ''}
                </span>
              </>
            )}
          </div>
          {isMyTurn && phase !== 'initial-peek' && phase !== 'game-over' && (
            <Timer secondsRemaining={secondsRemaining} limitSeconds={TURN_LIMIT} />
          )}
        </div>

        {/* Turn indicator */}
        <div className="px-4 py-1.5 text-center text-sm text-white/50">
          {phase === 'initial-peek'
            ? <span className="text-blue-300">Memorize your cards…</span>
            : isMyTurn
            ? <span className="text-gold font-display">Your turn</span>
            : <span>{players.find((p) => p.id === currentTurnPlayerId)?.nickname ?? '?'}&apos;s turn</span>
          }
        </div>

        {/* Notifications */}
        {notification && (
          <div className="mx-4 rounded-lg px-4 py-2 text-center text-sm bg-white/5 text-white/70 border border-white/10">
            {notification}
          </div>
        )}
        {stickFeedback && (
          <div className={`mx-4 mt-1 rounded-lg px-4 py-2 text-center text-sm border ${
            stickFeedback.includes('✓') ? 'bg-green-900/30 text-green-300 border-green-600/20' : 'bg-red-900/30 text-red-300 border-red-600/20'
          }`}>
            {stickFeedback}
          </div>
        )}

        {/* ── Main table area ─────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col px-3 py-2 gap-2 min-h-0">

          {/* TOP: opponents across the top */}
          {topPlayers.length > 0 && (
            <div className="flex justify-center gap-2 flex-wrap">
              {topPlayers.map((p) => (
                <PlayerGrid
                  key={p.id}
                  playerId={p.id}
                  nickname={p.nickname}
                  isHost={p.isHost}
                  isActive={p.id === currentTurnPlayerId}
                  hasCalledCambio={p.hasCalledCambio}
                  handSlots={p.handSlots}
                  isCurrentPlayer={false}
                  selectedStick={stickSelection}
                  onCardClick={(idx) => handleCardClickForStick(p.id, idx)}
                  size="sm"
                />
              ))}
            </div>
          )}

          {/* MIDDLE: left column | center | right column */}
          <div className="flex flex-1 items-center gap-2 min-h-0">

            {/* Left-side opponents */}
            {leftPlayers.length > 0 && (
              <div className="flex flex-col gap-3 items-center">
                {leftPlayers.map((p) => (
                  <PlayerGrid
                    key={p.id}
                    playerId={p.id}
                    nickname={p.nickname}
                    isHost={p.isHost}
                    isActive={p.id === currentTurnPlayerId}
                    hasCalledCambio={p.hasCalledCambio}
                    handSlots={p.handSlots}
                    isCurrentPlayer={false}
                    selectedStick={stickSelection}
                    onCardClick={(idx) => handleCardClickForStick(p.id, idx)}
                    size="sm"
                  />
                ))}
              </div>
            )}

            {/* Center: deck + discard + actions */}
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              {/* Deck and discard */}
              <div className="flex items-end gap-6">
                {/* Deck */}
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={handleDraw}
                    disabled={!canDraw}
                    className={`w-16 h-24 rounded-lg border-2 flex items-center justify-center transition-all ${
                      canDraw
                        ? 'border-gold bg-felt-dark hover:bg-gold/10 cursor-pointer shadow-lg shadow-gold/20'
                        : 'border-white/10 bg-black/20 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <span className="text-gold/30 text-3xl">🂠</span>
                  </button>
                  <p className="text-white/40 text-[11px]">{deckRemaining} cards</p>
                  {canDraw && <p className="text-gold/60 text-[10px] animate-pulse">Draw</p>}
                </div>

                {/* Discard pile */}
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={handleDiscardPileClick}
                    disabled={!stickSelection}
                    className={`w-16 h-24 rounded-lg border-2 flex flex-col items-center justify-center gap-1 transition-all ${
                      stickSelection && discardTop
                        ? 'border-gold bg-gold/10 cursor-pointer shadow-lg shadow-gold/20'
                        : discardTop
                        ? 'border-white/20 bg-white cursor-default'
                        : 'border-white/10 bg-black/10 cursor-default'
                    }`}
                  >
                    {discardTop ? (
                      <>
                        <span className={`text-xl font-bold leading-none ${RED_SUITS.has(discardTop.suit) ? 'text-red-600' : 'text-gray-900'}`}>
                          {discardTop.rank}
                        </span>
                        <span className={`text-xl leading-none ${RED_SUITS.has(discardTop.suit) ? 'text-red-600' : 'text-gray-900'}`}>
                          {SUIT_SYMBOLS[discardTop.suit]}
                        </span>
                      </>
                    ) : (
                      <span className="text-white/20 text-xs text-center">Empty</span>
                    )}
                  </button>
                  <p className="text-white/40 text-[11px]">Discard</p>
                  {stickSelection && discardTop && <p className="text-gold/60 text-[10px] animate-pulse">Stick!</p>}
                </div>
              </div>

              {/* Call Cambio button */}
              {canCallCambio && (
                <button
                  onClick={handleCallCambio}
                  className="px-5 py-2 rounded-lg border border-red-500/40 bg-red-900/20 text-red-400 text-sm font-display tracking-wide hover:bg-red-500/20 transition-colors"
                >
                  Call Cambio!
                </button>
              )}

              {/* Drawn card — only visible to the player who drew */}
              {drawnCard && isMyTurn && phase === 'turn-decide' && (
                <DrawnCardDisplay
                  card={drawnCard}
                  onDiscard={handleDiscard}
                  onSwapMode={() => setSwapMode(!swapMode)}
                  isSwapMode={swapMode}
                />
              )}
            </div>

            {/* Right-side opponents */}
            {rightPlayers.length > 0 && (
              <div className="flex flex-col gap-3 items-center">
                {rightPlayers.map((p) => (
                  <PlayerGrid
                    key={p.id}
                    playerId={p.id}
                    nickname={p.nickname}
                    isHost={p.isHost}
                    isActive={p.id === currentTurnPlayerId}
                    hasCalledCambio={p.hasCalledCambio}
                    handSlots={p.handSlots}
                    isCurrentPlayer={false}
                    selectedStick={stickSelection}
                    onCardClick={(idx) => handleCardClickForStick(p.id, idx)}
                    size="sm"
                  />
                ))}
              </div>
            )}
          </div>

          {/* BOTTOM: my hand */}
          {myPlayer && (
            <div className="flex justify-center pt-1">
              <PlayerGrid
                playerId={myPlayer.id}
                nickname={myPlayer.nickname}
                isHost={myPlayer.isHost}
                isActive={myPlayer.id === currentTurnPlayerId}
                hasCalledCambio={myPlayer.hasCalledCambio}
                handSlots={myPlayer.handSlots}
                isCurrentPlayer
                selectedStick={stickSelection}
                onCardClick={(cardIndex) => {
                  if (swapMode && isMyTurn && phase === 'turn-decide') {
                    handleSwapCard(cardIndex);
                  } else {
                    handleCardClickForStick(playerId, cardIndex);
                  }
                }}
                size="md"
              />
            </div>
          )}

          {/* Stick hint */}
          {!stickSelection && phase !== 'initial-peek' && phase !== 'game-over' && discardTop && (
            <p className="text-white/20 text-xs text-center">
              Click any card then the discard pile to attempt a stick
            </p>
          )}
        </main>
      </div>

      {/* Ability modal overlay */}
      {abilityActive && (
        <AbilityModal
          phase={phase}
          peekedCard={abilityPeekedCard}
          peekSecondsLeft={abilityPeekSecondsLeft}
          targetPlayerId={abilityPeekTarget?.playerId}
          onSkip={handleAbilitySkip}
          onQueenDecideSwap={() => setQueenDecideMode(true)}
        />
      )}
    </>
  );
}
