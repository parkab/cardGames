'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PokerBackground from '@/components/layout/PokerBackground';
import Navbar from '@/components/layout/Navbar';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { DEFAULT_SETTINGS } from '@/types';
import type { RoomSettings } from '@/types';

type ModalView = 'choose' | 'create' | 'join';

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

export default function Play21Page() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [view, setView] = useState<ModalView>('choose');
  const [nickname, setNickname] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<RoomSettings>({ ...DEFAULT_SETTINGS });

  const openModal = useCallback(() => {
    setModalOpen(true);
    setView('choose');
    setError('');
    setNickname('');
    setJoinCode('');
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setView('choose');
    setError('');
  }, []);

  async function handleCreate() {
    if (!nickname.trim()) { setError('Enter a nickname.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/room/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim(), settings }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to create room.'); return; }
      localStorage.setItem('playerId', data.playerId);
      localStorage.setItem('nickname', nickname.trim());
      router.push(`/lobby/${data.roomCode}`);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!nickname.trim()) { setError('Enter a nickname.'); return; }
    if (!joinCode.trim() || joinCode.trim().length !== 4) { setError('Enter a valid 4-letter room code.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/room/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim(), roomCode: joinCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to join room.'); return; }
      localStorage.setItem('playerId', data.playerId);
      localStorage.setItem('nickname', nickname.trim());
      router.push(`/lobby/${joinCode.trim().toUpperCase()}`);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PokerBackground />
      <div className="relative min-h-screen flex flex-col">
        <Navbar />

        <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-14 flex flex-col gap-10">
          {/* Title */}
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-gold/10 border-2 border-gold flex items-center justify-center mx-auto mb-5">
              <span className="text-gold text-4xl font-display font-bold">21</span>
            </div>
            <h1 className="text-4xl font-display text-white tracking-widest mb-2">Make 21</h1>
            <p className="text-white/50">Race to find a math expression that equals 21 using the dealt cards.</p>
          </div>

          {/* CTA buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={openModal}
              className="group gold-border rounded-xl p-6 bg-felt-dark/60 hover:bg-gold/10 transition-all text-center"
            >
              <div className="text-3xl mb-2">🏠</div>
              <h2 className="text-gold font-display text-lg tracking-wide mb-1">Create Lobby</h2>
              <p className="text-white/40 text-sm">Start a private room and invite friends</p>
            </button>
            <button
              onClick={openModal}
              className="group gold-border rounded-xl p-6 bg-felt-dark/60 hover:bg-gold/10 transition-all text-center"
            >
              <div className="text-3xl mb-2">🚪</div>
              <h2 className="text-gold font-display text-lg tracking-wide mb-1">Join Lobby</h2>
              <p className="text-white/40 text-sm">Enter a 4-letter code to join a friend</p>
            </button>
          </div>

          {/* How to play */}
          <section className="gold-border rounded-xl p-6 bg-felt-dark/40">
            <h2 className="text-gold font-display tracking-widest mb-5 text-center text-sm uppercase">How to Play</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-white/60">
              {[
                { icon: '🃏', title: '4 Cards Dealt', desc: 'Each round, cards are revealed to all players simultaneously.' },
                { icon: '🧮', title: 'Make 21', desc: 'Use +, −, ×, ÷ evaluated left-to-right (no order of operations) to reach exactly 21.' },
                { icon: '⚡', title: 'Race to Win', desc: 'First correct answer earns a point. Wrong answer? Sit out until next round.' },
              ].map((item) => (
                <div key={item.title} className="text-center">
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <h3 className="text-gold/80 font-display mb-1">{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t border-white/5 text-center text-white/30 text-xs font-mono">
              2–8 players · Configurable time limit · No account required
            </div>
          </section>
        </main>
      </div>

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={closeModal} title="Make 21">
        {view === 'choose' && (
          <div className="flex flex-col gap-4">
            <Input
              label="Your Nickname"
              placeholder="Enter nickname (max 20 chars)"
              maxLength={20}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && nickname.trim()) { setError(''); setView('create'); } }}
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <div className="grid grid-cols-2 gap-3 mt-2">
              <Button size="lg" onClick={() => {
                if (!nickname.trim()) { setError('Enter a nickname.'); return; }
                setError(''); setView('create');
              }}>
                Create Lobby
              </Button>
              <Button variant="ghost" size="lg" onClick={() => {
                if (!nickname.trim()) { setError('Enter a nickname.'); return; }
                setError(''); setView('join');
              }}>
                Join Lobby
              </Button>
            </div>
          </div>
        )}

        {view === 'create' && (
          <div className="flex flex-col gap-4">
            <p className="text-white/60 text-sm text-center">
              Creating a room as <span className="text-gold">{nickname}</span>
            </p>

            {/* Game settings */}
            <div className="rounded-lg border border-white/10 bg-black/20 p-4 flex flex-col gap-5">
              <p className="text-gold/50 text-[10px] tracking-widest uppercase text-center">Game Settings</p>

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

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <Button size="lg" onClick={handleCreate} disabled={loading}>
              {loading ? 'Creating…' : 'Create Room'}
            </Button>
            <button onClick={() => { setView('choose'); setError(''); }}
              className="text-white/40 text-sm hover:text-white transition-colors text-center">
              ← Back
            </button>
          </div>
        )}

        {view === 'join' && (
          <div className="flex flex-col gap-4">
            <Input
              label="Room Code"
              placeholder="ABCD"
              maxLength={4}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
              className="text-center text-2xl tracking-widest uppercase"
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <Button size="lg" onClick={handleJoin} disabled={loading}>
              {loading ? 'Joining…' : 'Join Room'}
            </Button>
            <button onClick={() => { setView('choose'); setError(''); }}
              className="text-white/40 text-sm hover:text-white transition-colors text-center">
              ← Back
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
