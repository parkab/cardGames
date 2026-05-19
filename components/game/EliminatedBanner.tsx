export default function EliminatedBanner() {
  return (
    <div className="rounded-lg border border-red-600/40 bg-red-900/20 px-4 py-3 text-center text-red-300 text-sm animate-fade-in">
      You&apos;ve been eliminated this round.{' '}
      <span className="text-white/60">You&apos;ll rejoin next round.</span>
    </div>
  );
}
