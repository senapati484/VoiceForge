"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, Mail, PhoneCall } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type Stage = "email" | "otp";

const RESEND_SECONDS = 30;

function getSendOtpUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
  return raw.endsWith("/api")
    ? `${raw}/auth/send-otp`
    : `${raw}/api/auth/send-otp`;
}

export default function LoginPage() {
  const router = useRouter();
  const sendOtpUrl = useMemo(() => getSendOtpUrl(), []);
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const otp = otpDigits.join("");

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => setResendIn((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  const handleGoogleSignIn = async () => {
    // Use redirect: true to let NextAuth handle the OAuth flow properly
    // The callback will go to /api/auth/callback/google and then redirect to /dashboard
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  const handleSendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      toast.error("Please enter your email");
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch(sendOtpUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      if (res.status === 429) {
        toast.error("Too many attempts - wait 15 minutes");
        return;
      }

      if (!res.ok) {
        toast.error("Failed to send code");
        return;
      }

      setEmail(trimmed);
      setStage("otp");
      setResendIn(RESEND_SECONDS);
      toast.success(`Code sent to ${trimmed}`);
    } catch {
      toast.error("Network error while sending code");
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }

    setIsVerifying(true);
    try {
      const result = await signIn("credentials", {
        type: "otp",
        email,
        otp,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (result?.error) {
        toast.error("Invalid or expired code");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      console.error("[Login] Exception:", err);
      toast.error("Network error. Please check your connection and try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const onOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const onOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  useEffect(() => {
    if (stage === "otp" && otp.length === 6 && !isVerifying) {
      handleVerifyCode();
    }
  }, [otp, stage, isVerifying]);

  const handleResend = async () => {
    if (resendIn > 0 || isSending) return;
    await handleSendCode();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] px-4 py-10">
      <Card className="w-full max-w-md border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-md)]">
        <CardHeader className="space-y-3 pb-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-[var(--brand)] text-white">
            <PhoneCall className="size-5" />
          </div>
          <CardTitle className="text-center text-2xl font-semibold tracking-tight">⚡ VoiceForge</CardTitle>
          <div className="text-center">
            <h2>Welcome back</h2>
            <p className="text-sm text-[var(--text-secondary)]">Sign in to manage your AI agents</p>
          </div>
          <div>
            <Badge className="mx-auto bg-[var(--success-bg)] text-[var(--success)] hover:bg-[var(--success-bg)]">
              ✦ 50 free credits on signup
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <Button className="w-full" size="lg" variant="outline" onClick={handleGoogleSignIn}>
            Continue with Google
          </Button>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--bg-card)] px-2 text-xs text-[var(--text-secondary)]">
              or
            </span>
          </div>

          {stage === "email" ? (
            <div className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button className="w-full" onClick={handleSendCode} disabled={isSending}>
                {isSending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Send login code
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setStage("email");
                  setOtpDigits(["", "", "", "", "", ""]);
                }}
                className="text-sm text-[var(--text-secondary)]"
              >
                ← Use different email
              </button>
              <p className="text-sm text-[var(--text-secondary)]">Enter the 6-digit code sent to {email}</p>
              <div className="flex justify-between gap-2">
                {otpDigits.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => {
                      otpRefs.current[index] = el;
                    }}
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => onOtpChange(index, e.target.value)}
                    onKeyDown={(e) => onOtpKeyDown(index, e)}
                    className="h-[52px] w-12 text-center text-lg"
                  />
                ))}
              </div>
              <Button className="w-full" onClick={handleVerifyCode} disabled={isVerifying}>
                {isVerifying && <Loader2 className="mr-2 size-4 animate-spin" />}
                Verify Code
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendIn > 0 || isSending}
                  className="text-[var(--text-secondary)] disabled:text-[var(--text-disabled)]"
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                </button>
              </div>
            </div>
          )}
          <p className="text-center text-xs text-[var(--text-muted)]">
            By signing in, you agree to our Terms and Privacy Policy
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
