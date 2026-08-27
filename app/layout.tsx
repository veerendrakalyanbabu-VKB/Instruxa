import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Instruxa — Prompt Engineering Workspace",
  description: "Compile intent into production-grade prompts across every major AI model.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
