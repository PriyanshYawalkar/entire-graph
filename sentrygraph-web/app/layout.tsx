import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SentryGraph | Evidence for every security change",
  description: "Checkpoint-aware blast-radius reviews powered by Entire Graph.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
