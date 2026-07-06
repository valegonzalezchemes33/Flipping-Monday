import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { HydrationGate } from "@/components/monday/hydration-gate";
import { ErrorBoundary } from "@/components/ui/error-boundary";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "monday-AI — Clone con Agentes IA",
  description:
    "Plataforma de gestión de trabajo estilo Monday.com con agentes IA nativos, orquestador central y compatibilidad 1:1.",
  keywords: ["Monday", "AI agents", "Orchestrator", "Next.js", "Workflow"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground`}
      >
        <ErrorBoundary>
          <HydrationGate>{children}</HydrationGate>
          <Toaster />
          <Sonner />
        </ErrorBoundary>
      </body>
    </html>
  );
}
