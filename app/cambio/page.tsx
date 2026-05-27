'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PokerBackground from '@/components/layout/PokerBackground';
import Navbar from '@/components/layout/Navbar';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

type ModalView = 'choose' | 'create' | 'join';

export default function CambioPage() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [view, setView] = useState<ModalView>('choose');
  const [nickname, setNickname] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const openModal = useCallback((startView: ModalView = 'choose') => {
    setModalOpen(true);
    setView(startView);
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
        body: JSON.stringify({ nickname: nickname.trim(), gameType: 'cambio' }),
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

  const CARD_VALUES = [
    { rank: 'A', pts: '−1', color: 'text-green-400' },
    { rank: 'K', pts: '0', color: 'text-green-400' },
    { rank: '2–9', pts: '2–9', color: 'text-white/60' },
    { rank: '10', pts: '10', color: 'text-white/60' },
    { rank: 'J', pts: '11', color: 'text-red-400' },
    { rank: 'Q', pts: '12 + peek-swap', color: 'text-red-400' },
  ];

  return (
    <>
      <PokerBackground />
      <div className="relative min-h-screen flex flex-col">
        <Navbar />

        <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-14 flex flex-col gap-10">
          {/* Title */}
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-gold/10 border-2 border-gold flex items-center justify-center mx-auto mb-5">
              <span className="text-gold text-3xl font-display font-bold">♻</span>
            </div>
            <h1 className="text-4xl font-display text-white tracking-widest mb-2">Cambio</h1>
            <p className="text-white/50">Memory and bluffing. Lowest score wins. Call Cambio to end the game.</p>
          </div>

          {/* CTA buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => openModal()}
              className="group gold-border rounded-xl p-6 bg-felt-dark/60 hover:bg-gold/10 transition-all text-center"
            >
              <div className="text-3xl mb-2">🏠</div>
              <h2 className="text-gold font-display text-lg tracking-wide mb-1">Create Lobby</h2>
              <p className="text-white/40 text-sm">Start a private room and invite friends</p>
            </button>
            <button
              onClick={() => openModal()}
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
                { icon: '🃏', title: '4 Cards Each', desc: 'Each player gets 4 face-down cards. Peek at your bottom 2 at the start.' },
                { icon: '🔄', title: 'Swap & Bluff', desc: 'Draw from the deck each turn. Swap to lower your score or discard to use card abilities.' },
                { icon: '📣', title: 'Call Cambio', desc: 'When you think your hand is low enough, call Cambio. Everyone else gets one more turn, then scores are tallied.' },
              ].map((item) => (
                <div key={item.title} className="text-center">
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <h3 className="text-gold/80 font-display mb-1">{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
              ))}
            </div>

            {/* Card values */}
            <div className="mt-5 pt-4 border-t border-white/5">
              <p className="text-gold/40 text-[10px] tracking-widest uppercase text-center mb-3">Card Values</p>
              <div className="grid grid-cols-3 gap-1.5">
                {CARD_VALUES.map((v) => (
                  <div key={v.rank} className="flex items-center justify-between bg-black/20 rounded px-2 py-1">
                    <span className="text-white/50 text-xs font-mono">{v.rank}</span>
                    <span className={`text-xs font-mono ${v.color}`}>{v.pts}</span>
                  </div>
                ))}
              </div>
              <p className="text-white/20 text-[10px] text-center mt-2">9: peek own card · 10: peek opponent · J: blind swap · Q: peek+swap</p>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 text-center text-white/30 text-xs font-mono">
              2–10 players · 60s turn limit · No account required
            </div>
          </section>
        </main>
      </div>

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={closeModal} title="Cambio">
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
              Creating a Cambio room as <span className="text-gold">{nickname}</span>
            </p>
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
