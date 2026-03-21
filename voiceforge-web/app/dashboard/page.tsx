import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot, Megaphone, Phone, Zap } from "lucide-react";
import { auth } from "@/lib/auth";
import type { Agent, CallLog, Campaign } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";

const API_ROOT = process.env.API_URL || "http://localhost:4000";

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Request failed");
  return res.json() as Promise<T>;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.backendToken) {
    redirect("/login");
  }

  const [agentsSettled, callsSettled, campaignsSettled, creditsSettled] = await Promise.allSettled([
    fetchJson<{ agents: Agent[] }>(`${API_ROOT}/api/agents`, session.backendToken),
    fetchJson<{ calls: CallLog[] }>(`${API_ROOT}/api/calls?page=1`, session.backendToken),
    fetchJson<{ campaigns: Campaign[] }>(`${API_ROOT}/api/campaigns`, session.backendToken),
    fetchJson<{ credits: number }>(`${API_ROOT}/api/credits`, session.backendToken),
  ]);

  const agents = agentsSettled.status === "fulfilled" ? agentsSettled.value.agents : [];
  const calls = callsSettled.status === "fulfilled" ? callsSettled.value.calls : [];
  const campaigns = campaignsSettled.status === "fulfilled" ? campaignsSettled.value.campaigns : [];
  const credits = creditsSettled.status === "fulfilled" ? creditsSettled.value.credits : 0;

  const totalMinutes = calls.reduce((sum, call) => sum + (call.durationSec ?? 0), 0) / 60;
  const contactsCalled = campaigns.reduce((sum, c) => sum + c.called, 0);
  const runningCampaigns = campaigns.filter((c) => c.status === "running");
  const recentCalls = calls.slice(0, 5);

  return (
    <div className="space-y-7">
      <div>
        <h2>Good morning, {session.user?.name?.split(" ")[0] ?? "there"} 👋</h2>
        <p className="text-sm text-[var(--text-secondary)]">{new Date().toLocaleDateString()}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Bot className="size-4" />} label="Active Agents" value={agents.length} color="brand" />
        <StatCard icon={<Phone className="size-4" />} label="Total Calls" value={calls.length} color="success" />
        <StatCard icon={<Megaphone className="size-4" />} label="Campaign Contacts Called" value={contactsCalled} color="marketing" />
        <StatCard icon={<Zap className="size-4" />} label="Credits Remaining" value={credits} color="warning" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Campaigns</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {runningCampaigns.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">No running campaigns.</p>
          ) : (
            runningCampaigns.map((campaign) => {
              const pct = campaign.totalContacts ? Math.round((campaign.called / campaign.totalContacts) * 100) : 0;
              return (
                <div key={campaign.id} className="space-y-2">
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{campaign.name}</span>
                    <span>{pct}%</span>
                  </div>
                  <Progress value={pct} />
                  <StatusBadge status={campaign.status} />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Calls</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentCalls.map((call) => (
                <TableRow key={call.id}>
                  <TableCell>{call.agentName ?? "-"}</TableCell>
                  <TableCell className="capitalize"><StatusBadge type={call.direction} /></TableCell>
                  <TableCell className="capitalize"><StatusBadge status={call.status} /></TableCell>
                  <TableCell>{call.durationSec ?? 0}s</TableCell>
                  <TableCell>{new Date(call.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/dashboard/agents/new">New Agent</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/campaigns/new">New Campaign</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/knowledge">Upload Docs</Link>
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-[var(--text-secondary)]">Total minutes tracked: {totalMinutes.toFixed(1)}</p>
    </div>
  );
}
