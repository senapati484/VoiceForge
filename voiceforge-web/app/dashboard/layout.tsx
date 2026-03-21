import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { PageHeader } from "@/components/PageHeader";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen bg-[var(--bg-base)]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <PageHeader title="Dashboard" subtitle="Manage your AI voice business from one place." />
        <div className="page-shell p-6">{children}</div>
      </main>
    </div>
  );
}
