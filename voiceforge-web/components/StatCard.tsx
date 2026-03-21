import { Card, CardContent } from "@/components/ui/card";

type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: "brand" | "success" | "marketing" | "warning";
};

const iconTone: Record<NonNullable<StatCardProps["color"]>, string> = {
  brand: "bg-[var(--brand-light)] text-[var(--brand)]",
  success: "bg-[var(--success-bg)] text-[var(--success)]",
  marketing: "bg-[var(--marketing-bg)] text-[var(--marketing)]",
  warning: "bg-[var(--warning-bg)] text-[var(--warning)]",
};

export function StatCard({ icon, label, value, color = "brand" }: StatCardProps) {
  return (
    <Card className="border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-sm)]">
      <CardContent className="p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-3xl font-bold text-[var(--text-primary)]">{value}</p>
            <p className="text-sm text-[var(--text-secondary)]">{label}</p>
          </div>
          <div className={`rounded-full p-2.5 ${iconTone[color]}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
