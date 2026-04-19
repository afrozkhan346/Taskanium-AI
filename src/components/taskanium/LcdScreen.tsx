import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface LcdScreenProps {
  children: ReactNode;
  className?: string;
  showCursor?: boolean;
}

export function LcdScreen({ children, className, showCursor }: LcdScreenProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-sm border-4 border-lcd-edge bg-lcd-bg p-4 shadow-lcd-inset",
        className,
      )}
    >
      <div className="lcd-scanlines pointer-events-none absolute inset-0" />
      <div className="relative font-mono text-lcd-text">
        {children}
        {showCursor && <span className="cursor-blink ml-0.5 inline-block h-5 w-2.5 bg-lcd-text align-middle" />}
      </div>
    </div>
  );
}

interface DarkScreenProps {
  children: ReactNode;
  className?: string;
  topRight?: ReactNode;
}

export function DarkScreen({ children, className, topRight }: DarkScreenProps) {
  return (
    <div
      className={cn(
        "relative rounded-sm border-[3px] border-zinc-800 bg-screen-dark p-3.5 shadow-screen-inset",
        className,
      )}
    >
      {topRight && (
        <span className="absolute right-2 top-1.5 font-mono text-[9px] tracking-widest text-zinc-500">
          {topRight}
        </span>
      )}
      <div className="font-mono text-screen-text">{children}</div>
    </div>
  );
}
