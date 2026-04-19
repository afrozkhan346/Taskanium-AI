import { cn } from "@/lib/utils";

interface DymoToastProps {
  tag?: string;
  message: string;
  className?: string;
}

export function DymoToast({ tag = "SYS", message, className }: DymoToastProps) {
  return (
    <div
      className={cn(
        "toast-in relative -rotate-3 border-[1.5px] border-label-yellow-edge bg-label-yellow px-3 py-1.5 shadow-[2px_4px_8px_rgba(0,0,0,0.15)]",
        className,
      )}
    >
      <div className="label-stripes pointer-events-none absolute inset-0" />
      <p className="relative flex items-center gap-3 font-mono text-[10px] font-bold uppercase tracking-tight text-label-yellow-text">
        <span className="bg-label-yellow-text px-1 text-label-yellow">{tag}</span>
        {message}
      </p>
    </div>
  );
}
