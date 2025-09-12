import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ReactQueryProvider } from "@/components/providers/ReactQueryProvider";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ReownProvider } from "@/components/providers/ReownProvider"; // ✅ ajouté
import Header from "@/components/ui/Header";
import { Analytics } from "@vercel/analytics/react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CryptoPilot",
  description: "Gérez votre portefeuille crypto avec intelligence",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-neutral-900`}
      >
        <SessionProvider>
          <ReownProvider>
            <Header />
            <ReactQueryProvider>
              <main className="pt-16 md:pt-20 bg-neutral-50 min-h-dvh">
                {children}
              </main>
            </ReactQueryProvider>
          </ReownProvider>
        </SessionProvider>
        <Analytics />
      </body>
    </html>
  );
}
