import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { TaskInput } from "@/components/taskanium/TaskInput";
import { ActiveSession } from "@/components/taskanium/ActiveSession";
import { SessionEnd } from "@/components/taskanium/SessionEnd";
import type { Energy } from "@/components/taskanium/EnergyBadge";
import type { SessionData } from "@/api";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Taskanium — One thing at a time" },
      {
        name: "description",
        content:
          "An ADHD-friendly focus widget for an interest-based nervous system. Phase-based guidance, dynamic body-doubling reminders, zero overwhelm.",
      },
      { property: "og:title", content: "Taskanium — One thing at a time" },
      {
        property: "og:description",
        content:
          "Phase-based ADHD focus widget. One micro-step, fresh reminders, no task lists.",
      },
    ],
  }),
});

// Stats passed back from ActiveSession when session ends
export interface SessionEndStats {
  sessionId: string;
  elapsedMinutes: number;
  remindersSent: number;
  remindersAcked: number;
  hyperfocusDetected: boolean;
  currentPhase: 0 | 1 | 2;
}

type AppState =
  | { kind: "input" }
  | { kind: "active"; task: string; energy: Energy; session: SessionData }
  | {
      kind: "end";
      task: string;
      outcome: "done" | "abandon";
      stats: SessionEndStats;
    };

function Index() {
  const [state, setState] = useState<AppState>({ kind: "input" });
  const [isBubble, setIsBubble] = useState(false);

  const handleShrinkToBubble = () => {
    setIsBubble(true);
    // Shrink to 64×64 bubble
    (window as Window & { taskanium?: { minimizeToBubble: () => void } }).taskanium?.minimizeToBubble();
  };

  const handleMaximize = () => {
    setIsBubble(false);
    // Expand back to 320x420 panel
    (window as Window & { taskanium?: { expandToPanel: () => void } }).taskanium?.expandToPanel();
  };

  if (isBubble) {
    return (
      <button
        onClick={handleMaximize}
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        className="group relative flex h-dvh w-dvw cursor-pointer items-center justify-center overflow-hidden border-[3px] border-chassis-edge bg-chassis shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),0_4px_12px_rgba(0,0,0,0.4)] transition-all hover:scale-[1.02] active:scale-95"
        title="Click to Maximize"
      >
        {/* LED pulse indicator */}
        <div className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full border border-black/20 bg-led-amber shadow-[0_0_8px_var(--led-amber)] led-pulse" />
        
        {/* Maximize Icon */}
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground transition-colors group-hover:text-primary">
          <path d="M15 3h6v6"></path>
          <path d="M9 21H3v-6"></path>
          <path d="M21 3l-7 7"></path>
          <path d="M3 21l7-7"></path>
        </svg>
      </button>
    );
  }

  return (
    <main className="flex h-screen w-screen flex-col items-center overflow-hidden px-3 pt-10 pb-3">
      {/* Draggable title-bar area with structured window controls */}
      <div
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        className="fixed top-0 left-0 right-0 z-50 flex h-10 items-center justify-between px-3"
      >
        <div className="font-mono text-[10px] font-bold tracking-[0.2em] text-muted-foreground/80">
          TASKANIUM
        </div>
        <div style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties} className="flex gap-1.5 items-center bg-chassis-dark/50 backdrop-blur-sm p-1 rounded-full border border-chassis-edge/30">
          {/* Shrink to Bubble (Single Minimize Button) */}
          <button
            onClick={handleShrinkToBubble}
            title="Minimize"
            className="flex size-5 items-center justify-center rounded-full bg-chassis transition-colors hover:bg-black/10 active:bg-black/20"
          >
            <span className="block h-0.5 w-2.5 bg-foreground/70" />
          </button>
        </div>
      </div>


      <section className="flex flex-1 w-full max-w-[290px] flex-col items-center justify-start overflow-hidden">
        {state.kind === "input" && (
          <TaskInput
            onStart={(task, energy, session) =>
              setState({ kind: "active", task, energy, session })
            }
          />
        )}

        {state.kind === "active" && (
          <ActiveSession
            task={state.task}
            energy={state.energy}
            session={state.session}
            onDone={(stats) =>
              setState({ kind: "end", task: state.task, outcome: "done", stats })
            }
            onAbandon={(stats) =>
              setState({ kind: "end", task: state.task, outcome: "abandon", stats })
            }
          />
        )}

        {state.kind === "end" && (
          <SessionEnd
            task={state.task}
            outcome={state.outcome}
            stats={state.stats}
            onReset={() => setState({ kind: "input" })}
          />
        )}
      </section>
    </main>
  );
}
