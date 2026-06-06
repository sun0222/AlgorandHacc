import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PackRoute Agent | EU F&B Packaging Procurement",
  description: "Autonomous procurement agent with x402 on Algorand",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
