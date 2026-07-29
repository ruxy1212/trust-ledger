import type { Metadata } from "next";
import { Syne, JetBrains_Mono } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ClientWalletProvider } from "@/lib/wallet-provider";
import { Nav } from "@/components/Nav";
import "./globals.css";

// globals.css's `@theme inline` block expects these four CSS variables:
// --font-geist-sans, --font-geist-mono, --font-syne, --font-jetbrains.
const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["600", "700", "800"],
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "Trust Ledger",
  description: "Milestone escrow and portable reputation for freelance work, on Solana.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${syne.variable} ${jetbrainsMono.variable}`}>
      <body>
        <ClientWalletProvider>
          <Nav />
          <main className="mx-auto max-w-(--container-max) px-6 py-10">
            {children}
          </main>
        </ClientWalletProvider>
      </body>
    </html>
  );
}
