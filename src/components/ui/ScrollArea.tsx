"use client";
import { useEffect, useRef, useState } from "react";

// scrollable panel that shows a "scroll" hint while there is more content below
export function ScrollArea({ children, className = "", innerClassName = "", wrapperClassName = "", tour }: {
  children: React.ReactNode;
  // classes for the scrolling element (overflow, height, padding)
  className?: string;
  // classes for the content inside it (spacing between children)
  innerClassName?: string;
  // classes for the outer positioned box (grid/flex sizing)
  wrapperClassName?: string;
  tour?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  // recheck on scroll and whenever the panel or its content changes size
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const check = () => setMore(el.scrollHeight - el.clientHeight - el.scrollTop > 8);
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (inner.current) ro.observe(inner.current);
    return () => {
      el.removeEventListener("scroll", check);
      ro.disconnect();
    };
  }, []);

  // jump most of a screen down
  const scrollDown = () => box.current?.scrollBy({ top: box.current.clientHeight * 0.8, behavior: "smooth" });

  return (
    <div className={`relative ${wrapperClassName}`} data-tour={tour}>
      <div ref={box} className={className}>
        <div ref={inner} className={innerClassName}>{children}</div>
      </div>
      {/* soft fade and pill at the bottom edge, gone once the end is reached */}
      <div aria-hidden className={`pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface to-transparent transition-opacity duration-200 ${more ? "opacity-100" : "opacity-0"}`} />
      <button
        type="button"
        tabIndex={more ? 0 : -1}
        onClick={scrollDown}
        aria-label="Gulir ke bawah"
        className={`absolute bottom-2 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-slate-800/80 py-1 pr-2 pl-2.5 text-[11px] font-medium text-white shadow-md backdrop-blur transition duration-200 hover:bg-slate-800 dark:bg-slate-200/90 dark:text-slate-900 ${more ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0"}`}
      >
        Scroll
        {/* stacked double chevron */}
        <svg viewBox="0 0 20 20" className="scroll-nudge h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 5.5 4 4 4-4M6 10.5l4 4 4-4" />
        </svg>
      </button>
    </div>
  );
}
