/** A small upright traffic light (lucide has none). */
export function TrafficLightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 24" className={className} aria-hidden>
      <rect x="1" y="1" width="10" height="22" rx="3" fill="#111827" stroke="#ffffff" strokeWidth="1.2" />
      <circle cx="6" cy="6" r="2.2" fill="#ef4444" />
      <circle cx="6" cy="12" r="2.2" fill="#f59e0b" />
      <circle cx="6" cy="18" r="2.2" fill="#22c55e" />
    </svg>
  );
}
