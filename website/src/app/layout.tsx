export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CommunityPoolBar } from "@/components/CommunityPoolBar";
import { MarqueeTicker } from "@/components/MarqueeTicker";
import { KycAlertBanner } from "@/components/KycAlertBanner";
import { DevApiIndicator } from "@/components/DevApiIndicator";
import { AuthProvider } from "@/lib/AuthContext";
import { getBranding } from "@/lib/homepage";
import { CookieConsentProvider } from "@/lib/cookie-consent/CookieConsentProvider";
import { CookieBanner } from "@/components/CookieBanner";
import { GoogleAdSenseConsent } from "@/lib/cookie-consent/GoogleAdSenseConsent";

const geistSans = localFont({
  src: "../fonts/GeistVF.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "../fonts/GeistMonoVF.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "AfroVision — Watch. Earn. Connect.",
  description:
    "Africa's premier live streaming platform. Discover creators, watch live shows, earn rewards, and connect with a vibrant community.",
  keywords: [
    "AfroVision",
    "live streaming",
    "African creators",
    "watch and earn",
    "live TV",
    "entertainment",
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const branding = await getBranding();

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" href={branding.favicon_url || "/favicon.png"} />
        <meta name="facebook-domain-verification" content="wgwu99f86bmhug9lgwu51c0v1723zo" />
        {/* Meta Pixel Code */}
        <script
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1284541427082889');
fbq('track', 'PageView');`,
          }}
        />
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            alt=""
            src="https://www.facebook.com/tr?id=1284541427082889&ev=PageView&noscript=1"
          />
        </noscript>
        {/* End Meta Pixel Code */}
      </head>
      <body className="min-h-full flex flex-col">
        <CookieConsentProvider>
          <AuthProvider>
            <GoogleAdSenseConsent />
            <Navbar logoUrl={branding.logo_url} />
            <div className="h-16 lg:h-20" />
            <MarqueeTicker />
            <CommunityPoolBar />
            <KycAlertBanner />
            <main className="flex-1">{children}</main>
            <Footer logoUrl={branding.logo_url} />
            <DevApiIndicator />
            <CookieBanner />
          </AuthProvider>
        </CookieConsentProvider>
      </body>
    </html>
  );
}
