"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CreateAgentInput } from "@/lib/types";
import { useAgentStore } from "@/store/useAgentStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type AgentType = "marketing" | "support" | "sales" | "tech";

const agentTypeOptions: {
  type: AgentType;
  emoji: string;
  title: string;
  badge: string;
  badgeClass: string;
  description: string;
  uploadHint: string;
  placeholder: string;
}[] = [
  {
    type: "marketing",
    emoji: "📢",
    title: "Marketing Agent",
    badge: "OUTBOUND",
    badgeClass: "bg-orange-100 text-orange-700",
    description: "Call contacts from a CSV list for campaigns, launches, outreach",
    uploadHint: "You'll upload: CSV contact list + optional product docs",
    placeholder: "Describe your campaign goals, offers, and target audience.",
  },
  {
    type: "support",
    emoji: "🎧",
    title: "Customer Support",
    badge: "INBOUND",
    badgeClass: "bg-green-100 text-green-700",
    description: "Receive incoming customer calls, answer from knowledge base",
    uploadHint: "You'll upload: FAQs, product manuals, policy documents",
    placeholder: "Describe your support workflows, escalation rules, and response style.",
  },
  {
    type: "sales",
    emoji: "📞",
    title: "Sales Agent",
    badge: "OUTBOUND",
    badgeClass: "bg-orange-100 text-orange-700",
    description: "Call leads from a CSV, qualify interest, book demos",
    uploadHint: "You'll upload: CSV lead list + product/pricing information",
    placeholder: "Describe your ICP, qualification criteria, and demo-booking flow.",
  },
  {
    type: "tech",
    emoji: "💻",
    title: "Tech Support",
    badge: "INBOUND + OUTBOUND",
    badgeClass: "bg-blue-100 text-blue-700",
    description: "Handle technical support calls, guide troubleshooting",
    uploadHint: "You'll upload: Technical manuals, SOPs, error guides",
    placeholder: "Describe the technical issues handled, triage path, and escalation process.",
  },
];

const languages = ["en-US", "en-GB", "es-ES", "fr-FR", "de-DE"];
const tones = ["professional", "friendly", "confident", "empathetic", "consultative"];

