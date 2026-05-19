'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';

interface SolutionInputProps {
  disabled: boolean;
  onSubmit: (expression: string) => void;
  onSkipVote: () => void;
  skipVotes: number;
  skipRequired: number;
  hasVotedSkip: boolean;
}

export default function SolutionInput({
  disabled,
  onSubmit,
  onSkipVote,
  skipVotes,
  skipRequired,
  hasVotedSkip,
}: SolutionInputProps) {
  const [value, setValue] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Only allow digits, spaces, and operators
    const filtered = e.target.value.replace(/[^0-9 +\-*/%().]/g, '');
    setValue(filtered);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    onSubmit(value.trim());
    setValue('');
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          placeholder={disabled ? 'Eliminated this round…' : 'e.g.  3 * 9 - 8 + 2'}
          className="
            flex-1 bg-felt-dark border border-gold/40 text-white placeholder-white/25
            rounded-md px-4 py-2.5 focus:outline-none focus:border-gold
            font-mono text-lg disabled:opacity-40 transition-all
          "
        />
        <Button type="submit" disabled={disabled || !value.trim()}>
          Submit
        </Button>
      </form>

      <div className="flex items-center justify-between text-sm">
        <p className="text-white/30 text-xs font-mono">
          Left-to-right evaluation — no order of operations
        </p>
        <button
          onClick={onSkipVote}
          disabled={disabled || hasVotedSkip}
          className={`text-xs px-3 py-1 rounded border transition-all
            ${hasVotedSkip
              ? 'border-white/20 text-white/30 cursor-not-allowed'
              : 'border-white/30 text-white/50 hover:border-gold/50 hover:text-gold/70'}
          `}
        >
          Skip ({skipVotes}/{skipRequired})
        </button>
      </div>
    </div>
  );
}
