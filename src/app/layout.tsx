import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ShortSplit — YouTube Video Splitter into Portrait Shorts",
  description:
    "Paste a YouTube link and instantly split it into mobile-ready 9:16 portrait clips. Preview segments, tweak cut points, and copy share links — all in your browser, no downloads.",
  keywords: [
    "YouTube splitter",
    "video splitter",
    "portrait clips",
    "9:16 shorts",
    "YouTube to shorts",
    "clip maker",
  ],
  authors: [{ name: "ShortSplit" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "ShortSplit — YouTube to Portrait Shorts",
    description:
      "Split any YouTube video into mobile-ready 9:16 clips, right in your browser.",
    siteName: "ShortSplit",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ShortSplit — YouTube to Portrait Shorts",
    description:
      "Split any YouTube video into mobile-ready 9:16 clips, right in your browser.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
