import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  status?: string;
  type?: string;
};

const map: Record<string, string> = {
  completed: "bg-[var(--success-bg)] text-[var(--success)]",
  ready: "bg-[var(--success-bg)] text-[var(--success)]",
  running: "bg-[var(--success-bg)] text-[var(--success)]",
  active: "bg-[var(--success-bg)] text-[var(--success)]",
  pending: "bg-[var(--warning-bg)] text-[var(--warning)]",
  processing: "bg-[var(--warning-bg)] text-[var(--warning)]",
  paused: "bg-[var(--warning-bg)] text-[var(--warning)]",
  failed: "bg-[var(--danger-bg)] text-[var(--danger)]",
  error: "bg-[var(--danger-bg)] text-[var(--danger)]",
  "no-answer": "bg-[var(--danger-bg)] text-[var(--danger)]",
  inbound: "bg-[var(--success-bg)] text-[var(--success)]",
  outbound: "bg-[var(--warning-bg)] text-[var(--warning)]",
  marketing: "bg-[var(--marketing-bg)] text-[var(--marketing)]",
  sales: "bg-[var(--sales-bg)] text-[var(--sales)]",
  support: "bg-[var(--support-bg)] text-[var(--support)]",
  tech: "bg-[var(--tech-bg)] text-[var(--tech)]",
};

export function StatusBadge({ status, type }: StatusBadgeProps) {
  const key = (status || type || "pending").toLowerCase();
  const label = (status || type || "pending").replace(/-/g, " ");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize",
        map[key] ?? "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
      )}
    >
      {label}
    </span>
  );
}
