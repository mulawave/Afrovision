"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";

// AfroVision brand palette
const COLORS = {
  darkBlue: "#050A30",
  lightBlue: "#173A6D",
  lightOrange: "#F5C16C",
  orange: "#F49617",
  white: "#FFFFFF",
  errorRed: "#FF4D6A",
  successGreen: "#4CAF50",
  cardBg: "#0A1040",
  hintText: "#5A6190",
};

type SignupState = {
  payment_status?: string;
  signup_status?: string;
};

type ActiveChallengeResponse = {
  challenge?: { id?: string | null } | null;
  challenge_id?: string | null;
  id?: string | null;
};

type AuditionPricingResponse = {
  error?: string;
  challenge_title?: string;
  fee_ngn?: number;
  pricing?: {
    audition_price_ngn?: number;
    user_reward_vpt_ngn?: number;
    community_pool_vpt_ngn?: number;
    ops_pool_ngn?: number;
  };
};

export default function ChallengeAuditionWebPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [signup, setSignup] = useState<SignupState | null>(null);
  const [initiating, setInitiating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const [emailDeliveryNotice, setEmailDeliveryNotice] = useState<string | null>(null);
  const [pricing, setPricing] = useState<AuditionPricingResponse | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);

  function getPaymentIdFromQuery(): string | null {
    if (typeof window === "undefined") return null;
    const sp = new URLSearchParams(window.location.search);
    const pid = sp.get("payment_id");
    return pid && pid.trim() ? pid.trim() : null;
  }

  // Redirect unauthenticated users
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Check if we're in a payment callback (payment_id in URL)
      const paymentId = getPaymentIdFromQuery();
      if (paymentId) {
        // This is a Paystack callback - don't redirect away, stay on page
        // and let the verification effect handle the auth requirement
        console.log("[Audition Payment] Callback detected with payment_id. User not authenticated. Waiting for verification...");
        return;
      }
      // No payment callback - redirect to login
      router.replace("/login?redirect=/challenge/audition");
    }
  }, [isAuthenticated, isLoading, router]);

  // Restore pending payment id from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromQuery = getPaymentIdFromQuery();
    if (fromQuery) {
      window.localStorage.setItem("av_challenge_pending_payment_id", fromQuery);
      setPendingPaymentId(fromQuery);
      return;
    }
    const cached = window.localStorage.getItem("av_challenge_pending_payment_id");
    if (cached) setPendingPaymentId(cached);
  }, []);

  // Auto-verify when callback returns with payment_id
  useEffect(() => {
    const fromQuery = getPaymentIdFromQuery();
    
    // If URL has payment_id but user is not authenticated, wait a moment for auth to restore
    if (fromQuery && !isAuthenticated && !isLoading) {
      console.log("[Audition Payment] Callback detected with payment_id but user not authenticated yet. Waiting for session restore...");
      // Set a timeout to check again in 1 second
      const timer = setTimeout(() => {
        // If still not authenticated after a second, user's session was lost
        console.warn("[Audition Payment] User session lost during Paystack redirect");
        setPaymentError("Your session was lost during payment. Please log in again and try to verify your payment.");
      }, 1000);
      return () => clearTimeout(timer);
    }

    // Normal auto-verify flow
    if (!isAuthenticated || !pendingPaymentId || verifying) return;
    if (!fromQuery || fromQuery !== pendingPaymentId) return;

    console.log("[Audition Payment] Auto-verifying payment:", pendingPaymentId);

    (async () => {
      await handleVerify();
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("payment_id");
        window.history.replaceState({}, "", url.toString());
      }
    })();
    // Intentionally depends on auth + pending + verify state only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading, pendingPaymentId, verifying]);

  // Silently fetch active challenge id + signup status for payment wiring only
  useEffect(() => {
    if (!isAuthenticated) return;
    let mounted = true;

    (async () => {
      try {
        const activeRes = await api<ActiveChallengeResponse>("/challenge/active", {
          requireAuth: true,
        });
        if (!mounted) return;
        const activeId = activeRes.ok
          ? activeRes.data?.challenge?.id || activeRes.data?.challenge_id || activeRes.data?.id || null
          : null;

        if (activeId) {
          setChallengeId(activeId);

          const statusRes = await api<{ signup?: SignupState | null }>(
            `/challenge/audition/status?challenge_id=${encodeURIComponent(activeId)}`,
            { requireAuth: true }
          );
          if (mounted && statusRes.ok) {
            setSignup(statusRes.data?.signup ?? null);
          }
        }
      } catch {
        // silently ignore — page content always shows
      }
    })();

    return () => { mounted = false; };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let mounted = true;

    (async () => {
      try {
        setPricingLoading(true);
        setPricingError(null);

        const activeId = challengeId;
        const path = activeId
          ? `/challenge/audition/payment/pricing?challenge_id=${encodeURIComponent(activeId)}`
          : `/challenge/audition/payment/pricing`;

        const res = await api<AuditionPricingResponse>(path, { requireAuth: true });
        if (!mounted) return;

        if (res.ok) {
          setPricing(res.data);
        } else {
          setPricingError(res.data?.error || "Failed to load audition payment info");
        }
      } catch {
        if (mounted) setPricingError("Failed to load audition payment info");
      } finally {
        if (mounted) setPricingLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [isAuthenticated, challengeId]);

  async function handleInitiate() {
    setInitiating(true);
    setPaymentError(null);
    try {
      // Always use the canonical public domain so Paystack callbacks always
      // return to the correct session-bearing origin, never a Cloud Run URL.
      const canonicalOrigin =
        process.env.NEXT_PUBLIC_SITE_URL ||
        (typeof window !== "undefined" ? window.location.origin : undefined);

      const sameOriginReturnUrl = canonicalOrigin
        ? `${canonicalOrigin.replace(/\/$/, "")}/challenge/audition`
        : undefined;

      // Validate return_url before sending
      if (!sameOriginReturnUrl) {
        throw new Error("Failed to determine callback URL. Please refresh and try again.");
      }

      console.log("[Audition Payment] Initiating payment with return_url:", sameOriginReturnUrl);

      const payload = challengeId
        ? { challenge_id: challengeId, return_url: sameOriginReturnUrl }
        : { return_url: sameOriginReturnUrl };

      const res = await api<{ payment_id?: string; checkout_url?: string; error?: string }>(
        "/challenge/audition/payment/initialize",
        { method: "POST", requireAuth: true, body: payload }
      );
      if (!res.ok || !res.data.payment_id || !res.data.checkout_url) {
        throw new Error(res.data.error || "Failed to initialize payment");
      }
      setPendingPaymentId(res.data.payment_id);
      if (typeof window !== "undefined") {
        console.log("[Audition Payment] Payment initialized. ID:", res.data.payment_id);
        window.localStorage.setItem("av_challenge_pending_payment_id", res.data.payment_id);
        console.log("[Audition Payment] Redirecting to Paystack checkout");
        window.location.href = res.data.checkout_url;
      }
    } catch (e) {
      setPaymentError(e instanceof Error ? e.message : "Payment initialization failed");
    } finally {
      setInitiating(false);
    }
  }

  async function handleVerify() {
    if (!pendingPaymentId) return;
    setVerifying(true);
    setPaymentError(null);
    setEmailDeliveryNotice(null);
    try {
      console.log("[Audition Payment] Verifying payment:", pendingPaymentId);
      
      const res = await api<{ signup?: SignupState; error?: string }>(
        `/challenge/audition/payment/${encodeURIComponent(pendingPaymentId)}/verify`,
        { method: "POST", requireAuth: true }
      );
      
      if (!res.ok) {
        console.error("[Audition Payment] Verification failed. Response:", res);
        
        // Handle auth errors specifically
        if (res.status === 401) {
          throw new Error("Your session expired. Please log in and try again.");
        }
        
        throw new Error(res.data.error || "Payment verification failed");
      }
      
      console.log("[Audition Payment] Verification successful:", res.data);
      if (res.data.signup) setSignup(res.data.signup);
      setEmailDeliveryNotice(
        "Payment verified successfully. Your confirmation email is on its way. If you do not see it in your inbox, check your spam/junk folder and whitelist AfroVision to keep future emails out of spam."
      );
      setPendingPaymentId(null);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("av_challenge_pending_payment_id");
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Payment verification failed";
      console.error("[Audition Payment] Verification error:", errorMsg);
      setPaymentError(errorMsg);
    } finally {
      setVerifying(false);
    }
  }

  if (isLoading || !isAuthenticated) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(180deg,${COLORS.lightBlue} 0%,${COLORS.darkBlue} 100%)`,
        }}
      >
        <div
          style={{
            height: 40,
            width: 40,
            borderRadius: "50%",
            border: `2px solid ${COLORS.orange}40`,
            borderTop: `2px solid ${COLORS.orange}`,
            animation: "spin 1s linear infinite",
          }}
        />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </main>
    );
  }

  const paid = signup?.payment_status === "paid" || signup?.signup_status === "enrolled";
  const auditionFee = pricing?.fee_ngn ?? pricing?.pricing?.audition_price_ngn ?? 2500;

  // ── POST-AUDITION CONFIRMATION SCREEN ─────────────────────────────────────
  if (paid) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: `linear-gradient(180deg,${COLORS.lightBlue} 0%,${COLORS.darkBlue} 100%)`,
          fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
        }}
      >
        <style>{`
          @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(24px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 0 0 0 rgba(76,175,80,0.0); }
            50%       { box-shadow: 0 0 40px 8px rgba(76,175,80,0.18); }
          }
        `}</style>

        {/* ── HERO ───────────────────────────────────────────────── */}
        <section
          style={{
            position: "relative",
            paddingTop: 120,
            paddingBottom: 80,
            paddingLeft: 24,
            paddingRight: 24,
            textAlign: "center",
            overflow: "hidden",
          }}
        >
          {/* Decorative glow */}
          <div style={{ pointerEvents: "none", position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 0 }}>
            <div style={{ height: 600, width: 600, borderRadius: "50%", background: `${COLORS.successGreen}12`, filter: "blur(130px)" }} />
          </div>

          <div style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto", animation: "fadeSlideUp 0.7s ease both" }}>
            {/* Badge */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, border: `1px solid ${COLORS.successGreen}50`, background: `${COLORS.successGreen}12`, padding: "8px 18px", marginBottom: 28 }}>
              <span style={{ color: COLORS.successGreen, fontSize: 14 }}>✓</span>
              <span style={{ color: COLORS.successGreen, fontSize: 12, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase" }}>Audition Signup Complete</span>
            </div>

            {/* Eyebrow */}
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.45em", textTransform: "uppercase", color: COLORS.lightOrange, marginBottom: 14, margin: "0 0 14px" }}>
              AFROVISION CHALLENGE · THE AMAZONS
            </p>

            {/* Icon */}
            <div
              style={{
                width: 96, height: 96, borderRadius: "50%",
                background: `${COLORS.successGreen}18`,
                border: `2px solid ${COLORS.successGreen}50`,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 28px",
                animation: "pulse-glow 3s ease-in-out infinite",
              }}
            >
              <span style={{ fontSize: 44 }}>🏆</span>
            </div>

            {/* Headline */}
            <h1 style={{ fontSize: 56, fontWeight: 900, letterSpacing: "-0.02em", color: COLORS.white, lineHeight: 1.05, margin: "0 0 12px" }}>
              YOU&apos;RE IN.
            </h1>
            <p style={{ fontSize: 22, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: COLORS.lightOrange, margin: "0 0 24px" }}>
              Slot Secured
            </p>
            <p style={{ maxWidth: 480, margin: "0 auto 40px", fontSize: 17, color: `${COLORS.white}B3`, lineHeight: 1.7, fontWeight: 500 }}>
              Your audition signup for <strong style={{ color: COLORS.white }}>AfroVision Challenge: The Amazons</strong> has been received and confirmed.
              Your slot is locked. Your journey starts here.
            </p>

            {/* Confirmation card */}
            <div
              style={{
                maxWidth: 560, margin: "0 auto 40px",
                borderRadius: 24, border: `1px solid ${COLORS.successGreen}35`,
                background: `${COLORS.successGreen}0A`,
                backdropFilter: "blur(18px)",
                padding: "28px 32px",
                textAlign: "left",
              }}
            >
              {[
                { icon: "✅", title: "Audition Slot Secured", body: "Your registration record has been created and your spot is reserved in the selection pool." },
                { icon: "💰", title: "vPT Reward Credited", body: "Your vPT reward has been credited to your AfroVision wallet as a thank-you for signing up." },
                { icon: "📧", title: "Confirmation Email Sent", body: "A confirmation email is on its way. Check your spam/junk folder and whitelist AfroVision if needed." },
              ].map((item) => (
                <div key={item.title} style={{ display: "flex", gap: 14, marginBottom: 20 }}>
                  <div style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{item.icon}</div>
                  <div>
                    <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: COLORS.white }}>{item.title}</p>
                    <p style={{ margin: 0, fontSize: 13, color: `${COLORS.white}80`, lineHeight: 1.55 }}>{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── WATCH THIS SPACE ────────────────────────────────────── */}
        <section style={{ paddingTop: 60, paddingBottom: 60, paddingLeft: 24, paddingRight: 24, backgroundColor: COLORS.darkBlue }}>
          <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 24, borderRadius: 999, border: `1px solid ${COLORS.lightOrange}40`, background: `${COLORS.lightOrange}0D`, padding: "8px 18px" }}>
              <span style={{ fontSize: 14 }}>📡</span>
              <span style={{ color: COLORS.lightOrange, fontSize: 11, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase" }}>Watch This Space</span>
            </div>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: COLORS.white, margin: "0 0 16px", lineHeight: 1.15 }}>
              Pre-Audition Materials<br />
              <span style={{ color: COLORS.lightOrange }}>Coming to This Page</span>
            </h2>
            <p style={{ fontSize: 16, color: `${COLORS.white}80`, lineHeight: 1.7, maxWidth: 560, margin: "0 auto 40px" }}>
              All challenge briefings, preparation guides, audition instructions, contestant resources, and pre-audition content will be added right here.
              This is your dedicated challenger hub — bookmark it and check back regularly.
            </p>

            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))" }}>
              {[
                { icon: "📋", title: "Challenge Briefing", body: "Full challenge rules, judging criteria, and what to expect." },
                { icon: "🎤", title: "Audition Guide", body: "Step-by-step instructions to prepare and submit your audition." },
                { icon: "📚", title: "Preparation Materials", body: "Resources and study content to help you perform at your best." },
                { icon: "📅", title: "Timeline & Dates", body: "Key dates, deadlines, and schedule for the challenge phases." },
              ].map((item) => (
                <div
                  key={item.title}
                  style={{
                    borderRadius: 20,
                    border: `1px solid ${COLORS.white}10`,
                    background: `${COLORS.white}05`,
                    padding: "22px 20px",
                    textAlign: "left",
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 12 }}>{item.icon}</div>
                  <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: COLORS.white }}>{item.title}</p>
                  <p style={{ margin: 0, fontSize: 13, color: `${COLORS.white}60`, lineHeight: 1.5 }}>{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── WHAT HAPPENS NEXT ───────────────────────────────────── */}
        <section style={{ paddingTop: 60, paddingBottom: 60, paddingLeft: 24, paddingRight: 24 }}>
          <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.4em", textTransform: "uppercase", color: COLORS.orange, margin: "0 0 12px" }}>
              WHAT HAPPENS NEXT
            </p>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: COLORS.white, margin: "0 0 36px", lineHeight: 1.2 }}>
              Your Audition Journey
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[
                { step: "1", label: "Signup Received", desc: "Your audition record is created and your slot is in the queue.", done: true },
                { step: "2", label: "Shortlisting", desc: "The AfroVision team reviews all applicants and shortlists challengers.", done: false },
                { step: "3", label: "Audition Submission", desc: "Selected participants receive instructions to submit their audition content.", done: false },
                { step: "4", label: "Final Selection", desc: "Finalists are announced and the challenge officially begins.", done: false },
              ].map((item, idx, arr) => (
                <div key={item.step} style={{ display: "flex", gap: 18, textAlign: "left" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div
                      style={{
                        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: item.done ? `${COLORS.successGreen}20` : `${COLORS.white}08`,
                        border: `2px solid ${item.done ? COLORS.successGreen + "60" : COLORS.white + "20"}`,
                        fontSize: 13, fontWeight: 700,
                        color: item.done ? COLORS.successGreen : `${COLORS.white}50`,
                      }}
                    >
                      {item.done ? "✓" : item.step}
                    </div>
                    {idx < arr.length - 1 && (
                      <div style={{ width: 2, flex: 1, minHeight: 24, background: `${COLORS.white}10`, margin: "4px 0" }} />
                    )}
                  </div>
                  <div style={{ paddingBottom: idx < arr.length - 1 ? 28 : 0, paddingTop: 6 }}>
                    <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: item.done ? COLORS.white : `${COLORS.white}70` }}>{item.label}</p>
                    <p style={{ margin: 0, fontSize: 13, color: `${COLORS.white}50`, lineHeight: 1.55 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FOOTER ─────────────────────────────────────────────── */}
        <footer style={{ borderTop: `1px solid ${COLORS.white}10`, paddingTop: 40, paddingBottom: 40, paddingLeft: 24, paddingRight: 24, textAlign: "center" }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: `${COLORS.white}50`, margin: "0 0 8px" }}>AFROVISION CHALLENGE</p>
          <p style={{ fontSize: 11, color: `${COLORS.white}30`, margin: 0 }}>
            © 2026 AfroVision Challenge — The Amazons Edition. All rights reserved.
          </p>
        </footer>
      </main>
    );
  }
  // ── END POST-AUDITION SCREEN ─────────────────────────────────────────────

  function RegisterCTA({ label, className }: { label: string; className?: string }) {
    if (paid) {
      return (
        <div
          className={className}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            padding: "16px 32px",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.12em",
            background: `${COLORS.successGreen}20`,
            border: `1.5px solid ${COLORS.successGreen}80`,
            color: COLORS.successGreen,
          }}
        >
          ✓ ENROLLED — SLOT SECURED
        </div>
      );
    }
    return (
      <button
        className={className}
        onClick={handleInitiate}
        disabled={initiating}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 999,
          padding: "16px 32px",
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: "0.12em",
          background: `linear-gradient(90deg,${COLORS.orange} 0%,${COLORS.lightOrange} 100%)`,
          color: COLORS.darkBlue,
          border: "none",
          opacity: initiating ? 0.7 : 1,
          transition: "opacity 0.2s",
          cursor: initiating ? "not-allowed" : "pointer",
          boxShadow: "0 2px 12px 0 rgba(20,20,40,0.10)",
        }}
      >
        {initiating ? "OPENING PAYMENT..." : label}
      </button>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: `linear-gradient(180deg,${COLORS.lightBlue} 0%,${COLORS.darkBlue} 100%)`,
        fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
      }}
    >
      {/* ── SECTION 1: HERO ─────────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          paddingTop: 120,
          paddingBottom: 80,
          paddingLeft: 24,
          paddingRight: 24,
          textAlign: "center",
          overflow: "hidden",
        }}
      >
        {/* Decorative glow */}
        <div
          style={{
            pointerEvents: "none",
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 0,
          }}
        >
          <div
            style={{
              height: 600,
              width: 600,
              borderRadius: "50%",
              background: `${COLORS.orange}15`,
              filter: "blur(120px)",
            }}
          />
        </div>
        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 800,
            margin: "0 auto",
          }}
        >
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.4em",
              textTransform: "uppercase",
              color: COLORS.lightOrange,
              marginBottom: 16,
            }}
          >
            AFROVISION CHALLENGE
          </p>
          <h1
            style={{
              fontSize: 64,
              fontWeight: 900,
              letterSpacing: "-0.02em",
              color: COLORS.white,
              lineHeight: 1.05,
              margin: 0,
            }}
          >
            THE AMAZONS
          </h1>
          <p
            style={{
              marginTop: 20,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: COLORS.lightOrange,
            }}
          >
            Where Warriors Are Forged
          </p>
          <p
            style={{
              marginTop: 24,
              maxWidth: 520,
              marginLeft: "auto",
              marginRight: "auto",
              fontSize: 18,
              color: `${COLORS.white}B3`,
              lineHeight: 1.6,
              fontWeight: 500,
            }}
          >
            A high-intensity reality program designed to discover and transform young African women
            into elite business leaders. From complete novices to battle-tested strategists —
            we build, test, and elevate.
          </p>

          <div
            style={{
              marginTop: 32,
              maxWidth: 640,
              marginLeft: "auto",
              marginRight: "auto",
              borderRadius: 28,
              border: `1px solid ${COLORS.lightOrange}33`,
              background: "rgba(10,16,64,0.72)",
              backdropFilter: "blur(18px)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
              padding: "24px 28px",
              textAlign: "left",
            }}
          >
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: COLORS.lightOrange, margin: 0 }}>
              Audition Payment
            </p>
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: `${COLORS.white}CC`, margin: 0 }}>
                  You’ll pay a one-time audition signup fee of
                </p>
                <p style={{ fontSize: 34, fontWeight: 900, color: COLORS.white, margin: "6px 0 0" }}>
                  ₦{auditionFee.toLocaleString()}
                </p>
              </div>
              <div style={{ minWidth: 160, textAlign: "right" }}>
                <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: `${COLORS.white}66`, margin: 0 }}>
                  Includes
                </p>
                <p style={{ fontSize: 14, color: `${COLORS.white}B3`, lineHeight: 1.5, margin: "6px 0 0" }}>
                  verification, audition record creation, and confirmation email delivery.
                </p>
              </div>
            </div>
            <div style={{ marginTop: 18, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
              {[
                "Secure your audition slot",
                "Create a paid signup record",
                "Receive payment confirmation",
              ].map((item) => (
                <div key={item} style={{ borderRadius: 18, border: `1px solid ${COLORS.white}14`, background: "rgba(255,255,255,0.04)", padding: "12px 14px", color: `${COLORS.white}D9`, fontSize: 13, fontWeight: 600 }}>
                  {item}
                </div>
              ))}
            </div>
            <p style={{ marginTop: 16, fontSize: 12, lineHeight: 1.6, color: `${COLORS.white}66`, marginBottom: 0 }}>
              {pricingLoading
                ? "Loading live payment details..."
                : pricingError
                  ? pricingError
                  : "The fee is collected before your audition signup is reviewed and enrolled."}
            </p>
          </div>

          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <RegisterCTA label="REGISTER FOR AUDITION NOW" />
            {paymentError && (
              <p style={{ color: COLORS.errorRed, fontSize: 15, maxWidth: 400, textAlign: "center", fontWeight: 600 }}>{paymentError}</p>
            )}
            {emailDeliveryNotice && (
              <p
                style={{
                  color: `${COLORS.lightOrange}`,
                  fontSize: 14,
                  lineHeight: 1.6,
                  maxWidth: 680,
                  textAlign: "center",
                  fontWeight: 600,
                }}
              >
                {emailDeliveryNotice}
              </p>
            )}
            {pendingPaymentId && !paid && (
              <button
                onClick={handleVerify}
                disabled={verifying}
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: COLORS.lightOrange,
                  textDecoration: "underline",
                  textUnderlineOffset: 2,
                  background: "none",
                  border: "none",
                  cursor: verifying ? "not-allowed" : "pointer",
                  opacity: verifying ? 0.7 : 1,
                  marginTop: 4,
                }}
              >
                {verifying ? "Verifying payment..." : "I have completed payment — verify now"}
              </button>
            )}
          </div>
          <p
            style={{
              marginTop: 40,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: `${COLORS.white}66`,
            }}
          >
            STRICTLY FOR WOMEN ONLY &nbsp;|&nbsp; AGES 18 — 30 &nbsp;|&nbsp; AFRICA&apos;S ELITE AWAIT
          </p>
        </div>
      </section>

      {/* ── SECTION 2: MANIFESTO ────────────────────────────────── */}
      <section className="py-20 px-6" style={{ backgroundColor: COLORS.darkBlue }}>
        <div className="max-w-3xl mx-auto">
          <div className="border-l-4 border-[#F49617] pl-8">
            <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
              This Is Not About<br />Popularity
            </h2>
            <ul className="mt-8 space-y-3">
              {[
                "This is about resilience.",
                "This is about raw intelligence.",
                "This is about logical intuition.",
                "This is about execution under pressure.",
              ].map((line) => (
                <li key={line} className="flex items-start gap-3 text-lg text-white/80">
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#F49617]" />
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-8 space-y-2">
              <p className="text-base font-bold text-[#F5C16C]">We don&apos;t seek followers. We forge leaders.</p>
              <p className="text-base font-bold text-[#F5C16C]">We don&apos;t reward noise. We reward results.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: THE GAUNTLET ─────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold tracking-[0.4em] uppercase text-[#F49617]">THE GAUNTLET</p>
            <h2 className="mt-3 text-4xl sm:text-5xl font-black text-white">
              Stress-Based Challenges.<br />Real-World Pressure. Zero Mercy.
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {[
              {
                num: "01",
                icon: "⚡",
                title: "DECISION-MAKING UNDER UNCERTAINTY",
                body: "High-stakes scenarios with incomplete information. Split-second calls that separate the decisive from the paralyzed. Your intuition will be tested. Your judgment will be judged.",
              },
              {
                num: "02",
                icon: "🎯",
                title: "LEADERSHIP UNDER TENSION",
                body: "Command when chaos reigns. Rally teams when morale breaks. The true measure of leadership isn't comfort — it's the fire. Can you hold the line when everything demands you fold?",
              },
              {
                num: "03",
                icon: "🔥",
                title: "CREATIVE PROBLEM-SOLVING",
                body: "Impossible constraints. Limited resources. Unforgiving deadlines. Innovation isn't a luxury here — it's survival. We don't want ideas. We want solutions that work.",
              },
              {
                num: "04",
                icon: "⏱️",
                title: "EXECUTION SPEED",
                body: "Strategy without execution is hallucination. Move fast. Ship faster. In the real world, the swift outrun the perfect. Velocity is a weapon. Wield it.",
              },
            ].map((item) => (
              <div
                key={item.num}
                className="rounded-3xl border border-white/10 p-8 hover:border-[#F49617]/40 transition-colors"
                style={{ backgroundColor: COLORS.darkBlue }}
              >
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-3xl font-black text-[#F49617]/30">{item.num}</span>
                  <span className="text-3xl">{item.icon}</span>
                </div>
                <h3 className="text-sm font-bold tracking-[0.15em] uppercase text-[#F5C16C] mb-3">
                  {item.title}
                </h3>
                <p className="text-sm text-white/65 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 4: TRANSFORMATION ARC ──────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-black text-white leading-tight">
            FROM NOVICE<br />
            <span className="text-[#F49617]">TO STRATEGIST</span>
          </h2>
          <p className="mt-6 text-base text-white/70 leading-relaxed">
            Every participant enters as a contender. Those who survive the crucible exit as something
            far more valuable: co-founders.
          </p>
          <p className="mt-4 text-base text-white/70 leading-relaxed">
            This is not a competition for a crown. This is a transformation into ownership. The journey
            breaks you down to build you back — sharper, stronger, ready to command boardrooms and markets.
          </p>

          <div className="mt-12 flex flex-col items-center gap-0">
            {/* START */}
            <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-white/5 p-6">
              <p className="text-xs font-bold tracking-[0.3em] uppercase text-white/40 mb-2">START</p>
              <p className="text-xl font-black text-white">CONTESTANT</p>
              <p className="mt-1 text-sm text-white/50">Raw potential. Unproven. Hungry.</p>
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center py-4 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-3 w-0.5 bg-[#F49617]/40" />
              ))}
              <span className="text-[#F49617] text-2xl font-black leading-none">▼</span>
            </div>

            {/* FINISH */}
            <div className="w-full max-w-sm rounded-2xl border border-[#F49617]/40 bg-[#F49617]/10 p-6 shadow-[0_0_40px_rgba(244,150,23,0.2)]">
              <p className="text-xs font-bold tracking-[0.3em] uppercase text-[#F49617]/70 mb-2">FINISH</p>
              <p className="text-xl font-black text-[#F49617]">CO-FOUNDER</p>
              <p className="mt-1 text-sm text-[#F5C16C]/70">Battle-tested. Proven. Elite.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: THE PRIZE ────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-bold tracking-[0.4em] uppercase text-[#F49617]">THE PRIZE</p>
          <h2 className="mt-3 text-4xl sm:text-5xl font-black text-white">Not Winners. Co-Founders.</h2>

          <div className="mt-12 rounded-3xl border border-[#F49617]/30 bg-gradient-to-br from-[#F49617]/10 to-[#050A30]/60 p-10 shadow-[0_25px_80px_rgba(244,150,23,0.15)]">
            <div className="flex items-center justify-center mb-6">
              <span className="text-8xl font-black text-[#F49617]">5</span>
            </div>
            <p className="text-base text-white/75 leading-relaxed max-w-xl mx-auto">
              At the end of the journey, <strong className="text-white">5 outstanding women will emerge</strong> — not
              as contestants, but as co-founders. Equity. Ownership. A seat at the table.
              This is the real prize.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: FINAL CTA ────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-black text-white leading-tight">
            DO YOU HAVE<br />WHAT IT TAKES?
          </h2>
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="h-px w-12 bg-[#F49617]/40" />
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-[#F5C16C]">
              Sign up for audition below
            </p>
            <span className="h-px w-12 bg-[#F49617]/40" />
          </div>

          <p className="mt-6 text-base text-white/65 leading-relaxed max-w-xl mx-auto">
            The arena is set. The pressure is real. The opportunity is singular.
            If you are a woman aged 18–30, ready to be forged in fire — step forward.
          </p>

          <div className="mt-10 mx-auto max-w-2xl rounded-3xl border border-[#F5C16C]/20 bg-[#050A30]/70 p-6 text-left shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-xl">
            <p className="text-xs font-bold tracking-[0.28em] uppercase text-[#F5C16C]">Audition Payment</p>
            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold text-white/80">You’ll pay a one-time audition signup fee of</p>
                <p className="mt-1 text-4xl font-black text-white">₦{auditionFee.toLocaleString()}</p>
              </div>
              <div className="max-w-sm md:text-right">
                <p className="text-xs font-bold tracking-[0.18em] uppercase text-white/50">Includes</p>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  payment verification, audition record creation, and confirmation email delivery.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                "Secure your audition slot",
                "Create a paid signup record",
                "Receive payment confirmation",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80">
                  {item}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-6 text-white/45">
              {pricingLoading
                ? "Loading live payment details..."
                : pricingError
                  ? pricingError
                  : "The fee is collected before your audition signup is reviewed and enrolled."}
            </p>
          </div>

          <div className="mt-10 flex flex-col items-center gap-4">
            <RegisterCTA label="CLAIM YOUR PLACE" className="text-base px-10 py-5" />
            {paymentError && (
              <p className="text-sm text-red-300 max-w-md text-center">{paymentError}</p>
            )}
            {emailDeliveryNotice && (
              <p className="text-sm text-[#F5C16C] max-w-xl text-center leading-6">
                {emailDeliveryNotice}
              </p>
            )}
            {pendingPaymentId && !paid && (
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="text-sm font-semibold text-[#F5C16C] underline underline-offset-2"
              >
                {verifying ? "Verifying..." : "I have completed payment — verify now"}
              </button>
            )}
            {paid && (
              <p className="text-sm text-emerald-300 mt-2">
                Your audition slot is confirmed. We will be in touch.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── SECTION 7: FOOTER ───────────────────────────────────── */}
      <footer className="border-t border-white/8 py-12 px-6 text-center">
        <p className="text-sm font-bold tracking-[0.25em] uppercase text-white/50">AFROVISION CHALLENGE</p>
        <p className="mt-3 text-xs text-white/30">
          © 2026 AfroVision Challenge — The Amazons Edition. All rights reserved.
        </p>
        <p className="mt-1 text-xs text-white/30">
          Building Africa&apos;s next generation of elite women leaders.
        </p>
      </footer>

    </main>
  );
}
