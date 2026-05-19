'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import PokerBackground from '@/components/layout/PokerBackground';
import Navbar from '@/components/layout/Navbar';
import PlayerList from '@/components/lobby/PlayerList';
import RoomCodeDisplay from '@/components/lobby/RoomCodeDisplay';
import StartButton from '@/components/lobby/StartButton';
import { useAbly } from '@/hooks/useAbly';
import { DEFAULT_SETTINGS } from '@/types';
import type { RoomState, Player, RoomSettings } from '@/types';

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m === 0 ? `${s}s` : `${m}:${String(sec).padStart(2, '0')}`;
}

function Toggle({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onToggle}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none
        ${on ? 'bg-gold' : 'bg-white/20'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${on ? 'left-6' : 'left-1'}`}
      />
    </button>
  );
}

export default function LobbyPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  const [playerId, setPlayerId] = useState('');
  const [room, setRoom] = useState<RoomState | null>(null);
  const [starting, setStarting] = useState(false);
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_SETTINGS);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = localStorage.getItem('playerId') ?? '';
    setPlayerId(id);
  }, []);

  useEffect(() => {
    if (!code) return;
    async function fetchRoom() {
      const res = await fetch(`/api/room/state?code=${code}`);
      if (res.ok) {
        const data = await res.json();
        setRoom(data.roomState);
        if (data.roomState?.settings) setSettings(data.roomState.settings);
      }
    }
    fetchRoom();
  }, [code]);

  const { subscribe, unsubscribe } = useAbly(code, playerId);

  useEffect(() => {
    if (!playerId || !code) return;

    subscribe('room:player_joined', (data) => {
      const { player } = data as { player: Player };
      setRoom((prev) => {
        if (!prev) return prev;
        if (prev.players.find((p) => p.id === player.id)) return prev;
        return { ...prev, players: [...prev.players, player] };
      });
    });

    subscribe('room:player_left', (data) => {
      const { playerId: leftId, newHostId } = data as { playerId: string; newHostId?: string };
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.filter((p) => p.id !== leftId),
          hostId: newHostId ?? prev.hostId,
        };
      });
    });

    subscribe('room:settings_updated', (data) => {
      const { settings: updated } = data as { settings: RoomSettings };
      setSettings(updated);
      setRoom((prev) => prev ? { ...prev, settings: updated } : prev);
    });

    subscribe('game:started', () => {
      router.push(`/game/${code}`);
    });

    return () => {
      unsubscribe('room:player_joined');
      unsubscribe('room:player_left');
      unsubscribe('room:settings_updated');
      unsubscribe('game:started');
    };
  }, [playerId, code]);

  // Saves settings to server; debounced for sliders, immediate for toggles.
  const saveSettings = useCallback(async (next: RoomSettings) => {
    await fetch('/api/room/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: code, playerId, settings: next }),
    });
  }, [code, playerId]);

  // Update local state immediately; debounce the API call (for sliders).
  function handleSliderChange(next: Partial<RoomSettings>) {
    setSettings((prev) => ({ ...prev, ...next }));
  }

  // Fire API call once the slider thumb is released.
  function handleSliderCommit(next: RoomSettings) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveSettings(next), 0);
  }

  // Toggles save immediately.
  function handleToggle(key: 'modAllowed' | 'fractionsAllowed' | 'infiniteMode') {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveSettings(next);
      return next;
    });
  }

  const handleStart = useCallback(async () => {
    setStarting(true);
    await fetch('/api/game/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: code, playerId }),
    });
    setStarting(false);
  }, [code, playerId]);

  const handleLeave = useCallback(async () => {
    await fetch('/api/room/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: code, playerId }),
    });
    router.push('/21');
  }, [code, playerId]);

  const isHost = room?.hostId === playerId;

  return (
    <>
      <PokerBackground />
      <div className="relative min-h-screen flex flex-col">
        <Navbar />

        <main className="flex-1 max-w-xl mx-auto w-full px-4 py-10 flex flex-col gap-8">
          {/* Room code */}
          <div className="text-center gold-border rounded-xl p-6 bg-felt-dark/60">
            <RoomCodeDisplay code={code?.toUpperCase() ?? ''} />
            <p className="text-white/40 text-xs mt-2">Share this code with friends to join</p>
          </div>

          {/* Player list */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-gold/80 text-sm tracking-widest uppercase font-display">Players</h2>
              <span className="text-white/40 text-sm">{room?.players.length ?? 0} / 10</span>
            </div>
            {room ? (
              <PlayerList
                players={room.players}
                hostId={room.hostId}
                currentPlayerId={playerId}
              />
            ) : (
              <div className="text-white/30 text-sm text-center py-8">Loading…</div>
            )}
          </div>

          {/* Game settings */}
          <div className="rounded-lg border border-white/10 bg-black/20 p-4 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <p className="text-gold/50 text-[10px] tracking-widest uppercase">Game Settings</p>
              {!isHost && <p className="text-white/25 text-[10px]">Set by host</p>}
            </div>

            {/* Time limit */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white/50">Time Limit</span>
                <span className="text-gold font-mono">{formatTime(settings.timeLimitSeconds)}</span>
              </div>
              <input
                type="range" min={30} max={300} step={15}
                value={settings.timeLimitSeconds}
                disabled={!isHost}
                onChange={(e) => handleSliderChange({ timeLimitSeconds: +e.target.value })}
                onMouseUp={() => isHost && handleSliderCommit(settings)}
                onTouchEnd={() => isHost && handleSliderCommit(settings)}
                className={`w-full h-1.5 rounded appearance-none bg-white/10 ${isHost ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
                style={{ accentColor: '#c9a84c' }}
              />
              <div className="flex justify-between text-white/20 text-[10px] mt-1">
                <span>30s</span><span>5:00</span>
              </div>
            </div>

            {/* Cards per round */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white/50">Cards per Round</span>
                <span className="text-gold font-mono">{settings.cardsPerRound}</span>
              </div>
              <input
                type="range" min={3} max={7} step={1}
                value={settings.cardsPerRound}
                disabled={!isHost}
                onChange={(e) => handleSliderChange({ cardsPerRound: +e.target.value })}
                onMouseUp={() => isHost && handleSliderCommit(settings)}
                onTouchEnd={() => isHost && handleSliderCommit(settings)}
                className={`w-full h-1.5 rounded appearance-none bg-white/10 ${isHost ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
                style={{ accentColor: '#c9a84c' }}
              />
              <div className="flex justify-between text-white/20 text-[10px] mt-1">
                <span>3</span><span>7</span>
              </div>
            </div>

            {/* Target number */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white/50">Target Number</span>
                <span className="text-gold font-mono">{settings.targetNumber ?? 21}</span>
              </div>
              <input
                type="range" min={-100} max={100} step={1}
                value={settings.targetNumber ?? 21}
                disabled={!isHost}
                onChange={(e) => handleSliderChange({ targetNumber: +e.target.value })}
                onMouseUp={() => isHost && handleSliderCommit(settings)}
                onTouchEnd={() => isHost && handleSliderCommit(settings)}
                className={`w-full h-1.5 rounded appearance-none bg-white/10 ${isHost ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
                style={{ accentColor: '#c9a84c' }}
              />
              <div className="flex justify-between text-white/20 text-[10px] mt-1">
                <span>-100</span><span>0</span><span>100</span>
              </div>
            </div>

            {/* Modulus toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Modulus operator (%)</p>
                <p className="text-white/25 text-xs">e.g. 10 % 3 = 1</p>
              </div>
              <Toggle on={settings.modAllowed} onToggle={() => handleToggle('modAllowed')} disabled={!isHost} />
            </div>

            {/* Fractions toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Allow fractions</p>
                <p className="text-white/25 text-xs">Intermediate non-integer results</p>
              </div>
              <Toggle on={settings.fractionsAllowed} onToggle={() => handleToggle('fractionsAllowed')} disabled={!isHost} />
            </div>

            {/* Infinite mode toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Infinite mode</p>
                <p className="text-white/25 text-xs">Cards drawn with replacement — game ends via vote only</p>
              </div>
              <Toggle on={settings.infiniteMode ?? false} onToggle={() => handleToggle('infiniteMode')} disabled={!isHost} />
            </div>
          </div>

          {/* Start / Leave */}
          <div className="flex flex-col gap-3">
            <StartButton
              isHost={isHost}
              playerCount={room?.players.length ?? 0}
              onStart={handleStart}
              loading={starting}
            />
            <button
              onClick={handleLeave}
              className="text-white/30 hover:text-red-400 text-sm text-center transition-colors"
            >
              Leave Room
            </button>
          </div>
        </main>
      </div>
    </>
  );
}
