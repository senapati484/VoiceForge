import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { CallLog } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const API_ROOT = process.env.API_URL || "http://localhost:4000";

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Request failed");
  return res.json() as Promise<T>;
}

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.backendToken) redirect("/login");

  const { id } = await params;
  const result = await fetchJson<{ call: CallLog }>(`${API_ROOT}/api/calls/${id}`, session.backendToken).catch(
    () => null
  );
  if (!result) notFound();

  const call = result.call;

  return (
    <div className="space-y-4 p-6">
      {call.campaignId && (
        <p className="text-sm text-slate-600">
          Campaign call:{" "}
          <Link href={`/dashboard/campaigns/${call.campaignId}`} className="text-indigo-600 hover:underline">
            Open campaign
          </Link>
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{call.agentName ?? "Agent Call"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          <Badge className="capitalize">{call.direction}</Badge>
          <span>Number: {call.toNumber ?? "-"}</span>
          <span>Duration: {call.durationSec ?? 0}s</span>
          <span>Credits: {call.creditsUsed ?? 0}</span>
          <Badge variant="outline" className="capitalize">
            {call.status}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transcript</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {call.transcript?.length ? (
            call.transcript.map((entry, idx) => (
              <div key={`${entry.timestamp}-${idx}`} className={`flex ${entry.role === "agent" ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                    entry.role === "agent" ? "bg-purple-100 text-purple-900" : "bg-slate-200 text-slate-800"
                  }`}
                >
                  {entry.text}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No transcript available.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
