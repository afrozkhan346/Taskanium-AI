import { cn } from "@/lib/utils";

export type Energy = "low" | "med" | "high";

const MAP: Record<Energy, { label: string; color: string; shadow: string }> = {
  low: { label: "LO_NRG", color: "bg-led-red text-red-300", shadow: "shadow-led-red" },
  med: { label: "MD_NRG", color: "bg-led-amber text-amber-300", shadow: "shadow-led-amber" },
  high: { label: "HI_NRG", color: "bg-led-amber text-amber-400", shadow: "shadow-led-amber" },
};

export function EnergyBadge({ energy }: { energy: Energy }) {
  const m = MAP[energy];
  const textColor =
    energy === "low" ? "text-red-400" : energy === "med" ? "text-amber-300" : "text-amber-400";
  return (
    <div className="flex items-center gap-2 rounded-sm border-2 border-zinc-800 bg-screen-dark px-2.5 py-1.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
      <div className={cn("led-pulse size-2 rounded-full", m.color.split(" ")[0], m.shadow)} />
      <span className={cn("font-mono text-[10px] tracking-tight", textColor)}>{m.label}</span>
    </div>
  );
}
