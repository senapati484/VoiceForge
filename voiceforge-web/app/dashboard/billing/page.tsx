"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { CreditTransaction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PackId = "starter" | "growth" | "business";

const packs: { id: PackId; name: string; price: string; credits: number; note: string; popular?: boolean }[] = [
  { id: "starter", name: "Starter", price: "₹199", credits: 100, note: "~33 outbound minutes" },
  { id: "growth", name: "Growth", price: "₹799", credits: 500, note: "~166 outbound minutes", popular: true },
  { id: "business", name: "Business", price: "₹2499", credits: 2000, note: "~11 hours of calling" },
];

function signedAmount(tx: CreditTransaction): { text: string; className: string } {
  const positive = tx.type === "purchase" || tx.type === "refund" || tx.type === "bonus";
  return {
    text: `${positive ? "+" : "-"}${tx.amount}`,
    className: positive ? "text-green-700" : "text-red-700",
  };
}

export default function BillingPage() {
  const { data, mutate } = useSWR("credits", () => api.credits.get());
  const [buying, setBuying] = useState<PackId | null>(null);
  const credits = data?.credits ?? 0;
  const transactions = data?.transactions ?? [];

  const balanceClass = useMemo(() => {
    if (credits > 100) return "text-green-700";
    if (credits >= 10) return "text-amber-700";
    return "text-red-700";
  }, [credits]);

  const buyPack = async (packId: PackId, packCredits: number) => {
    setBuying(packId);
    try {
      const res = await api.credits.purchase(packId);
      toast.success(`+${res.creditsAdded || packCredits} credits!`);
      await mutate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Purchase failed";
      toast.error(message);
    } finally {
      setBuying(null);
    }
  };

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-slate-600">Manage credits and usage for calling operations.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Credit Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={cn("text-4xl font-bold tracking-tight", balanceClass)}>{credits}</p>
          <p className="mt-2 text-sm text-slate-600">~{Math.floor(credits / 3)} outbound minutes remaining</p>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card size="sm"><CardContent className="py-2 text-xs">Outbound call: <strong>3 credits/min</strong></CardContent></Card>
        <Card size="sm"><CardContent className="py-2 text-xs">Inbound call: <strong>2 credits/min</strong></CardContent></Card>
        <Card size="sm"><CardContent className="py-2 text-xs">Doc upload: <strong>5 credits/file</strong></CardContent></Card>
        <Card size="sm"><CardContent className="py-2 text-xs">Web scrape: <strong>2 credits/URL</strong></CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {packs.map((pack) => (
          <Card key={pack.id} className={pack.popular ? "ring-2 ring-indigo-300" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{pack.name}</CardTitle>
                {pack.popular && <Badge className="bg-indigo-100 text-indigo-700">Most Popular</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-2xl font-semibold">{pack.price}</p>
              <p className="text-sm text-slate-700">{pack.credits} credits</p>
              <p className="text-xs text-slate-500">{pack.note}</p>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={buying === pack.id}>Buy</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Add {pack.credits} credits?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Demo mode - payment coming soon
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => buyPack(pack.id, pack.credits)}>Confirm</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow key="empty">
                  <TableCell colSpan={4} className="text-center text-slate-500">
                    No transactions yet.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => {
                  const amount = signedAmount(tx);
                  return (
                    <TableRow key={tx.id}>
                      <TableCell>{new Date(tx.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="capitalize">{tx.type}</TableCell>
                      <TableCell>{tx.description}</TableCell>
                      <TableCell className={amount.className}>{amount.text}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
