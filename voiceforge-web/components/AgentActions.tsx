"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function AgentActions({
  agentId,
  isActive,
}: {
  agentId: string;
  isActive: boolean;
}) {
  const [active, setActive] = useState(isActive);
  const [busy, setBusy] = useState(false);
  const [switchBusy, setSwitchBusy] = useState(false);

  const onRegenerate = async () => {
    setBusy(true);
    try {
      await api.agents.regenerateContext(agentId);
      toast.success("Context regenerated");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to regenerate context";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const onToggleActive = async (next: boolean) => {
    setSwitchBusy(true);
    setActive(next);
    try {
      await api.agents.update(agentId, { isActive: next });
      toast.success(next ? "Agent activated" : "Agent paused");
    } catch (error) {
      setActive(!next);
      const message = error instanceof Error ? error.message : "Failed to update agent status";
      toast.error(message);
    } finally {
      setSwitchBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button onClick={onRegenerate} disabled={busy}>
        Regenerate Context
      </Button>
      <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
        <span className="text-sm font-medium">Active</span>
        <Switch
          checked={active}
          onCheckedChange={onToggleActive}
          disabled={switchBusy}
          aria-label="Toggle agent active status"
        />
      </div>
    </div>
  );
}
