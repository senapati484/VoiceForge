"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Campaign, CsvContact } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function pct(campaign?: Campaign): number {
  if (!campaign || !campaign.totalContacts) return 0;
  return Math.round((campaign.called / campaign.totalContacts) * 100);
}

function statusBadgeClass(status: CsvContact["status"]): string {
  if (status === "pending") return "bg-slate-100 text-slate-700";
  if (status === "calling") return "bg-amber-100 text-amber-700 animate-pulse";
  if (status === "answered" || status === "converted") return "bg-green-100 text-green-700";
  return "bg-red-100 text-red-700";
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params.id;
  const [page, setPage] = useState(1);

  const {
    data: campaign,
    mutate: mutateCampaign,
  } = useSWR(
    campaignId ? `campaign-${campaignId}` : null,
    () => api.campaigns.get(campaignId),
    {
      refreshInterval: (data) => (data?.status === "running" ? 10000 : 0),
    }
  );

  const {
    data: contactsData,
    mutate: mutateContacts,
  } = useSWR(
    campaignId ? `campaign-${campaignId}-contacts-${page}` : null,
    () => api.campaigns.getContacts(campaignId, page),
    {
      refreshInterval: campaign?.status === "running" ? 10000 : 0,
    }
  );

  const contacts = contactsData?.contacts ?? [];
  const totalContacts = contactsData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalContacts / 10));

  const stats = useMemo(
    () => [
      { label: "Total", value: campaign?.totalContacts ?? 0 },
      { label: "Answered", value: campaign?.answered ?? 0 },
      { label: "Converted", value: campaign?.converted ?? 0 },
      { label: "No Answer", value: campaign?.noAnswer ?? 0 },
    ],
    [campaign]
  );

  const toggleCampaign = async () => {
    if (!campaign) return;
    try {
      if (campaign.status === "running") {
        await api.campaigns.pause(campaign.id);
        toast.success("Campaign paused");
      } else {
        await api.campaigns.start(campaign.id);
        toast.success("Campaign started");
      }
      await Promise.all([mutateCampaign(), mutateContacts()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed";
      toast.error(message);
    }
  };

  const exportResults = async () => {
    if (!campaign) return;
    try {
      const rows: CsvContact[] = [];
      let currentPage = 1;
      while (true) {
        const data = await api.campaigns.getContacts(campaign.id, currentPage);
        rows.push(...data.contacts);
        if (rows.length >= data.total || data.contacts.length === 0) break;
        currentPage += 1;
      }

      const csvRows = [
        "name,phone,notes,status,calledAt",
        ...rows.map((row) =>
          [row.name, row.phone, row.notes ?? "", row.status, row.calledAt ?? ""]
            .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
            .join(",")
        ),
      ];

      const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${campaign.name.replace(/\s+/g, "-").toLowerCase()}-results.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to export";
      toast.error(message);
    }
  };

  if (!campaign) {
    return <div className="p-6 text-sm text-slate-600">Loading campaign...</div>;
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
          <div className="mt-1">
            <Badge className="capitalize">{campaign.status}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={toggleCampaign}>{campaign.status === "running" ? "Pause" : "Start"}</Button>
          <Button variant="outline" onClick={exportResults}>
            Export results
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm text-slate-600">
            <span>
              {campaign.called}/{campaign.totalContacts} called
            </span>
            <span>{pct(campaign)}%</span>
          </div>
          <Progress value={pct(campaign)} className="h-2" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label} size="sm" className="ring-1 ring-slate-200">
                <CardContent className="py-2">
                  <p className="text-xs text-slate-500">{stat.label}</p>
                  <p className="text-lg font-semibold">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Call Log</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>{contact.name || "-"}</TableCell>
                  <TableCell>{contact.phone}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(contact.status)}`}>
                      {contact.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    {contact.calledAt ? (
                      <Link
                        href={`/dashboard/calls?campaignId=${campaign.id}&phone=${encodeURIComponent(contact.phone)}`}
                        className="text-indigo-600 hover:underline"
                      >
                        View call
                      </Link>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
