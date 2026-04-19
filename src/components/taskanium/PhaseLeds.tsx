import { cn } from "@/lib/utils";

export type Phase = "start" | "mid" | "end";

const PHASES: { key: Phase; label: string }[] = [
  { key: "start", label: "Start" },
  { key: "mid", label: "Mid" },
  { key: "end", label: "End" },
];

export function PhaseLeds({ phase }: { phase: Phase }) {
  return (
    <div className="flex gap-4 rounded-sm border border-zinc-300 bg-zinc-300/50 p-2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]">
      {PHASES.map((p) => {
        const active = p.key === phase;
        return (
          <div key={p.key} className="flex flex-col items-center gap-1.5">
            <div
              className={cn(
                "size-3 rounded-full border",
                active
                  ? "led-pulse border-emerald-800 bg-led-green shadow-led-green"
                  : "border-zinc-500 bg-led-off shadow-[inset_0_2px_3px_rgba(0,0,0,0.3)]",
              )}
            />
            <span
              className={cn(
                "text-[8px] font-bold uppercase tracking-widest",
                active ? "text-zinc-700" : "text-zinc-400",
              )}
            >
              {p.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
