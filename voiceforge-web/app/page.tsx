import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function Home() {
  const session = await auth();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <section className="relative overflow-hidden border-b border-[var(--border)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-28 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[var(--brand-light)]/80 blur-3xl" />
          <div className="absolute bottom-0 right-20 h-64 w-64 rounded-full bg-[var(--warning-bg)] blur-3xl" />
          <div className="absolute top-16 left-20 h-56 w-56 rounded-full bg-[var(--info-bg)] blur-3xl" />
        </div>
        <div className="page-shell relative px-6 py-24 text-center">
          <Badge className="mb-5 bg-[var(--brand-light)] text-[var(--brand)] hover:bg-[var(--brand-light)]">
            ✦ AI Voice Agents for Every Business
          </Badge>
          <h1 className="mx-auto max-w-4xl text-4xl sm:text-5xl md:text-6xl">
            Deploy AI Calling Agents in Minutes
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg text-[var(--text-secondary)] sm:text-xl">
            Real phone calls. Real conversations. Sales, support, tech, marketing - powered by your own business knowledge.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/login">Start Free - 50 Credits -&gt;</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="#how-it-works">See how it works ↓</Link>
            </Button>
          </div>
          <p className="mt-5 text-sm text-[var(--text-secondary)]">
            ✓ No credit card required · ✓ 50 free credits on signup · ✓ Live in 5 minutes
          </p>
        </div>
      </section>

      <section id="how-it-works" className="page-shell px-6 py-12">
        <h2 className="mb-5 text-center">From zero to live agent in 4 steps</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            "📄 Upload your docs",
            "🧠 AI learns your business",
            "🎙 Pick a voice & role",
            "📞 Go live",
          ].map((step) => (
            <Card key={step} className="border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-sm)]">
              <CardContent className="p-5 text-sm text-[var(--text-secondary)]">{step}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="page-shell px-6 pb-14">
        <h2 className="mb-5 text-center">One platform, four kinds of agents</h2>
        <Card className="border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-sm)]">
          <CardContent className="grid gap-4 p-6 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
            <p><strong>Marketing Agent:</strong> bulk outbound calls from CSV contact lists.</p>
            <p><strong>Support Agent:</strong> inbound customer Q&A on your Vapi number.</p>
            <p><strong>Sales Agent:</strong> lead qualification and demo booking workflows.</p>
            <p><strong>Tech Support:</strong> inbound and outbound issue handling.</p>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t border-[var(--border)] py-6 text-center text-sm text-[var(--text-secondary)]">
        © 2026 VoiceForge
      </footer>
    </main>
  );
}
