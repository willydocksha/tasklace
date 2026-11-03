"use client";
import Link from "next/link";
import { api } from "@/lib/client";
import type { User } from "@/lib/auth";
import { Avatar } from "./Avatar";

export function TopBar({ user, dark }: { user: User; dark?: boolean }) {
  async function logout() {
    await api("/api/auth/logout", "POST");
    window.location.href = "/login";
  }
  return (
    <header className={`flex h-12 items-center gap-3 px-4 ${dark ? "bg-black/25 text-white backdrop-blur" : "bg-blue-700 text-white shadow-sm"}`}>
      <Link href="/boards" className="flex items-center gap-2 font-bold">
        <span>🧶</span> Rajutin
      </Link>
      <Link href="/boards" className="rounded px-2 py-1 text-sm hover:bg-white/20">
        Board saya
      </Link>
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden text-sm sm:inline">{user.name}</span>
        <Avatar name={user.name} color={user.color} />
        <button onClick={logout} className="rounded px-2 py-1 text-sm hover:bg-white/20">
          Keluar
        </button>
      </div>
    </header>
  );
}
