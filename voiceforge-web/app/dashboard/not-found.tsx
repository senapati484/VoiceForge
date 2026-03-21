import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold">Not found</h2>
      <p className="mt-1 text-sm text-slate-600">
        The dashboard resource you requested does not exist.
      </p>
      <Button asChild className="mt-4">
        <Link href="/dashboard">Back to overview</Link>
      </Button>
    </div>
  );
}
