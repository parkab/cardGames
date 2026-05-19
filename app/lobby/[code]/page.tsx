'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import PokerBackground from '@/components/layout/PokerBackground';
import Navbar from '@/components/layout/Navbar';
import PlayerList from '@/components/lobby/PlayerList';
import RoomCodeDisplay from '@/components/lobby/RoomCodeDisplay';
import StartButton from '@/components/lobby/StartButton';
import { useAbly } from '@/hooks/useAbly';
import type { RoomState, Player } from '@/types';

export default function LobbyPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  const [playerId, setPlayerId] = useState('');
  const [room, setRoom] = useState<RoomState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [starting, setStarting] = useState(false);

  // Load player identity from localStorage
  useEffect(() => {
    const id = localStorage.getItem('playerId') ?? '';
    setPlayerId(id);
  }, []);

  // Fetch current room state
  useEffect(() => {
    if (!code) return;

    async function fetchRoom() {
      // We join or re-fetch state by checking the room API
      const res = await fetch(`/api/room/state?code=${code}`);
      if (res.ok) {
        const data = await res.json();
        setRoom(data.roomState);
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

    subscribe('game:started', () => {
      router.push(`/game/${code}`);
    });

    return () => {
      unsubscribe('room:player_joined');
      unsubscribe('room:player_left');
      unsubscribe('game:started');
    };
  }, [playerId, code]);

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

          {/* How to play blurb */}
          <div className="bg-felt-dark/40 rounded-lg border border-white/5 p-4 text-white/40 text-xs leading-relaxed">
            <strong className="text-gold/60 block mb-1">How to play Make 21</strong>
            4 cards are dealt each round. Use +, −, ×, ÷ evaluated{' '}
            <em>left-to-right</em> (no order of operations) to reach exactly 21.
            First player to submit a correct answer earns a point.
            Wrong answer? You sit out until next round.
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
