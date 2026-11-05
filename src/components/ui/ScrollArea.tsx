"use client";
import { useRef } from "react";
import { ScrollHint } from "./ScrollHint";

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
  return (
    <div className={`relative ${wrapperClassName}`} data-tour={tour}>
      <div ref={box} className={className}>
        <div className={innerClassName}>{children}</div>
      </div>
      <ScrollHint box={box} fade />
    </div>
  );
}
