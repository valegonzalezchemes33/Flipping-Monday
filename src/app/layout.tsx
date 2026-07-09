import type { Metadata } from "next";
import { Figtree, Poppins, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

// Figtree = body font de Monday.com (Vibe design system)
const figtree = Figtree({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

// Poppins = heading font de Monday.com
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
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
        className={`${figtree.variable} ${poppins.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground`}
        style={{ fontFamily: "var(--font-inter), Figtree, ui-sans-serif, system-ui, sans-serif" }}
      >
        {children}
        <Toaster />
        <Sonner />
      </body>
    </html>
  );
}
