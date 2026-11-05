"use client";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { PRIORITY_META, TYPE_META } from "@/lib/theme";
import type { User } from "@/lib/auth";
import type { Activity, Comment } from "@/lib/types";
import { useBoard } from "./context";
import { Icon, type IconName } from "@/components/ui/Icon";

type Tab = "all" | "activity" | "comments" | "status";
type Item = { at: number; activity?: Activity; comment?: Comment };

// relative time for the feed ("5 menit lalu"), full date on hover
export function ago(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "baru saja";
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} hari lalu`;
  return new Date(ts).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
const full = (ts: number) => new Date(ts).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
const date = (v: unknown) => (v ? new Date(`${v}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : null);

// inline chip used inside activity sentences
const Chip = ({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "blue" }) => (
  <span className={`mx-0.5 inline-flex items-center rounded-md px-1.5 py-px text-xs font-medium ${tone === "green" ? "bg-green-100 text-green-700" : tone === "blue" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"}`}>{children}</span>
);

// one activity row as a sentence; done list ids get a green chip
function describe(a: Activity, doneLists: Set<string>): { icon: IconName; text: React.ReactNode } {
  const d = a.data as Record<string, never>;
  const label = (k: keyof typeof TYPE_META | keyof typeof PRIORITY_META, meta: Record<string, { label: string }>) => meta[k]?.label ?? k;
  const list = (names: unknown) => (names as string[]).filter(Boolean).join(", ");
  switch (a.kind) {
    case "created":
      return { icon: "plus", text: <>membuat kartu di <Chip tone={doneLists.has(d.to) ? "green" : "slate"}>{d.toName ?? "?"}</Chip></> };
    case "status":
      return { icon: "swap", text: <>memindahkan <Chip>{d.fromName ?? "?"}</Chip> → <Chip tone={doneLists.has(d.to) ? "green" : "blue"}>{d.toName ?? "?"}</Chip></> };
    case "title":
      return { icon: "pencil", text: <>mengubah judul jadi <b>“{d.to}”</b></> };
    case "description":
      return { icon: "pencil", text: <>memperbarui deskripsi</> };
    case "type":
      return { icon: "shape", text: <>mengubah tipe <Chip>{label(d.from, TYPE_META)}</Chip> → <Chip>{label(d.to, TYPE_META)}</Chip></> };
    case "priority":
      return { icon: "flag", text: <>mengubah prioritas <Chip>{label(d.from, PRIORITY_META)}</Chip> → <Chip>{label(d.to, PRIORITY_META)}</Chip></> };
    case "points":
      return { icon: "hash", text: <>mengubah poin <Chip>{d.from ?? "–"}</Chip> → <Chip>{d.to ?? "–"}</Chip></> };
    case "start_date":
    case "due_date": {
      const what = a.kind === "due_date" ? "deadline" : "tanggal mulai";
      return { icon: "clock", text: d.to ? <>mengatur {what} <Chip>{date(d.to)}</Chip></> : <>menghapus {what}</> };
    }
    case "epic":
      return { icon: "epic", text: d.to ? <>menghubungkan ke epic <Chip>{d.to}</Chip></> : <>melepas dari epic</> };
    case "sprint":
      return { icon: "sprint", text: <>{d.auto ? "sprint selesai, kartu dipindah ke " : "memindahkan ke "}<Chip>{d.to ?? "Backlog"}</Chip></> };
    case "labels":
    case "assignees": {
      const [plus, minus] = a.kind === "labels" ? ["menambah label", "menghapus label"] : ["menugaskan", "melepas"];
      return {
        icon: a.kind === "labels" ? "tag" : "user",
        text: (
          <>
            {(d.added as unknown[])?.length > 0 && <>{plus} <Chip>{list(d.added)}</Chip></>}
            {(d.added as unknown[])?.length > 0 && (d.removed as unknown[])?.length > 0 && ", "}
            {(d.removed as unknown[])?.length > 0 && <>{minus} <Chip>{list(d.removed)}</Chip></>}
          </>
        ),
      };
    }
    case "attachment":
      return { icon: "paperclip", text: d.removed ? <>menghapus lampiran <Chip>{d.name}</Chip></> : <>melampirkan <Chip>{d.name}</Chip></> };
    case "subtask":
      if (d.action === "assignees")
        return {
          icon: "checklist",
          text: (
            <>
              subtask <b>“{d.title}”</b>:{" "}
              {(d.added as unknown[])?.length > 0 && <>menugaskan <Chip>{list(d.added)}</Chip></>}
              {(d.added as unknown[])?.length > 0 && (d.removed as unknown[])?.length > 0 && ", "}
              {(d.removed as unknown[])?.length > 0 && <>melepas <Chip>{list(d.removed)}</Chip></>}
            </>
          ),
        };
      if (d.action === "status") return { icon: "checklist", text: <>subtask <b>“{d.title}”</b> <Chip>{d.fromName ?? "?"}</Chip> → <Chip tone={doneLists.has(d.to) ? "green" : "blue"}>{d.toName ?? "?"}</Chip></> };
      return { icon: "checklist", text: <>{d.action === "removed" ? "menghapus" : "menambah"} subtask <b>“{d.title}”</b></> };
    default:
      return { icon: "note", text: <>mengubah kartu</> };
  }
}

