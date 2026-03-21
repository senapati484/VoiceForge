"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Agent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type CsvPreviewRow = { name: string; phone: string; notes: string };

function parseCsvPreview(content: string): CsvPreviewRow[] {
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIdx = headers.indexOf("name");
  const phoneIdx = headers.indexOf("phone");
  const notesIdx = headers.indexOf("notes");

  return lines.slice(1, 6).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    return {
      name: nameIdx >= 0 ? cols[nameIdx] ?? "" : "",
      phone: phoneIdx >= 0 ? cols[phoneIdx] ?? "" : "",
      notes: notesIdx >= 0 ? cols[notesIdx] ?? "" : "",
    };
  });
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [agentId, setAgentId] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<CsvPreviewRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: agents = [] } = useSWR("agents", () => api.agents.list());

  const campaignAgents = useMemo(
    () => agents.filter((a: Agent) => a.agentType === "marketing" || a.agentType === "sales"),
    [agents]
  );

  const dropzone = useDropzone({
    accept: { "text/csv": [".csv"] },
    multiple: false,
    onDrop: async (files) => {
      const file = files[0];
      if (!file) return;
      setCsvFile(file);
      const text = await file.text();
      setPreviewRows(parseCsvPreview(text));
    },
  });

  const downloadSample = () => {
    const sample = "name,phone,notes\nJohn Doe,+15551234567,Interested in pro plan\nJane Smith,+15557654321,Call after 3pm\n";
    const blob = new Blob([sample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sample-campaign.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const onSubmit = async () => {
    if (!campaignName || !agentId || !csvFile) {
      toast.error("Campaign name, agent, and CSV are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("campaignName", campaignName);
      formData.append("agentId", agentId);
      formData.append("csv", csvFile);

      const res = await api.campaigns.create(formData);
      toast.success(`Campaign created with ${res.contactCount} contacts`);
      router.push("/dashboard/campaigns");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create campaign";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (campaignAgents.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Create Campaign</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">Create a Marketing or Sales agent first.</p>
            <Button asChild>
              <Link href="/dashboard/agents/new">Create Agent</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">New Campaign</h1>
        <p className="text-sm text-slate-600">Step {step} of 2</p>
      </div>

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Step 1 - Select Agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Label>Marketing/Sales Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {campaignAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name} ({agent.agentType})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={() => setStep(2)} disabled={!agentId}>
              Continue
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Step 2 - Upload CSV</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="campaignName">Campaign Name</Label>
              <Input
                id="campaignName"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Spring Launch Outreach"
              />
            </div>

            <div
              {...dropzone.getRootProps()}
              className="cursor-pointer rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center"
            >
              <input {...dropzone.getInputProps()} />
              <p className="font-medium">Upload your contact list</p>
              <p className="mt-1 text-sm text-slate-600">Required column: phone | Optional: name, notes</p>
            </div>

            <Button variant="outline" onClick={downloadSample}>
              Download sample CSV
            </Button>

            {csvFile && (
              <p className="text-sm text-slate-600">
                Selected file: <strong>{csvFile.name}</strong>
              </p>
            )}

            {previewRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Preview (first 5 rows)</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-indigo-600">Name</TableHead>
                      <TableHead className="text-indigo-600">Phone</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, idx) => (
                      <TableRow key={`${row.phone}-${idx}`}>
                        <TableCell>{row.name || "-"}</TableCell>
                        <TableCell>{row.phone || "-"}</TableCell>
                        <TableCell>{row.notes || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={onSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Campaign"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
