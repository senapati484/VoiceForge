import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { Agent, CallLog } from "@/lib/types";
import { AgentActions } from "@/components/AgentActions";
import { CallInitiator } from "@/components/CallInitiator";
import { InboundPhoneCard } from "@/components/InboundPhoneCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const API_ROOT = process.env.API_URL || "http://localhost:4000";

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed request");
  return res.json() as Promise<T>;
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.backendToken) {
    redirect("/login");
  }

  const { id } = await params;
  const [agentResult, callsResult] = await Promise.allSettled([
    fetchJson<{ agent: Agent }>(`${API_ROOT}/api/agents/${id}`, session.backendToken),
    fetchJson<{ calls: CallLog[] }>(`${API_ROOT}/api/calls?page=1`, session.backendToken),
  ]);

  if (agentResult.status !== "fulfilled" || callsResult.status !== "fulfilled") {
    notFound();
  }

  const agent = agentResult.value.agent;
  const lastCalls = callsResult.value.calls.filter((call) => call.agentId === id).slice(0, 5);
  const inbound = agent.agentType === "support" || agent.agentType === "tech";

  return (
      <div className="grid gap-6 p-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{agent.name}</CardTitle>
                <Badge className="capitalize">{agent.agentType}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <strong>Business:</strong> {agent.businessName}
              </p>
              <p>
                <strong>Tone:</strong> {agent.tone}
              </p>
              <p>
                <strong>Language:</strong> {agent.language}
              </p>
              <p>
                <strong>Call objective:</strong> {agent.callObjective}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Knowledge Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {agent.knowledgeFile ? (
                <>
                  <p className="text-green-700">✅ Knowledge context ready</p>
                  <p className="line-clamp-3 text-slate-700">{agent.knowledgeFile.businessSummary}</p>
                  <p className="text-slate-600">
                    Generated from {agent.knowledgeDocs.length} documents
                  </p>
                </>
              ) : (
                <p className="text-amber-700">
                  ⚠ No knowledge context - create agent after uploading documents
                </p>
              )}

              <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <p>Knowledge docs: {agent.knowledgeDocs.length}</p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/knowledge">Open Knowledge</Link>
                </Button>
              </div>

              <AgentActions agentId={agent.id} isActive={agent.isActive} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Calls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {lastCalls.length === 0 ? (
                <p className="text-slate-500">No recent calls for this agent.</p>
              ) : (
                lastCalls.map((call) => (
                  <div key={call.id} className="flex items-center justify-between rounded-md border border-slate-200 p-2">
                    <span className="capitalize">
                      {call.direction} · {call.status}
                    </span>
                    <span className="text-slate-500">
                      {new Date(call.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {inbound ? (
            <Card>
              <CardHeader>
                <CardTitle>Phone Number</CardTitle>
              </CardHeader>
              <CardContent>
                <InboundPhoneCard phoneNumber={agent.phoneNumber} vapiAgentId={agent.vapiAgentId} />
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Start a Call</CardTitle>
                </CardHeader>
                <CardContent>
                  <CallInitiator agentId={agent.id} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Run Campaign</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button asChild>
                    <Link href="/dashboard/campaigns">Open Campaigns</Link>
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
  );
}
