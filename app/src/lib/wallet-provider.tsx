"use client";

// @solana/web3.js reaches for the Node `Buffer` global even in the browser.
// Next.js no longer auto-polyfills Node core globals, so without this you'll
// hit "Buffer is not defined" the moment a wallet tries to sign anything.
import { Buffer } from "buffer";
if (typeof window !== "undefined" && !window.Buffer) {
  window.Buffer = Buffer;
}

import { useMemo, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";

export function ClientWalletProvider({ children }: { children: ReactNode }) {
  // No explicit adapter list: Phantom, Solflare, Backpack, etc. all register
  // themselves via the Wallet Standard and show up automatically.
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
