"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  BookOpen,
  Bot,
  CreditCard,
  LayoutDashboard,
  Megaphone,
  Menu,
  Phone,
  Sparkles,
  LogOut,
} from "lucide-react";
import { CreditBadge } from "@/components/CreditBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/agents", label: "My Agents", icon: Bot },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/dashboard/calls", label: "Call History", icon: Phone },
  { href: "/dashboard/knowledge", label: "Knowledge Base", icon: BookOpen },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
];

function SidebarContent() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;
  const initials =
    user?.name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  return (
    <div className="flex h-full w-full flex-col border-r border-[var(--border)] bg-[var(--bg-card)]">
      <div className="space-y-4 border-b border-[var(--border)] p-4">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--brand-light)] text-[var(--brand)]">
            <Sparkles className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--brand)]">VoiceForge</p>
            <p className="text-xs text-[var(--text-muted)]">AI calling agents</p>
          </div>
        </div>
        <CreditBadge />
      </div>

      <nav className="flex-1 space-y-1 p-3" aria-label="Dashboard navigation">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md border-l-2 border-transparent px-3 py-2 text-sm transition",
                active
                  ? "border-l-[var(--brand)] bg-[var(--brand-light)] text-[var(--brand)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
              )}
            >
              <item.icon className="size-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border)] p-3">
        <div className="mb-2 flex items-center gap-2 rounded-md bg-[var(--bg-subtle)] p-2">
          <Avatar size="sm">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--text-primary)]">{user?.name ?? "User"}</p>
            <p className="truncate text-xs text-[var(--text-secondary)]">{user?.email ?? ""}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => signOut({ callbackUrl: "/login" })}
          aria-label="Sign out of VoiceForge"
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <>
      <aside className="hidden h-screen w-[240px] shrink-0 md:block">
        <SidebarContent />
      </aside>
      <div className="border-b border-[var(--border)] bg-[var(--bg-card)] p-3 md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Open sidebar">
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[240px] p-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
