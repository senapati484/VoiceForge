"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import useSWR from "swr";
import { Bot, Megaphone, PhoneCall, Headphones } from "lucide-react";
import { api } from "@/lib/api";
import type { Agent } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";

const typeMeta: Record<Agent["agentType"], { title: string; icon: ComponentType<{ className?: string }> }> = {
  marketing: { title: "Marketing Agents", icon: Megaphone },
  support: { title: "Customer Support Agents", icon: Headphones },
  sales: { title: "Sales Agents", icon: PhoneCall },
  tech: { title: "Tech Support Agents", icon: Bot },
};

export default function AgentsPage() {
  const { data: agents = [], isLoading, error } = useSWR("agents", () => api.agents.list());
  const grouped = agents.reduce<Record<Agent["agentType"], Agent[]>>(
    (acc, agent) => {
      acc[agent.agentType].push(agent);
      return acc;
    },
    { marketing: [], support: [], sales: [], tech: [] }
  );
  const typesPresent = (Object.keys(grouped) as Agent["agentType"][]).filter((key) => grouped[key].length > 0);

  if (isLoading) {
    return <div className="text-sm text-[var(--text-secondary)]">Loading agents...</div>;
  }

  if (error) {
    return <div className="text-sm text-[var(--danger)]">Failed to load agents. Please refresh.</div>;
  }

  if (agents.length === 0) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2>My Agents</h2>
            <p className="text-sm text-[var(--text-secondary)]">Create your first AI calling agent.</p>
          </div>
          <Button asChild>
            <Link href="/dashboard/agents/new">New Agent</Link>
          </Button>
        </div>

        <EmptyState
          icon="🤖"
          title="No agents yet"
          description="Create your first AI calling agent. It takes about 2 minutes."
          action={
            <Button asChild>
              <Link href="/dashboard/agents/new">Create your first agent</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const defaultType = typesPresent[0] ?? "marketing";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2>My Agents</h2>
          <p className="text-sm text-[var(--text-secondary)]">Manage and deploy your AI calling agents.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/agents/new">New Agent</Link>
        </Button>
      </div>

      <Tabs defaultValue={defaultType}>
        <TabsList>
          {typesPresent.map((type) => (
            <TabsTrigger key={type} value={type}>
              {typeMeta[type].title}
            </TabsTrigger>
          ))}
        </TabsList>

        {(Object.keys(grouped) as Agent["agentType"][]).map((type) => (
          <TabsContent key={type} value={type} className="mt-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {grouped[type].map((agent) => {
                const Icon = typeMeta[type].icon;
                const normalizedId = agent.id || (agent as { _id?: string })._id || "";
                const cardKey = normalizedId || `${type}-${agent.name}-${agent.businessName}`;
                const detailHref = normalizedId ? `/dashboard/agents/${normalizedId}` : "/dashboard/agents";
                return (
                  <Card key={cardKey} className="transition hover:ring-2 hover:ring-indigo-200">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          <Link href={detailHref} className="hover:underline">
                            {agent.name}
                          </Link>
                        </CardTitle>
                        <StatusBadge status={agent.isActive ? "active" : "paused"} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p className="flex items-center gap-2 text-[var(--text-secondary)]">
                        <Icon className="size-4" />
                        {typeMeta[type].title.replace("Agents", "")}
                      </p>
                      <Badge className="w-fit bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]">{agent.agentType}</Badge>
                      <p className="text-[var(--text-secondary)]">{agent.businessName}</p>
                      <p className="line-clamp-2 text-[var(--text-muted)]">{agent.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
