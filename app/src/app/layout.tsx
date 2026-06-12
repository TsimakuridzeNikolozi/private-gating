import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Private Gating",
  description: "Privacy-preserving access engine on Solana.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