export default function NewAgentPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selectedType, setSelectedType] = useState<AgentType | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const draft = useAgentStore((state) => state.draft);
  const updateDraft = useAgentStore((state) => state.updateDraft);
  const clearDraft = useAgentStore((state) => state.clearDraft);
  const { data: voices = [] } = useSWR("voices", () => api.voices.list());

  const selectedTypeConfig = useMemo(
    () => agentTypeOptions.find((item) => item.type === selectedType),
    [selectedType]
  );
  const selectedVoice = useMemo(
    () => voices.find((v) => v.voiceId === draft.voiceId),
    [voices, draft.voiceId]
  );

  useEffect(() => {
    if (!voices.length || draft.voiceId) return;
    const preferred =
      voices.find((v) => v.name.toLowerCase().includes("demo")) ||
      voices.find((v) => v.voiceId.toLowerCase() === "elliot") ||
      voices[0];
    if (!preferred) return;
    updateDraft({
      voiceId: preferred.voiceId,
      voiceName: preferred.name
    });
  }, [voices, draft.voiceId, updateDraft]);

  const canDeploy =
    Boolean(draft.agentType) &&
    Boolean(draft.name) &&
    Boolean(draft.businessName) &&
    Boolean(draft.language) &&
    Boolean(draft.tone) &&
    Boolean(draft.description) &&
    Boolean(draft.callObjective) &&
    Boolean(draft.voiceId) &&
    Boolean(draft.voiceName);

  const onSelectAgentType = (agentType: AgentType) => {
    setSelectedType(agentType);
    updateDraft({ agentType });
    setStep(1);
  };

  const onDeploy = async () => {
    if (!canDeploy) {
      toast.error("Please complete all required fields before deploying.");
      return;
    }

    setIsDeploying(true);
    toast.info("Generating knowledge from your documents...");
    try {
      await api.agents.create(draft as CreateAgentInput);
      clearDraft();
      toast.success("Agent deployed successfully.");
      router.push("/dashboard/agents");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to deploy agent";
      toast.error(message);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Create New Agent</h1>
        <p className="text-sm text-slate-600">Step {step} of 4</p>
      </div>

      {step === 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {agentTypeOptions.map((item) => {
            const selected = selectedType === item.type;
            return (
              <Card
                key={item.type}
                className={cn(
                  "border-2 transition",
                  selected ? "border-purple-500" : "border-slate-200"
                )}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-lg">
                    <span>
                      {item.emoji} {item.title}
                    </span>
                    {selected && <CheckCircle2 className="size-5 text-purple-600" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <span className={cn("inline-flex rounded-full px-2 py-1 text-xs font-medium", item.badgeClass)}>
                    {item.badge}
                  </span>
                  <p className="text-slate-700">{item.description}</p>
                  <p className="text-slate-500">{item.uploadHint}</p>
                  <Button onClick={() => onSelectAgentType(item.type)}>Select</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {step > 0 && (
        <div className="space-y-4">
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 1 - Identity</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Agent Name</Label>
                  <Input
                    id="name"
                    value={draft.name ?? ""}
                    onChange={(e) => updateDraft({ name: e.target.value })}
                    placeholder="Acme Outreach Agent"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input
                    id="businessName"
                    value={draft.businessName ?? ""}
                    onChange={(e) => updateDraft({ businessName: e.target.value })}
                    placeholder="Acme Inc."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select
                    value={draft.language ?? "en-US"}
                    onValueChange={(value) => updateDraft({ language: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((language) => (
                        <SelectItem key={language} value={language}>
                          {language}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tone</Label>
                  <Select
                    value={draft.tone ?? "professional"}
                    onValueChange={(value) => updateDraft({ tone: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                    <SelectContent>
                      {tones.map((tone) => (
                        <SelectItem key={tone} value={tone}>
                          {tone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 2 - Agent Description</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Agent Description</Label>
                  <Textarea
                    id="description"
                    value={draft.description ?? ""}
                    onChange={(e) => updateDraft({ description: e.target.value })}
                    placeholder={selectedTypeConfig?.placeholder ?? "Describe this agent's behavior, role, and responsibilities."}
                  />
                  <p className="text-xs text-slate-500">
                    This description defines how the agent should behave during calls.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="callObjective">Call Objective</Label>
                  <Input
                    id="callObjective"
                    value={draft.callObjective ?? ""}
                    onChange={(e) => updateDraft({ callObjective: e.target.value })}
                    placeholder="Primary objective for this agent's calls"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 3 - Choose Voice</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={draft.voiceId}
                  onValueChange={(voiceId) => {
                    const selected = voices.find((voice) => voice.voiceId === voiceId);
                    updateDraft({
                      voiceId,
                      voiceName: selected?.name ?? "",
                    });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a Vapi voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {voices.map((voice) => (
                      <SelectItem key={voice.voiceId} value={voice.voiceId}>
                        {voice.name} ({voice.provider})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {draft.voiceId && (
                  <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p className="mb-2 font-medium">Voice preview</p>
                    {selectedVoice?.previewUrl ? (
                      <audio
                        controls
                        preload="none"
                        src={selectedVoice.previewUrl}
                        className="w-full"
                      />
                    ) : (
                      <p className="text-slate-500">
                        Preview is not available for this voice. You can still use it for deployment.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {step === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>Step 4 - Review & Deploy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  <strong>Type:</strong> {draft.agentType}
                </p>
                <p>
                  <strong>Name:</strong> {draft.name}
                </p>
                <p>
                  <strong>Business:</strong> {draft.businessName}
                </p>
                <p>
                  <strong>Voice:</strong> {draft.voiceName}
                </p>
                <Button onClick={onDeploy} disabled={!canDeploy || isDeploying}>
                  {isDeploying && <Loader2 className="mr-2 size-4 animate-spin" />}
                  🚀 Deploy Agent
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(step === 1 ? 0 : step - 1)}>
              {step === 1 ? "Back to Type Selection" : "Back"}
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => router.push("/dashboard/agents")}>
                Cancel
              </Button>
              {step < 4 && (
                <Button onClick={() => setStep(step + 1)}>
                  Next
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
