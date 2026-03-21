import { Card, CardContent } from "@/components/ui/card";

type EmptyStateProps = {
  icon: string;
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-sm)]">
      <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <div className="text-4xl">{icon}</div>
        <h3>{title}</h3>
        <p className="max-w-md text-sm">{description}</p>
        {action}
      </CardContent>
    </Card>
  );
}