// activity + comments with "semua / aktivitas / komentar / status" tabs and the comment box
export function ActivityFeed({ activity, comments, user, doneLists, onComment, journey }: {
  activity: Activity[];
  comments: Comment[];
  user: User;
  doneLists: Set<string>;
  // missing when the user may not comment
  onComment?: (text: string) => Promise<void>;
  // status journey, shown in its own tab
  journey?: React.ReactNode;
}) {
  // online dot on commenters
  const { isOnline } = useBoard();
  const [tab, setTab] = useState<Tab>("all");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  // newest first, merged by timestamp (status tab has no feed)
  const items: Item[] = tab === "status" ? [] : [
    ...(tab !== "comments" ? activity.map((a) => ({ at: a.created_at, activity: a })) : []),
    ...(tab !== "activity" ? comments.map((c) => ({ at: c.created_at, comment: c })) : []),
  ].sort((a, b) => b.at - a.at);

  async function send() {
    if (!text.trim() || sending || !onComment) return;
    setSending(true);
    try {
      await onComment(text);
      setText("");
    } finally {
      setSending(false);
    }
  }

  const tabs: [Tab, string, number | null][] = [
    ["all", "Semua", activity.length + comments.length],
    ["activity", "Aktivitas", activity.length],
    ["comments", "Komentar", comments.length],
    ...(journey ? [["status", "Perjalanan Status", null] as [Tab, string, null]] : []),
  ];

  return (
    <div>
      {/* tab bar */}
      <div className="mb-3 flex items-center gap-1 border-b border-slate-200">
        {tabs.map(([id, label, n]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`relative -mb-px flex items-center gap-1.5 border-b-2 px-2.5 pt-1 pb-2 text-sm transition ${tab === id ? "border-blue-600 font-medium text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {label}
            {n !== null && <span className={`rounded-full px-1.5 text-[11px] ${tab === id ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>{n}</span>}
          </button>
        ))}
      </div>

      {/* comment box (only where comments are listed) */}
      {onComment && (tab === "all" || tab === "comments") && (
        <div className="mb-4 flex gap-2">
          <Avatar name={user.name} color={user.color} src={user.avatar} size={30} />
          <div className="flex-1 space-y-2">
            <textarea
              rows={2}
              className="w-full resize-y rounded-lg border border-slate-200 bg-surface p-2.5 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition outline-none placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-400 focus:ring-3 focus:ring-blue-100"
              placeholder="Tulis komentar… (⌘Enter untuk kirim)"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
              }}
            />
            {text && (
              <button onClick={send} disabled={sending} className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 dark:hover:bg-blue-500 disabled:opacity-60">
                {sending ? "Mengirim…" : "Kirim"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* status journey (own tab) */}
      {tab === "status" && journey && <div className="rounded-xl border border-slate-200 bg-surface p-4">{journey}</div>}

      {/* feed */}
      {tab !== "status" && items.length === 0 && <div className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">{tab === "comments" ? "Belum ada komentar" : "Belum ada aktivitas"}</div>}
      <ol className="space-y-3">
        {items.map((it) =>
          it.comment ? (
            <li key={`c${it.comment.id}`} className="flex gap-2">
              <Avatar name={it.comment.name} color={it.comment.color} src={it.comment.avatar} size={30} online={isOnline(it.comment.user_id)} />
              <div className="min-w-0 flex-1">
                <div className="text-xs">
                  <b>{it.comment.name}</b> <span className="text-slate-400" title={full(it.at)}>{ago(it.at)}</span>
                </div>
                <div className="mt-1 rounded-lg rounded-tl-sm bg-surface p-2.5 text-sm whitespace-pre-wrap shadow-sm ring-1 ring-slate-200">{it.comment.body}</div>
              </div>
            </li>
          ) : (
            <ActivityRowView key={`a${it.activity!.id}`} a={it.activity!} doneLists={doneLists} />
          ),
        )}
      </ol>
    </div>
  );
}

// compact activity line: small icon bubble, actor, sentence, time
function ActivityRowView({ a, doneLists }: { a: Activity; doneLists: Set<string> }) {
  const { icon, text } = describe(a, doneLists);
  return (
    <li className="flex gap-2 text-sm">
      <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-500 ring-4 ring-surface"><Icon name={icon} className="h-3.5 w-3.5" /></span>
      </span>
      <div className="min-w-0 flex-1 pt-1 leading-relaxed text-slate-600">
        <b className="text-slate-800">{a.name ?? "Pengguna terhapus"}</b> {text}
        <span className="ml-1.5 text-xs text-slate-400" title={full(a.created_at)}>{ago(a.created_at)}</span>
      </div>
    </li>
  );
}
