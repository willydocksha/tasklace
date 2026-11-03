export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

// profile photo when set, else colored initials
export function Avatar({ name, color, src, size = 28, ring }: { name: string; color: string; src?: string | null; size?: number; ring?: boolean }) {
  const cls = `inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${ring ? "ring-2 ring-surface" : ""}`;
  if (src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} title={name} referrerPolicy="no-referrer" className={`${cls} bg-slate-200 object-cover`} style={{ width: size, height: size }} />;
  return (
    <span title={name} className={cls} style={{ background: color, width: size, height: size, fontSize: size * 0.4 }}>
      {initials(name)}
    </span>
  );
}
