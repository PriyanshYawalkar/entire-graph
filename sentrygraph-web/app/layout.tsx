import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SentryGraph | Security blast radius",
  description: "Checkpoint-aware graph security review for Entire Graph.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
