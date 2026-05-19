'use client';

import { useState } from 'react';
import type { Player, RoomSettings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import Button from '@/components/ui/Button';

interface GameOverScreenProps {
  players: Player[];
  finalScores: Record<string, number>;
  currentPlayerId: string;
  isHost: boolean;
  onPlayAgain: (settings: RoomSettings) => void;
  onGoHome: () => void;
  currentSettings: RoomSettings;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m === 0 ? `${s}s` : `${m}:${String(sec).padStart(2, '0')}`;
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${on ? 'bg-gold' : 'bg-white/20'}`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${on ? 'left-6' : 'left-1'}`}
      />
    </button>
  );
}

export default function GameOverScreen({
  players,
  finalScores,
  currentPlayerId,
  isHost,
  onPlayAgain,
  onGoHome,
  currentSettings,
}: GameOverScreenProps) {
  const [settings, setSettings] = useState<RoomSettings>(currentSettings ?? DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);

  const sorted = [...players].sort((a, b) => (finalScores[b.id] ?? 0) - (finalScores[a.id] ?? 0));
  const topScore = finalScores[sorted[0]?.id] ?? 0;
  const winners = sorted.filter((p) => (finalScores[p.id] ?? 0) === topScore);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 animate-fade-in">
      <h1 className="text-5xl font-display text-gold mb-2 tracking-widest">Game Over</h1>
      <p className="text-white/50 mb-8">
        {winners.length === 1
          ? `${winners[0].nickname} wins! 🏆`
          : `It's a tie! ${winners.map((w) => w.nickname).join(' & ')} 🏆`}
      </p>

      {/* Final scores */}
      <div className="w-full max-w-sm gold-border rounded-xl p-6 bg-felt-dark/80 mb-6">
        <h2 className="text-gold text-sm tracking-widest uppercase mb-4">Final Scores</h2>
        <ul className="space-y-3">
          {sorted.map((player, i) => {
            const isWinner = winners.some((w) => w.id === player.id);
            const isYou = player.id === currentPlayerId;
            return (
              <li
                key={player.id}
                className={`flex items-center justify-between rounded-lg px-3 py-2
                  ${isWinner ? 'bg-gold/10 border border-gold/30' : ''}
                  ${isYou && !isWinner ? 'bg-white/5' : ''}
                `}
              >
                <div className="flex items-center gap-2">
                  <span className="text-white/40 w-5 text-sm">{i + 1}.</span>
                  {isWinner && <span className="text-sm">🏆</span>}
                  <span className={isWinner ? 'text-gold font-bold' : isYou ? 'text-white' : 'text-white/70'}>
                    {player.nickname}{isYou ? ' (you)' : ''}
                  </span>
                </div>
                <span className={`font-bold font-mono ${isWinner ? 'text-gold' : 'text-white/70'}`}>
                  {finalScores[player.id] ?? 0} pts
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Settings panel (host only) */}
      {isHost && (
        <div className="w-full max-w-sm mb-6">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="w-full flex items-center justify-between text-white/40 text-xs hover:text-white/70 transition-colors px-1 mb-2"
          >
            <span className="tracking-widest uppercase">Settings for next game</span>
            <span>{showSettings ? '▲' : '▼'}</span>
          </button>

          {showSettings && (
            <div className="rounded-lg border border-white/10 bg-black/20 p-4 flex flex-col gap-5 animate-fade-in">
              {/* Time limit */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-white/50">Time Limit</span>
                  <span className="text-gold font-mono">{formatTime(settings.timeLimitSeconds)}</span>
                </div>
                <input
                  type="range" min={30} max={300} step={15}
                  value={settings.timeLimitSeconds}
                  onChange={(e) => setSettings((s) => ({ ...s, timeLimitSeconds: +e.target.value }))}
                  className="w-full h-1.5 rounded appearance-none cursor-pointer bg-white/10"
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
                  onChange={(e) => setSettings((s) => ({ ...s, cardsPerRound: +e.target.value }))}
                  className="w-full h-1.5 rounded appearance-none cursor-pointer bg-white/10"
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
                  onChange={(e) => setSettings((s) => ({ ...s, targetNumber: +e.target.value }))}
                  className="w-full h-1.5 rounded appearance-none cursor-pointer bg-white/10"
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
                <Toggle on={settings.modAllowed} onToggle={() => setSettings((s) => ({ ...s, modAllowed: !s.modAllowed }))} />
              </div>

              {/* Fractions toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">Allow fractions</p>
                  <p className="text-white/25 text-xs">Intermediate non-integer results</p>
                </div>
                <Toggle on={settings.fractionsAllowed} onToggle={() => setSettings((s) => ({ ...s, fractionsAllowed: !s.fractionsAllowed }))} />
              </div>

              {/* Infinite mode toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">Infinite mode</p>
                  <p className="text-white/25 text-xs">Cards drawn with replacement — game ends via vote only</p>
                </div>
                <Toggle on={settings.infiniteMode ?? false} onToggle={() => setSettings((s) => ({ ...s, infiniteMode: !s.infiniteMode }))} />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col items-center gap-3">
        {isHost ? (
          <Button size="lg" onClick={() => onPlayAgain(settings)}>
            Play Again
          </Button>
        ) : (
          <p className="text-white/40 text-sm">Waiting for host to start a new game…</p>
        )}
        <button
          onClick={onGoHome}
          className="text-white/40 text-sm hover:text-white transition-colors"
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
}
