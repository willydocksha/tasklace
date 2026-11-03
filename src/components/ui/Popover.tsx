"use client";
import { autoUpdate, flip, offset, shift, size, useFloating, type Placement } from "@floating-ui/react-dom";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// floating panel anchored to a trigger; flips/shifts to stay on screen
export function usePopover({ placement = "bottom-start", matchWidth = false }: { placement?: Placement; matchWidth?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const fl = useFloating({
    open,
    placement,
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(6),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      // cap height to the free space; optionally at least as wide as the trigger
      size({
        padding: 8,
        apply({ availableHeight, rects, elements }) {
          elements.floating.style.maxHeight = `${Math.max(160, Math.min(availableHeight, 420))}px`;
          if (matchWidth) elements.floating.style.minWidth = `${rects.reference.width}px`;
        },
      }),
    ],
  });

  // close on outside pointer down
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (fl.refs.floating.current?.contains(t) || (fl.refs.reference.current as Element | null)?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, fl.refs]);

  return { open, setOpen, ...fl };
}

// portal + panel chrome shared by every dropdown
export function PopoverPanel({ pop, children, className = "", onKeyDown }: {
  pop: ReturnType<typeof usePopover>;
  children: React.ReactNode;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}) {
  if (!pop.open) return null;
  return createPortal(
    <div
      ref={pop.refs.setFloating}
      // hidden until floating-ui has measured, so it never flashes at 0,0
      style={{ ...pop.floatingStyles, opacity: pop.isPositioned ? undefined : 0 }}
      onKeyDown={onKeyDown}
      // keep clicks inside from reaching modal backdrops
      onMouseDown={(e) => e.stopPropagation()}
      className={`z-[100] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.28)] ring-1 ring-black/[0.03] animate-[pop_120ms_ease-out] ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}
