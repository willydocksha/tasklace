"use client";
import Link from "next/link";
import { api } from "@/lib/client";
import type { User } from "@/lib/auth";
import { useTheme, type ThemeMode } from "@/lib/themeMode";
import { Avatar } from "./Avatar";
import { BoardSwitcher } from "./BoardSwitcher";
import { Logo } from "./Logo";
import { replayTours } from "./Tour";
import { PopoverPanel, usePopover } from "./ui/Popover";

// sun / moon / monitor glyphs for the theme controls
const ICONS: Record<ThemeMode, React.ReactNode> = {
  light: (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="10" cy="10" r="3.4" />
      <path d="M10 2.5v1.6M10 15.9v1.6M2.5 10h1.6M15.9 10h1.6M4.7 4.7l1.1 1.1M14.2 14.2l1.1 1.1M4.7 15.3l1.1-1.1M14.2 5.8l1.1-1.1" />
    </svg>
  ),
  dark: (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <path d="M16.5 12.2A6.8 6.8 0 0 1 7.8 3.5a6.8 6.8 0 1 0 8.7 8.7Z" />
    </svg>
  ),
  system: (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <rect x="2.5" y="3.5" width="15" height="10" rx="1.8" />
      <path d="M7 17h6M10 13.5V17" />
    </svg>
  ),
};

// board: when set (inside a board), shows a switcher after "Board saya"
export function TopBar({ user, dark, board }: { user: User; dark?: boolean; board?: { id: string; name: string; color: string } }) {
  const theme = useTheme();
  const menu = usePopover({ placement: "bottom-end" });

  async function logout() {
    await api("/api/auth/logout", "POST");
    window.location.href = "/login";
  }

  return (
    <header className={`flex h-14 items-center gap-3 px-4 text-white ${dark ? "bg-black/25 backdrop-blur" : "bg-blue-700 shadow-sm dark:bg-[#141a26] dark:shadow-[0_1px_0_#262d3b]"}`}>
      <Link href="/boards">
        <Logo size={22} tone="dark" />
      </Link>
      <Link href="/boards" className="rounded px-2 py-1 text-sm hover:bg-white/20">
        Board saya
      </Link>
      {board && <BoardSwitcher current={board} />}

      <div className="ml-auto flex items-center gap-1.5">
        {/* quick light/dark switch */}
        <button
          onClick={() => theme.set(theme.dark ? "light" : "dark")}
          title={theme.dark ? "Ganti ke tema terang" : "Ganti ke tema gelap"}
          aria-label="Ganti tema"
          className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-white/15"
        >
          {theme.dark ? ICONS.light : ICONS.dark}
        </button>

        {/* profile: name + email on the left, photo on the right */}
        <button
          ref={menu.refs.setReference}
          data-tour="profile"
          onClick={() => menu.setOpen(!menu.open)}
          data-open={menu.open}
          className="flex items-center gap-2.5 rounded-xl py-1 pr-1 pl-2.5 transition hover:bg-white/15 data-[open=true]:bg-white/20"
        >
          <span className="hidden min-w-0 flex-col items-end leading-tight sm:flex">
            <span className="max-w-48 truncate text-sm font-semibold">{user.name}</span>
            <span className="max-w-48 truncate text-xs text-white/70">{user.email}</span>
          </span>
          <Avatar name={user.name} color={user.color} src={user.avatar} size={34} />
        </button>
      </div>

      {/* profile menu */}
      <PopoverPanel pop={menu} className="w-72">
        <div className="flex items-center gap-3 border-b border-slate-100 p-3.5">
          <Avatar name={user.name} color={user.color} src={user.avatar} size={42} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{user.name}</div>
            {user.username && <div className="truncate text-xs text-slate-500">@{user.username}</div>}
            <div className="truncate text-xs text-slate-500">{user.email}</div>
          </div>
        </div>
        <div className="p-1.5">
          <Link href="/profile" onClick={() => menu.setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-slate-100">
            <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10" cy="7" r="3.2" />
              <path d="M3.8 17a6.2 6.2 0 0 1 12.4 0" />
            </svg>
            Edit profil
          </Link>
          {/* replays the walkthrough of the page you're on */}
          <button onClick={() => (menu.setOpen(false), setTimeout(replayTours, 150))} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-slate-100">
            <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10" cy="10" r="7" />
              <path d="M8.2 7.8a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.6M10 13.6v.1" />
            </svg>
            Lihat tutorial halaman ini
          </button>
        </div>

        {/* theme: light / dark / follow os */}
        <div className="border-t border-slate-100 px-3.5 py-3">
          <div className="mb-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Tema</div>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
            {(["light", "dark", "system"] as ThemeMode[]).map((m) => (
              <button
                key={m}
                onClick={() => theme.set(m)}
                className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition ${theme.mode === m ? "bg-surface text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
              >
                {ICONS[m]}
                {m === "light" ? "Terang" : m === "dark" ? "Gelap" : "Sistem"}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-100 p-1.5">
          <button onClick={logout} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-red-600 hover:bg-red-50">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 4H5a1.5 1.5 0 0 0-1.5 1.5v9A1.5 1.5 0 0 0 5 16h3M12.5 13.5 16 10l-3.5-3.5M16 10H8" />
            </svg>
            Keluar
          </button>
        </div>
      </PopoverPanel>
    </header>
  );
}
