"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback, type MouseEvent, type ReactNode } from "react";

interface NavLinkProps {
  href: string;
  className?: string;
  children: ReactNode;
  /** Replace the first child (icon slot) with a spinner while navigating */
  spinnerClassName?: string;
  /** Use replace instead of push */
  replace?: boolean;
  /** Scroll to top on navigate (default true) */
  scroll?: boolean;
  /** For anchor links (#id), skip router and scroll natively */
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}

export function NavLink({
  href,
  className,
  children,
  spinnerClassName = "w-4 h-4",
  replace = false,
  scroll = true,
  onClick,
}: NavLinkProps) {
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);

  const handleClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      if (onClick) {
        onClick(e);
        if (e.defaultPrevented) return;
      }

      // External links or anchor links — let browser handle
      if (href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) {
        return;
      }

      // Modifier keys — let browser handle (new tab, etc.)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      e.preventDefault();
      setNavigating(true);

      if (replace) {
        router.replace(href, { scroll });
      } else {
        router.push(href, { scroll });
      }

      // Reset after a reasonable time in case navigation doesn't unmount this component
      const timer = setTimeout(() => setNavigating(false), 5000);
      return () => clearTimeout(timer);
    },
    [href, onClick, replace, router, scroll],
  );

  return (
    <a
      href={href}
      onClick={handleClick}
      className={className}
      aria-busy={navigating || undefined}
    >
      {navigating ? (
        <>
          <span
            className={`inline-block rounded-full border-2 border-current border-t-transparent animate-spin ${spinnerClassName}`}
          />
          {typeof children === "string" ? children : getTextChildren(children)}
        </>
      ) : (
        children
      )}
    </a>
  );
}

/** Extract text nodes from children for spinner state display */
function getTextChildren(children: ReactNode): ReactNode {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) {
    return children.filter((c) => typeof c === "string" || (typeof c === "object" && c !== null && "props" in c && typeof c.props?.children === "string"));
  }
  return children;
}
