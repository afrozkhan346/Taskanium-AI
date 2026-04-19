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

  return (
    <main className="min-h-dvh px-6 py-12">
      <header className="mx-auto mb-12 max-w-3xl text-center">
        <div className="mb-3 inline-block rounded-sm border border-chassis-edge/50 bg-chassis px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
          AI HACKFEST · PROTOTYPE
        </div>
        <h1 className="font-mono text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          TASKANIUM
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          One thing. One step. One nervous system that finally cooperates.
        </p>
      </header>

      <section className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-12 lg:flex-row lg:items-start lg:gap-16">
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

      <footer className="mt-20 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
        Taskanium · AI Hackfest 2026 · Powered by Gemini + ElevenLabs + Snowflake
      </footer>
    </main>
  );
}
