import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface ChassisProps {
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
  label?: string;
  version?: string;
}

export function Chassis({ children, className, size = "md", label, version }: ChassisProps) {
  return (
    <div
      className={cn(
        "relative rounded-xl border-2 border-chassis-edge bg-chassis shadow-chassis",
        size === "sm" && "p-5",
        size === "md" && "p-6",
        size === "lg" && "p-7",
        className,
      )}
    >
      {/* Corner screws */}
      <Screw className="top-3 left-3" />
      <Screw className="top-3 right-3" />
      <Screw className="bottom-3 left-3" />
      <Screw className="bottom-3 right-3" />

      {label && (
        <div className="mb-5 flex items-end justify-between border-b-2 border-chassis-dark px-1 pb-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {label}
          </h2>
          {version && (
            <span className="font-mono text-xs text-muted-foreground/70">{version}</span>
          )}
        </div>
      )}

      {children}
    </div>
  );
}

function Screw({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "absolute size-2.5 rounded-full bg-chassis-dark shadow-[inset_0_2px_3px_rgba(0,0,0,0.3),_0_1px_1px_rgba(255,255,255,0.8)]",
        className,
      )}
    >
      <div className="absolute left-1/2 top-1/2 h-px w-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-black/20" />
    </div>
  );
}
