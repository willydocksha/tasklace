"use client";
import { useRef } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { BOARD_COLORS, BOARD_ICONS, BOARD_SCENES, boardBackground, boardBg, type BoardLook } from "@/lib/theme";

// small board marker: background thumbnail with the board icon on top
export function BoardBadge({ board, className = "h-5 w-5 rounded", iconClass = "h-3.5 w-3.5" }: { board: BoardLook; className?: string; iconClass?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center text-white ${className}`} style={{ background: boardBackground(board, true) }}>
      {board.icon && <Icon name={board.icon as IconName} className={`${iconClass} drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]`} />}
    </span>
  );
}

// selected-state ring shared by every swatch
const ring = (on: boolean) => (on ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-surface" : "hover:opacity-90");

// background chooser: upload a photo, pick a built-in scene, or a plain gradient color
export function BackgroundPicker({
  color,
  background,
  photo,
  busy,
  onPick,
  onUpload,
  onRemovePhoto,
}: {
  color: string;
  background: string | null;
  photo: string | null; // thumb url of the uploaded (or picked, not yet uploaded) photo
  busy?: string | null;
  onPick: (v: { color: string } | { background: string | null }) => void;
  onUpload: (f: File) => void;
  onRemovePhoto?: () => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const usingPhoto = !!background?.startsWith("u");
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1.5 text-xs font-medium text-slate-500">Foto</div>
        <div className="grid grid-cols-4 gap-2">
          {/* upload tile */}
          <button
            type="button"
            disabled={!!busy}
            onClick={() => file.current?.click()}
            className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-slate-300 text-[11px] text-slate-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-60"
          >
            <Icon name="upload" />
            {busy ?? "Unggah"}
          </button>
          <input
            ref={file}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) onUpload(f);
            }}
          />
          {/* the board's own photo, removable */}
          {photo && (
            <div className="group relative">
              <button type="button" title="Foto kamu" onClick={() => onPick({ background: "u" })} className={`h-14 w-full rounded-lg bg-cover bg-center ${ring(usingPhoto)}`} style={{ backgroundImage: `url("${photo}")` }} />
              {onRemovePhoto && (
                <button type="button" title="Hapus foto" aria-label="Hapus foto" onClick={onRemovePhoto} className="absolute top-1 right-1 hidden rounded bg-black/55 p-0.5 text-white group-hover:block">
                  <Icon name="x" className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
          {/* built-in scenes */}
          {Object.entries(BOARD_SCENES).map(([k, label]) => (
            <button key={k} type="button" title={label} onClick={() => onPick({ background: `p:${k}` })} className={`h-14 rounded-lg bg-cover bg-center ${ring(background === `p:${k}`)}`} style={{ backgroundImage: `url("/backgrounds/${k}.svg")` }} />
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-xs font-medium text-slate-500">Warna</div>
        <div className="grid grid-cols-6 gap-2">
          {Object.keys(BOARD_COLORS).map((c) => (
            <button key={c} type="button" title={c} onClick={() => onPick({ color: c })} className={`h-8 rounded-md ${ring(!background && color === c)}`} style={{ background: boardBg(c) }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// icon chooser for a board, previewed on its own background
export function IconPicker({ board, onPick }: { board: BoardLook; onPick: (icon: string | null) => void }) {
  return (
    <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
      {/* no icon */}
      <button type="button" title="Tanpa ikon" onClick={() => onPick(null)} className={`flex aspect-square items-center justify-center rounded-md border text-slate-400 ${ring(!board.icon)}`}>
        <Icon name="ban" />
      </button>
      {BOARD_ICONS.map((n) => (
        <button
          key={n}
          type="button"
          title={n}
          onClick={() => onPick(n)}
          className={`flex aspect-square items-center justify-center rounded-md text-white ${ring(board.icon === n)}`}
          style={{ background: boardBackground(board, true) }}
        >
          <Icon name={n} className="h-4 w-4 drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]" />
        </button>
      ))}
    </div>
  );
}
