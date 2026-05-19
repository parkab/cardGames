'use client';

import Button from '@/components/ui/Button';

interface StartButtonProps {
  isHost: boolean;
  playerCount: number;
  onStart: () => void;
  loading?: boolean;
}

export default function StartButton({ isHost, playerCount, onStart, loading }: StartButtonProps) {
  if (!isHost) {
    return (
      <p className="text-center text-white/40 text-sm">
        Waiting for the host to start the game…
      </p>
    );
  }

  return (
    <Button
      size="lg"
      onClick={onStart}
      disabled={loading}
      className="w-full"
    >
      {loading ? 'Starting…' : 'Start Game'}
    </Button>
  );
}
