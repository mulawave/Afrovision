"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { resolveWebsiteMediaUrl } from "@/lib/media";
import Link from "next/link";

interface PromoModalData {
  enabled: boolean;
  image_url: string;
  title: string;
  subtitle: string;
  body_text: string;
  button_text: string;
  button_link: string;
  open_in_new_tab: boolean;
}

const SESSION_KEY = "av_promo_modal_dismissed";

export function PromoModal() {
  const [data, setData] = useState<PromoModalData | null>(null);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY)) {
      return;
    }

    async function load() {
      try {
        const res = await api<{ promo_modal: PromoModalData | null }>("/promo-modal");
        if (res.ok && res.data?.promo_modal?.enabled) {
          setData(res.data.promo_modal);
          setTimeout(() => {
            setAnimating(true);
            setVisible(true);
          }, 600);
        }
      } catch {
        // Silently fail — promo modal is optional
      }
    }

    load();
  }, []);

  const dismiss = useCallback(() => {
    setAnimating(false);
    setTimeout(() => {
      setVisible(false);
      setData(null);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(SESSION_KEY, "1");
      }
    }, 350);
  }, []);

  if (!visible || !data) return null;

  const imgUrl = resolveWebsiteMediaUrl(data.image_url);
  const isExternal = data.button_link?.startsWith("http");

  const ctaClasses =
    "inline-block rounded-full bg-gradient-to-r from-av-orange to-av-light-orange px-10 py-3.5 text-sm font-bold text-av-dark-blue shadow-[0_8px_24px_rgba(244,150,23,0.3)] transition-all hover:shadow-[0_14px_36px_rgba(244,150,23,0.4)] hover:scale-[1.03]";

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-350 ${
        animating ? "bg-black/75 backdrop-blur-sm" : "bg-black/0 backdrop-blur-0"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div
        className={`relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-av-dark-blue shadow-[0_32px_80px_rgba(0,0,0,0.7)] transition-all duration-350 ${
          animating
            ? "scale-100 opacity-100 translate-y-0"
            : "scale-95 opacity-0 translate-y-6"
        }`}
      >
        {/* Close button — bold & always visible */}
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/30 bg-av-dark-blue/90 text-white shadow-lg backdrop-blur-md transition-all hover:border-av-orange hover:bg-av-dark-blue hover:text-av-orange hover:scale-110"
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* Two-column layout: Image | Content */}
        <div className="flex flex-col md:flex-row">
          {/* Image column — full display, no cropping */}
          {imgUrl && (
            <div className="relative flex-shrink-0 md:w-[45%] bg-gradient-to-br from-[#0a1245] to-av-dark-blue">
              <img
                src={imgUrl}
                alt={data.title || "Promotion"}
                className="h-full w-full object-cover md:min-h-[360px]"
              />
              {/* Subtle right-edge blend on desktop, bottom blend on mobile */}
              <div className="hidden md:block absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-av-dark-blue to-transparent" />
              <div className="block md:hidden absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-av-dark-blue to-transparent" />
            </div>
          )}

          {/* Content column */}
          <div className="flex flex-1 flex-col justify-center px-8 py-8 md:px-10 md:py-10">
            {data.title && (
              <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                {data.title}
              </h2>
            )}
            {data.subtitle && (
              <p className="mt-2 text-base font-semibold text-av-light-orange">
                {data.subtitle}
              </p>
            )}
            {data.body_text && (
              <p className="mt-4 text-sm md:text-base leading-relaxed text-white/70">
                {data.body_text}
              </p>
            )}

            {/* CTA button */}
            {data.button_text && data.button_link && (
              <div className="mt-8">
                {isExternal || data.open_in_new_tab ? (
                  <a
                    href={data.button_link}
                    target={data.open_in_new_tab ? "_blank" : "_self"}
                    rel={data.open_in_new_tab ? "noopener noreferrer" : undefined}
                    onClick={dismiss}
                    className={ctaClasses}
                  >
                    {data.button_text}
                  </a>
                ) : (
                  <Link
                    href={data.button_link}
                    onClick={dismiss}
                    className={ctaClasses}
                  >
                    {data.button_text}
                  </Link>
                )}
              </div>
            )}

            {/* Dismiss link — clearly visible */}
            <button
              onClick={dismiss}
              className="mt-5 self-start text-sm text-white/50 underline underline-offset-2 decoration-white/20 hover:text-white/80 hover:decoration-white/50 transition-colors"
            >
              No thanks, continue browsing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
