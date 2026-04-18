import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CommunityPoolBar } from "@/components/CommunityPoolBar";
import { MarqueeTicker } from "@/components/MarqueeTicker";
import { KycAlertBanner } from "@/components/KycAlertBanner";
import { AuthProvider } from "@/lib/AuthContext";
import { getBranding } from "@/lib/homepage";

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" href={branding.favicon_url || "/favicon.png"} />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <Navbar logoUrl={branding.logo_url} />
          <div className="h-16 lg:h-20" />
          <MarqueeTicker />
          <CommunityPoolBar />
          <KycAlertBanner />
          <main className="flex-1">{children}</main>
          <Footer logoUrl={branding.logo_url} />
        </AuthProvider>
      </body>
    </html>
  );
}
