"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function InboundPhoneCard({
  phoneNumber,
  vapiAgentId,
}: {
  phoneNumber?: string;
  vapiAgentId?: string;
}) {
  const qrUrl = phoneNumber
    ? `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(`tel:${phoneNumber}`)}`
    : "";

  if (phoneNumber) {
    return (
      <div className="space-y-3">
        <p className="text-3xl font-semibold tracking-tight">{phoneNumber}</p>
        <p className="text-sm text-slate-600">Your customers call this number</p>
        <p className="text-sm text-slate-500">Share with your customers to start receiving calls</p>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <a href={qrUrl} target="_blank" rel="noreferrer">
              QR code
            </a>
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(phoneNumber);
              toast.success("Phone number copied");
            }}
            aria-label="Copy phone number"
          >
            Copy number
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="font-medium">Assign a phone number to this agent</p>
      <p className="text-slate-600">
        Go to Vapi dashboard → Phone Numbers → buy a number → assign to assistant{" "}
        <code>{vapiAgentId ?? "(missing vapiAgentId)"}</code>
      </p>
      <Button asChild>
        <a href="https://dashboard.vapi.ai/" target="_blank" rel="noreferrer">
          Open Vapi dashboard
        </a>
      </Button>
    </div>
  );
}
