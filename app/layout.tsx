import type { Metadata } from "next";
import { Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { SpeedInsights } from "@vercel/speed-insights/next";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Creative Audit — Ad Intelligence Platform",
  description:
    "Analyze and audit ad creatives from YouTube, TikTok, Meta, and brand websites in one unified dashboard.",
  keywords: ["ad creative", "creative audit", "YouTube ads", "TikTok ads", "brand analysis"],
  icons: {
    icon: [
      { url: "/favicon/favicon.ico",        sizes: "any" },
      { url: "/favicon/favicon-16x16.png",  sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png",  sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/favicon/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "icon", url: "/favicon/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { rel: "icon", url: "/favicon/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Creative Audit — Ad Intelligence Platform",
    description:
      "Analyze and audit ad creatives from YouTube, TikTok, Meta, and brand websites.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} ${geistMono.variable}`}>
        <Providers>
          <Sidebar />
          <Header />
          <main
            style={{
              marginLeft: "var(--sidebar-width)",
              paddingTop: "var(--header-height)",
              minHeight: "100vh",
              background: "var(--color-bg)",
              transition: "background var(--transition-base)",
            }}
          >
            {children}
          </main>
          <SpeedInsights />
        </Providers>
      </body>
    </html>
  );
}
