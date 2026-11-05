"use client";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { PopoverPanel, usePopover } from "@/components/ui/Popover";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { ROLE_LABEL, type Role } from "@/lib/permissions";
import { ago } from "@/lib/text";
import type { Member } from "@/lib/types";
import { statusOf } from "@/lib/usePresence";
import { useBoard } from "./context";
import { MemberAvatar } from "./MemberAvatar";

// avatars shown in the stack before the rest collapse into "+N"
const MAX = 5;
// show a search box in the full list from this many members
const SEARCH_FROM = 8;

// overlapping member avatars in the board header: online first, then by name.
// the first avatar sits on top; hovering the stack spreads them out side by side.
export function MemberStack({ onManage }: { onManage: () => void }) {
  const { data, presence } = useBoard();

  // online first, then name a-z
  const sorted = useMemo(() => {
    const on = (m: Member) => Number(!!presence?.online.has(m.id));
    return [...data.members].sort((a, b) => on(b) - on(a) || a.name.localeCompare(b.name, "id"));
  }, [data.members, presence]);

  const shown = sorted.slice(0, MAX);
  const rest = sorted.length - shown.length;
  // overlap by default, small gap while the stack is hovered
  const slot = (i: number) => (i ? "-ml-2 group-hover/stack:ml-1" : "");

  return (
    <div className="group/stack flex items-center">
      {shown.map((m, i) => (
        // earlier avatars get a higher z-index so #1 is in front
        <button key={m.id} type="button" onClick={onManage} className={`relative flex rounded-full transition-[margin] duration-200 ${slot(i)}`} style={{ zIndex: MAX + 1 - i }}>
          <MemberAvatar person={m} size={28} ring />
        </button>
      ))}
      {rest > 0 && <MoreMembers members={sorted} count={rest} className={`relative transition-[margin] duration-200 ${slot(1)}`} onManage={onManage} />}
    </div>
  );
}

// "+N" chip that opens the full, searchable and scrollable member list
function MoreMembers({ members, count, className, onManage }: { members: Member[]; count: number; className: string; onManage: () => void }) {
  const { presence } = useBoard();
  const pop = usePopover({ placement: "bottom-end" });
  const [q, setQ] = useState("");

  // match on name or email
  const needle = q.trim().toLowerCase();
  const list = needle ? members.filter((m) => m.name.toLowerCase().includes(needle) || m.email.toLowerCase().includes(needle)) : members;
  const onlineCount = members.filter((m) => presence?.online.has(m.id)).length;

  return (
    <>
      <button
        ref={pop.refs.setReference}
        type="button"
        onClick={() => pop.setOpen(!pop.open)}
        title={`${count} member lainnya`}
        className={`flex h-7 min-w-7 items-center justify-center rounded-full bg-white/30 px-1.5 text-xs font-semibold text-white ring-2 ring-surface hover:bg-white/45 ${className}`}
        style={{ zIndex: 0 }}
      >
        +{count}
      </button>
      <PopoverPanel pop={pop} className="w-72">
        {/* header: totals and optional search */}
        <div className="border-b border-slate-100 p-2.5">
          <div className="text-sm font-semibold">
            {members.length} member
            {presence && <span className="ml-1.5 font-normal text-slate-500">· {onlineCount} online</span>}
          </div>
          {members.length >= SEARCH_FROM && (
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari member…" className="mt-2 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400" />
          )}
        </div>
        {/* scrollable rows with a scroll hint when the list is long */}
        <ScrollArea wrapperClassName="flex min-h-0 flex-1 flex-col" className="scroll-thin max-h-72 min-h-0 overflow-y-auto p-1">
          {list.map((m) => {
            const st = statusOf(presence, m.id);
            return (
              <div key={m.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
                <Avatar name={m.name} color={m.color} src={m.avatar} size={28} online={st?.online} noTitle />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{m.name}</div>
                  <div className="truncate text-xs text-slate-500">
                    {st ? (st.online ? <span className="text-green-600">Online</span> : st.seen ? `Aktif ${ago(st.seen)}` : "Offline") : m.email}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{ROLE_LABEL[m.role as Role] ?? m.role}</span>
              </div>
            );
          })}
          {!list.length && <div className="px-2 py-4 text-center text-sm text-slate-400">Tidak ada member yang cocok</div>}
        </ScrollArea>
        {/* shortcut to the full member settings */}
        <button type="button" onClick={() => (pop.setOpen(false), onManage())} className="border-t border-slate-100 px-3 py-2 text-left text-sm font-medium text-blue-600 hover:bg-slate-50">
          Kelola member
        </button>
      </PopoverPanel>
    </>
  );
}
