import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface MechButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "orange" | "red" | "green";
  children: ReactNode;
}

export function MechButton({
  variant = "orange",
  className,
  children,
  ...props
}: MechButtonProps) {
  const variants = {
    orange:
      "bg-btn-orange border-btn-orange-edge text-orange-50 shadow-button-orange active:translate-y-2 active:shadow-[0_0_0_0_var(--btn-orange-edge)]",
    red: "bg-btn-red border-btn-red-edge text-red-50 shadow-button-red active:translate-y-1.5 active:shadow-[0_0_0_0_var(--btn-red-edge)]",
    green:
      "bg-btn-green border-btn-green-edge text-emerald-50 shadow-button-green active:translate-y-1.5 active:shadow-[0_0_0_0_var(--btn-green-edge)]",
  };

  return (
    <button
      {...props}
      className={cn(
        "rounded-md border-2 px-4 pb-2 pt-3 text-sm font-bold uppercase tracking-wider drop-shadow-sm transition-all",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}
