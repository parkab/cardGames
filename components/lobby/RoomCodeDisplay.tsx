'use client';

import { useState } from 'react';

interface RoomCodeDisplayProps {
  code: string;
}

export default function RoomCodeDisplay({ code }: RoomCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-white/50 text-sm tracking-widest uppercase">Room Code</p>
      <div className="flex items-center gap-3">
        <span className="text-gold font-mono font-bold text-5xl tracking-[0.3em]">{code}</span>
        <button
          onClick={handleCopy}
          className="text-sm px-3 py-1.5 rounded border border-gold/40 text-gold/70 hover:text-gold hover:border-gold transition-all"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
