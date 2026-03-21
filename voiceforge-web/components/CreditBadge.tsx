"use client";

import Link from "next/link";
import { useEffect } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/useUserStore";

export function CreditBadge() {
  const { data } = useSWR("credits", () => api.credits.get(), {
    refreshInterval: 60000,
  });

  const storeCredits = useUserStore((s) => s.user?.credits);
  const setUser = useUserStore((s) => s.setUser);
  const credits = data?.credits ?? storeCredits ?? 0;

  useEffect(() => {
    if (data?.credits === undefined || storeCredits === data.credits) return;
    const user = useUserStore.getState().user;
    if (user) setUser({ ...user, credits: data.credits });
  }, [data?.credits, setUser, storeCredits]);

  const colorClass =
    credits > 100
      ? "bg-[var(--success-bg)] text-[var(--success)]"
      : credits >= 10
        ? "bg-[var(--warning-bg)] text-[var(--warning)]"
        : "bg-[var(--danger-bg)] text-[var(--danger)] animate-pulse";

  return (
    <Link
      href="/dashboard/billing"
      aria-label={`Open billing. ${credits} credits available`}
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition hover:opacity-90",
        colorClass
      )}
    >
      ⚡ {credits} credits
    </Link>
  );
}
