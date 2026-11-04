import { initials } from "@/components/Avatar";

// team photo when set, else initials on a gradient tile
export function TeamAvatar({ name, src, size = 28 }: { name: string; src?: string | null; size?: number }) {
  const style = { width: size, height: size, borderRadius: size * 0.25 };
  if (src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} title={name} className="shrink-0 bg-slate-200 object-cover" style={style} />;
  return (
    <span title={name} className="inline-flex shrink-0 items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 font-bold text-white" style={{ ...style, fontSize: size * 0.4 }}>
      {initials(name) || "?"}
    </span>
  );
}
