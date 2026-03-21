"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import type { Agent, CallLog } from "@/lib/types";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const typeBadgeClass: Record<Agent["agentType"], string> = {
  marketing: "bg-teal-100 text-teal-700",
  support: "bg-blue-100 text-blue-700",
  sales: "bg-green-100 text-green-700",
  tech: "bg-amber-100 text-amber-700",
};

export default function CallsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const { data, error, isLoading } = useSWR(`calls-${page}`, () => api.calls.list(page));
  const { data: agents = [] } = useSWR("agents", () => api.agents.list());
  const agentTypeById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent.agentType])),
    [agents]
  );

  const filteredCalls = useMemo(() => {
    const calls = (data?.calls ?? []) as CallLog[];
    if (filter === "inbound") return calls.filter((c) => c.direction === "inbound");
    if (filter === "outbound") return calls.filter((c) => c.direction === "outbound");
    if (filter === "campaign") return calls.filter((c) => Boolean(c.campaignId));
    return calls;
  }, [data?.calls, filter]);

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-600">Loading calls...</div>;
  }

  if (error) {
    return <div className="p-6 text-sm text-red-600">Failed to load calls. Please refresh.</div>;
  }

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Calls</h1>
        <p className="text-sm text-slate-600">Track all inbound and outbound call activity.</p>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="inbound">Inbound</TabsTrigger>
          <TabsTrigger value="outbound">Outbound</TabsTrigger>
          <TabsTrigger value="campaign">Campaign Calls</TabsTrigger>
        </TabsList>
      </Tabs>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agent</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Direction</TableHead>
            <TableHead>To Number</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Credits</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredCalls.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-slate-500">
                No calls found for this filter.
              </TableCell>
            </TableRow>
          )}
          {filteredCalls.map((call) => (
            <TableRow
              key={call.id}
              className="cursor-pointer"
              tabIndex={0}
              role="button"
              onClick={() => router.push(`/dashboard/calls/${call.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/dashboard/calls/${call.id}`);
                }
              }}
            >
              <TableCell>{call.agentName ?? "-"}</TableCell>
              <TableCell>
                {agentTypeById.get(call.agentId) ? (
                  <Badge className={typeBadgeClass[agentTypeById.get(call.agentId) as Agent["agentType"]]}>
                    {agentTypeById.get(call.agentId)}
                  </Badge>
                ) : (
                  <Badge variant="outline">unknown</Badge>
                )}
              </TableCell>
              <TableCell className="capitalize">{call.direction}</TableCell>
              <TableCell>{call.toNumber ?? "-"}</TableCell>
              <TableCell>{call.durationSec ? `${call.durationSec}s` : "-"}</TableCell>
              <TableCell className="capitalize">{call.status}</TableCell>
              <TableCell>{call.creditsUsed ?? "-"}</TableCell>
              <TableCell>{new Date(call.createdAt).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
