"use client";

import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { useState } from "react";
import { api } from "@/lib/api";
import type { Agent, Campaign } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

function progressPct(campaign: Campaign): number {
  if (!campaign.totalContacts) return 0;
  return Math.round((campaign.called / campaign.totalContacts) * 100);
}

export default function CampaignsPage() {
  const { data: campaigns = [], mutate, isLoading, error } = useSWR("campaigns", () => api.campaigns.list());
  const { data: agents = [] } = useSWR("agents", () => api.agents.list());
  const [busyCampaignId, setBusyCampaignId] = useState<string | null>(null);
  const allowedAgents = agents.filter((a: Agent) => a.agentType === "marketing" || a.agentType === "sales");

  const onToggleCampaign = async (campaign: Campaign) => {
    setBusyCampaignId(campaign.id);
    try {
      if (campaign.status === "running") {
        await api.campaigns.pause(campaign.id);
        toast.success("Campaign paused");
      } else {
        await api.campaigns.start(campaign.id);
        toast.success("Campaign started");
      }
      await mutate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed";
      toast.error(message);
    } finally {
      setBusyCampaignId(null);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-600">Loading campaigns...</div>;
  }

  if (error) {
    return <div className="p-6 text-sm text-red-600">Failed to load campaigns. Please refresh.</div>;
  }

  if (allowedAgents.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Campaigns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">
              Campaigns are available when you have at least one Marketing or Sales agent.
            </p>
            <Button asChild>
              <Link href="/dashboard/agents/new">Create Marketing or Sales Agent</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-slate-600">Run and track your outbound calling campaigns.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/campaigns/new">New Campaign</Link>
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Create your first campaign</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">
              Upload a CSV and launch outbound calls with your Marketing or Sales agent.
            </p>
            <Button asChild>
              <Link href="/dashboard/campaigns/new">Create your first campaign</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/dashboard/campaigns/${campaign.id}`} className="min-w-0">
                    <CardTitle className="truncate">{campaign.name}</CardTitle>
                  </Link>
                  <div className="flex items-center gap-2">
                    {campaign.agentName && <Badge variant="outline">{campaign.agentName}</Badge>}
                    <Badge className="capitalize">{campaign.status}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>
                      {campaign.called}/{campaign.totalContacts} called
                    </span>
                    <span>{progressPct(campaign)}%</span>
                  </div>
                  <Progress value={progressPct(campaign)} />
                </div>

                <p className="text-sm text-slate-600">
                  ✅ {campaign.answered} answered · 🎯 {campaign.converted} converted · 📞 {campaign.noAnswer} no
                  answer
                </p>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => onToggleCampaign(campaign)}
                    disabled={busyCampaignId === campaign.id}
                  >
                    {campaign.status === "running" ? "Pause" : "Resume / Start"}
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/dashboard/campaigns/${campaign.id}`}>Open</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
