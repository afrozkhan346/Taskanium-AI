import { useState } from "react";
import { Chassis } from "./Chassis";
import { LcdScreen } from "./LcdScreen";
import { MechButton } from "./MechButton";
import { cn } from "@/lib/utils";
import type { Energy } from "./EnergyBadge";
import { apiStartSession, type SessionData } from "@/api";

interface TaskInputProps {
  onStart: (task: string, energy: Energy, session: SessionData) => void;
}

const ENERGY_OPTIONS: { key: Energy; label: string }[] = [
  { key: "low", label: "LO" },
  { key: "med", label: "MD" },
  { key: "high", label: "HI" },
];

export function TaskInput({ onStart }: TaskInputProps) {
  const [task, setTask] = useState("");
  const [energy, setEnergy] = useState<Energy>("med");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canStart = task.trim().length > 0 && !loading;

  const handleStart = async () => {
    if (!canStart) return;
    setError(null);
    setLoading(true);
    try {
      const session = await apiStartSession(task.trim(), energy);
      onStart(task.trim(), energy, session);
    } catch (err) {
      console.error("[TaskInput] apiStartSession failed:", err);
      setError("Backend unreachable — is the server running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Chassis size="sm" label="MOD_01 // Task Matrix" version="v1.4" className="w-full">
      <LcdScreen className="mb-4">
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleStart();
            }
          }}
          placeholder="What's the one thing?"
          rows={3}
          disabled={loading}
          className="w-full resize-none bg-transparent font-mono text-xl leading-snug tracking-tight text-lcd-text placeholder:text-lcd-text/40 focus:outline-none disabled:opacity-60"
        />
        <div className="cursor-blink mt-1 inline-block h-5 w-2.5 bg-lcd-text" />
      </LcdScreen>

      <div className="mb-4">
        <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Energy Level
        </div>
        <div className="flex gap-2 rounded-md border border-chassis-edge/40 bg-chassis-dark/50 p-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.08)]">
          {ENERGY_OPTIONS.map((opt) => {
            const active = energy === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                disabled={loading}
                onClick={() => setEnergy(opt.key)}
                className={cn(
                  "flex-1 rounded border-2 py-2 font-mono text-xs font-bold tracking-widest transition-all disabled:opacity-50",
                  active
                    ? "border-zinc-800 bg-screen-dark text-amber-400 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
                    : "border-chassis-edge/60 bg-chassis text-zinc-500 hover:bg-chassis-dark",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="mb-3 rounded border border-red-400/30 bg-red-900/10 px-3 py-2 font-mono text-[10px] text-red-400">
          ⚠ {error}
        </p>
      )}

      <MechButton
        variant="orange"
        disabled={!canStart}
        onClick={handleStart}
        className="flex w-full items-center justify-between"
      >
        <span>{loading ? "Initializing…" : "Initialize Sequence"}</span>
        <span className="rounded-sm bg-btn-orange-edge px-2 py-0.5 font-mono text-[10px] text-orange-200">
          {loading ? "···" : "PWR"}
        </span>
      </MechButton>
    </Chassis>
  );
}
