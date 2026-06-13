import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export type NoticeVariant = "info" | "success" | "warning" | "error";

const TONES: Record<NoticeVariant, { icon: LucideIcon; box: string }> = {
  info: {
    icon: Info,
    box: "border-sky-500/30 bg-sky-500/5 text-foreground [&>svg]:text-sky-400",
  },
  success: {
    icon: CheckCircle2,
    box: "border-primary/30 bg-primary/5 text-foreground [&>svg]:text-primary",
  },
  warning: {
    icon: AlertTriangle,
    box: "border-amber-500/30 bg-amber-500/5 text-foreground [&>svg]:text-amber-400",
  },
  error: {
    icon: XCircle,
    box: "border-destructive/40 bg-destructive/5 text-foreground [&>svg]:text-destructive",
  },
};

export function Notice({
  variant = "info",
  title,
  children,
  action,
  className,
}: {
  variant?: NoticeVariant;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { icon: Icon, box } = TONES[variant];
  return (
    <Alert className={cn(box, className)}>
      <Icon />
      {title && <AlertTitle>{title}</AlertTitle>}
      {(children || action) && (
        <AlertDescription className="text-foreground/80">
          {children && (
            <div className="leading-relaxed wrap-anywhere">{children}</div>
          )}
          {action && <div className="pt-2">{action}</div>}
        </AlertDescription>
      )}
    </Alert>
  );
}
