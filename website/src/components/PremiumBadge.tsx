import type { StoredUser } from "@/lib/api";

interface PremiumBadgeProps {
  user: Pick<StoredUser, "subscription_status" | "subscription_plan">;
  /** "sm" = compact inline pill; "md" = standard; "lg" = hero badge with label */
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Gold premium subscriber badge.
 * Renders only when the user has an active subscription plan.
 * Matches the "VIP / premium" visual language on the mobile app.
 */
export function PremiumBadge({ user, size = "md", className = "" }: PremiumBadgeProps) {
  const isActive =
    user.subscription_status === "active" && Boolean(user.subscription_plan);

  if (!isActive) return null;

  if (size === "sm") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-2 py-0.5 ${className}`}
        title="Premium subscriber"
      >
        <CrownIcon className="h-2.5 w-2.5 text-av-dark-blue" />
        <span className="text-[9px] font-extrabold uppercase tracking-wider text-av-dark-blue">
          Premium
        </span>
      </span>
    );
  }

  if (size === "lg") {
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-4 py-1.5 shadow-lg shadow-av-orange/30 ${className}`}
        title="Premium subscriber"
      >
        <CrownIcon className="h-4 w-4 text-av-dark-blue" />
        <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-av-dark-blue">
          Premium Member
        </span>
      </span>
    );
  }

  // "md" default
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-2.5 py-0.5 ${className}`}
      title="Premium subscriber"
    >
      <CrownIcon className="h-3 w-3 text-av-dark-blue" />
      <span className="text-[10px] font-extrabold uppercase tracking-wider text-av-dark-blue">
        Premium
      </span>
    </span>
  );
}

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M2 19h20v2H2zm2-9 4 4 4-8 4 8 4-4v8H4v-8zm16-2-4 4V6l4-1v3zm-12 0L4 5v3l4 1V8z" />
      <path d="M12 3l3.09 6.26L22 10.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 15.14 2 10.27 8.91 9.26 12 3z" />
    </svg>
  );
}
