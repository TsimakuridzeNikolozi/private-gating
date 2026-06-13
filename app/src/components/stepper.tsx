import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

function circleClass(done: boolean, active: boolean, blocked: boolean) {
  if (done) return "border-primary bg-primary text-primary-foreground";
  if (!active) return "border-border bg-card text-muted-foreground";
  if (blocked) return "border-amber-500 bg-background text-amber-400";
  return "border-primary bg-background text-primary";
}

function labelClass(done: boolean, active: boolean, blocked: boolean) {
  if (active) return blocked ? "text-amber-400" : "text-foreground";
  if (done) return "text-muted-foreground";
  return "text-muted-foreground/60";
}

export function Stepper({
  steps,
  current,
  blocked = false,
}: {
  steps: string[];
  current: number;
  blocked?: boolean;
}) {
  const safeCurrent = Math.min(Math.max(current, 0), steps.length);
  const activeLabel = steps[Math.min(safeCurrent, steps.length - 1)];

  return (
    <div>
      <div className="flex items-center justify-between sm:hidden">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Step {Math.min(safeCurrent + 1, steps.length)} of {steps.length}
        </span>
        <span
          className={cn(
            "text-sm font-medium",
            blocked ? "text-amber-400" : "text-foreground",
          )}
        >
          {safeCurrent >= steps.length ? "Done" : activeLabel}
        </span>
      </div>

      <ol className="mt-3 hidden items-center sm:flex">
        {steps.map((label, i) => {
          const done = i < safeCurrent;
          const active = i === safeCurrent;
          return (
            <li key={label} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                    circleClass(done, active, blocked),
                  )}
                >
                  {done ? <Check className="size-4" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "text-[11px] font-medium whitespace-nowrap",
                    labelClass(done, active, blocked),
                  )}
                >
                  {label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <span
                  className={cn(
                    "mx-2 h-px flex-1 -translate-y-2.5",
                    done ? "bg-primary/70" : "bg-border",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
