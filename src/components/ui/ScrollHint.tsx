"use client";
import { useEffect, useState, type RefObject } from "react";

type Axis = "x" | "y";

// true while the element can still scroll further along the axis
export function useScrollMore(box: RefObject<HTMLElement | null>, axis: Axis) {
  const [more, setMore] = useState(false);

  // recheck on scroll and whenever the box or its content changes size
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const check = () =>
      setMore(axis === "y" ? el.scrollHeight - el.clientHeight - el.scrollTop > 8 : el.scrollWidth - el.clientWidth - el.scrollLeft > 8);
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    // children cover content growth (cards added, lists loaded)
    for (const c of Array.from(el.children)) ro.observe(c);
    const mo = new MutationObserver(check);
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener("scroll", check);
      ro.disconnect();
      mo.disconnect();
    };
  }, [box, axis]);

  return more;
}

// "scroll" pill (and optional fade) over the end of a scroll box; place inside a `relative` parent.
// fade only makes sense on surface-colored panels, not on board backgrounds.
export function ScrollHint({ box, axis = "y", fade = false }: { box: RefObject<HTMLElement | null>; axis?: Axis; fade?: boolean }) {
  const more = useScrollMore(box, axis);
  const y = axis === "y";

  // jump most of a screen further
  const go = () => {
    const el = box.current;
    if (el) el.scrollBy(y ? { top: el.clientHeight * 0.8, behavior: "smooth" } : { left: el.clientWidth * 0.8, behavior: "smooth" });
  };

  const show = more ? "pointer-events-auto opacity-100" : `opacity-0 ${y ? "translate-y-1" : "translate-x-1"}`;
  return (
    <>
      {fade && (
        <div
          aria-hidden
          className={`pointer-events-none absolute transition-opacity duration-200 ${y ? "inset-x-0 bottom-0 h-10 bg-gradient-to-t" : "inset-y-0 right-0 w-10 bg-gradient-to-l"} from-surface to-transparent ${more ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {/* outer box positions the pill, inner button animates in and out */}
      <div className={`pointer-events-none absolute z-20 ${y ? "bottom-2 left-1/2 -translate-x-1/2" : "top-1/2 right-3 -translate-y-1/2"}`}>
        <button
          type="button"
          tabIndex={more ? 0 : -1}
          onClick={go}
          aria-label={y ? "Gulir ke bawah" : "Gulir ke kanan"}
          // colors come from .scroll-pill (board color, swapped per theme)
          className={`scroll-pill inline-flex items-center gap-1 rounded-full py-1 pr-2 pl-2.5 text-[11px] font-medium text-white shadow-md transition duration-200 hover:brightness-110 ${show}`}
        >
          Scroll
          {/* stacked double chevron, pointing the way to scroll */}
          <svg viewBox="0 0 20 20" className={`h-3 w-3 ${y ? "scroll-nudge" : "scroll-nudge-x"}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={y ? "m6 5.5 4 4 4-4M6 10.5l4 4 4-4" : "m5.5 6 4 4-4 4M10.5 6l4 4-4 4"} />
          </svg>
        </button>
      </div>
    </>
  );
}
