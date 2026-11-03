// "dark" = the logo sits on a dark background
type Tone = "light" | "dark";

// tasklace mark; on dark backgrounds it gets a white tile so the navy strokes stay visible
export function LogoMark({ size = 28, tone = "light" }: { size?: number; tone?: Tone }) {
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src="/logo-mark.png" alt="" width={size} height={size} className="block" draggable={false} />;
  if (tone === "light") return img;
  return (
    <span className="inline-flex rounded-lg bg-white shadow-sm" style={{ padding: Math.round(size * 0.14) }}>
      {img}
    </span>
  );
}

// mark plus the two-tone wordmark
export function Logo({ size = 28, tone = "light", className = "" }: { size?: number; tone?: Tone; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <LogoMark size={size} tone={tone} />
      <span>
        <span className={tone === "dark" ? "text-white" : "text-[#0f1c4d]"}>Task</span>
        <span className={tone === "dark" ? "text-[#67d8f0]" : "text-[#12a3c9]"}>lace</span>
      </span>
    </span>
  );
}
