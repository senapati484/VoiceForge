"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CallState = "idle" | "dialing" | "connected" | "ended";

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function formatEnded(durationSec?: number, creditsUsed?: number): string {
  const total = durationSec ?? 0;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `✅ ${minutes}m ${seconds}s · ${creditsUsed ?? 0} credits used`;
}

export function CallInitiator({ agentId }: { agentId: string }) {
  const { data: session } = useSession();
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<CallState>("idle");
  const [callId, setCallId] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [endedText, setEndedText] = useState("");
  const isBusy = state === "dialing" || state === "connected";

  const apiBase = useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
    return raw.endsWith("/api") ? raw : `${raw}/api`;
  }, []);

  useEffect(() => {
    if (state !== "connected" || !connectedAt) return;
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - connectedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [state, connectedAt]);

  useEffect(() => {
    if (!callId || (state !== "dialing" && state !== "connected")) return;
    const interval = setInterval(async () => {
      try {
        const call = await api.calls.get(callId);
        const status = call.status.toLowerCase();
        const ended = ["ended", "completed", "failed", "no-answer", "cancelled"].some((s) =>
          status.includes(s)
        );

        if (ended) {
          setState("ended");
          setEndedText(formatEnded(call.durationSec, call.creditsUsed));
          return;
        }

        if (state === "dialing") {
          setState("connected");
          setConnectedAt(Date.now());
        }
      } catch {
        // keep polling until call lifecycle settles
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [callId, state]);

  const startCall = async () => {
    if (!phone.trim()) {
      toast.error("Enter a phone number first");
      return;
    }

    setState("dialing");
    setEndedText("");
    setElapsed(0);
    setConnectedAt(null);

    try {
      const res = await fetch(`${apiBase}/calls/outbound`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.backendToken ?? ""}`,
        },
        body: JSON.stringify({ agentId, toNumber: phone.trim() }),
      });

      if (res.status === 402) {
        setState("idle");
        toast.error("Not enough credits. Top up in Billing.");
        return;
      }

      if (!res.ok) {
        setState("idle");
        toast.error("Failed to start call");
        return;
      }

      const data: { callId: string } = await res.json();
      setCallId(data.callId);
    } catch {
      setState("idle");
      toast.error("Network error while starting call");
    }
  };

  return (
    <div className="space-y-3">
      {state === "idle" && (
        <>
          <Input
            placeholder="+15551234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-label="Phone number to call"
          />
          <Button onClick={startCall} disabled={isBusy}>
            📞 Call
          </Button>
          <p className="text-xs text-slate-500">~3 credits/min</p>
        </>
      )}

      {state === "dialing" && (
        <p className="text-sm text-amber-700 animate-pulse" aria-live="polite">
          ● Dialing...
        </p>
      )}

      {state === "connected" && (
        <p className="text-sm text-red-600" aria-live="polite">
          🔴 {formatTimer(elapsed)}
        </p>
      )}

      {state === "ended" && (
        <>
          <p className="text-sm text-green-700">{endedText}</p>
          <Button variant="outline" size="sm" onClick={() => setState("idle")}>
            Start Another Call
          </Button>
        </>
      )}
    </div>
  );
}
