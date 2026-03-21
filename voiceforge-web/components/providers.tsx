"use client";

import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/sonner";
import { useUserStore } from "@/store/useUserStore";

export function Providers({ children }: { children: React.ReactNode }) {
  const hydrate = useUserStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <SessionProvider
      refetchInterval={60 * 60} // Refetch session every hour
      refetchOnWindowFocus={true} // Refetch when window regains focus
    >
      {children}
      <Toaster richColors />
    </SessionProvider>
  );
}
