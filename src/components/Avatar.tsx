export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

// profile photo when set, else colored initials; online adds a status dot (undefined = no dot)
export function Avatar({ online, ...props }: AvatarProps & { online?: boolean }) {
  if (online === undefined) return <AvatarFace {...props} />;
  // dot scales with the avatar but never gets too small to see
  const dot = Math.max(7, Math.round((props.size ?? 28) * 0.3));
  return (
    <span className="relative inline-flex shrink-0" title={props.noTitle ? undefined : `${props.name} · ${online ? "online" : "offline"}`}>
      <AvatarFace {...props} />
      <span
        className={`absolute bottom-0 right-0 rounded-full ring-2 ring-surface ${online ? "bg-green-500" : "bg-slate-400"}`}
        style={{ width: dot, height: dot }}
      />
    </span>
  );
}

// noTitle: skip the native tooltip (used when a hover card shows the details)
type AvatarProps = { name: string; color: string; src?: string | null; size?: number; ring?: boolean; noTitle?: boolean };

// the photo or initials circle itself
function AvatarFace({ name, color, src, size = 28, ring, noTitle }: AvatarProps) {
  const title = noTitle ? undefined : name;
  const cls = `inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${ring ? "ring-2 ring-surface" : ""}`;
  if (src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} title={title} referrerPolicy="no-referrer" className={`${cls} bg-slate-200 object-cover`} style={{ width: size, height: size }} />;
  return (
    <span title={title} className={cls} style={{ background: color, width: size, height: size, fontSize: size * 0.4 }}>
      {initials(name)}
    </span>
  );
}
