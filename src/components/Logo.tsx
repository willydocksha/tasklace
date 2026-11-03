import { useId } from "react";

// tasklace mark: two interlaced loops on a blue tile
export function LogoMark({ size = 28 }: { size?: number }) {
  // unique gradient id: a shared id breaks when the first copy sits in a hidden element
  const id = "tl" + useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id})`} />
      <path d="M9 19.5c0-4 3.2-7 7-7s7 3 7 7" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M23 12.5c0 4-3.2 7-7 7s-7-3-7-7" fill="none" stroke="#bfdbfe" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

// mark plus the wordmark
export function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <LogoMark size={size} />
      Tasklace
    </span>
  );
}
