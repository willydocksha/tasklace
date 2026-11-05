"use client";
import { useEffect, useRef } from "react";
import { ago } from "@/lib/text";
import type { Status } from "@/lib/usePresence";
import { Avatar } from "./Avatar";
import { PopoverPanel, usePopover } from "./ui/Popover";

export type Person = { id: string; name: string; color: string; avatar: string | null };
// extra details shown in the card; all optional
export type PersonInfo = { email?: string | null; username?: string | null; role?: string | null; status?: Status };

// hover delays: open slowly so moving across avatars does not flash cards
const OPEN_MS = 300;
const CLOSE_MS = 150;

// avatar that shows a small profile card (name, username, email, role, status) on hover
export function AvatarCard({ person, info, size, ring }: { person: Person; info: PersonInfo; size?: number; ring?: boolean }) {
  const pop = usePopover({ placement: "bottom" });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { setOpen } = pop;

  // open/close after a short delay; entering the card keeps it open
  const later = (open: boolean) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(open), open ? OPEN_MS : CLOSE_MS);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const status = info.status;
  return (
    <>
      <span ref={pop.refs.setReference} className="inline-flex shrink-0" onMouseEnter={() => later(true)} onMouseLeave={() => later(false)}>
        <Avatar name={person.name} color={person.color} src={person.avatar} size={size} ring={ring} online={status?.online} noTitle />
      </span>
      <PopoverPanel pop={pop} className="w-64 p-3">
        <div onMouseEnter={() => clearTimeout(timer.current)} onMouseLeave={() => later(false)} className="flex gap-3">
          <Avatar name={person.name} color={person.color} src={person.avatar} size={44} online={status?.online} noTitle />
          <div className="min-w-0 flex-1">
            {/* name and handle */}
            <div className="truncate text-sm font-semibold">{person.name}</div>
            {info.username && <div className="truncate text-xs text-slate-500">@{info.username}</div>}
            {info.email && <div className="truncate text-xs text-slate-500">{info.email}</div>}
            {/* role and online status */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              {info.role && <span className="rounded bg-slate-100 px-1.5 py-px font-medium text-slate-600">{info.role}</span>}
              {status && (
                <span className={`flex items-center gap-1 ${status.online ? "text-green-600" : "text-slate-500"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${status.online ? "bg-green-500" : "bg-slate-400"}`} />
                  {status.online ? "Online" : status.seen ? `Terakhir aktif ${ago(status.seen)}` : "Offline"}
                </span>
              )}
            </div>
          </div>
        </div>
      </PopoverPanel>
    </>
  );
}
