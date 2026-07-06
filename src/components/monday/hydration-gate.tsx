"use client";
// ============================================================================
// HydrationGate — splash inicial mientras el store se hidrata desde localStorage
// ============================================================================
// Problema: zustand/persist arranca con el estado seed (mock data) y luego,
// cuando termina de leer localStorage, lo reemplaza por el estado real del
// usuario. Esto causaba un "flash" donde se veían los datos seed por un instante.
// Solución: hasta que `_hasHydrated` sea true, mostramos un splash neutro que
// no revela ningún dato, así el usuario solo ve el estado final.
//
// OPTIMIZACIÓN DE MEMORIA: NO renderizamos {children} hasta que el store
// esté hidratado. Antes renderizabamos children con opacity-0, lo que hacía
// que el SSR ejecutara TODO el árbol de componentes (Sidebar, Header, BoardView
// con todos los items seed) → OOM kill en el sandbox de 4GB. Ahora el SSR
// solo renderiza el splash, y los children se montan en el cliente después.
import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";

export function HydrationGate({ children }: { children: React.ReactNode }) {
  const hasHydrated = useAppStore((s) => s._hasHydrated);
  // mounted asegura que solo rendericemos children en el cliente (no en SSR)
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Marcar como mounted inmediatamente en el cliente
    setMounted(true);
    // Disparar la hidratación manualmente (skipHydration: true en el store
    // evita que zustand lo haga automáticamente en SSR)
    // Usar la API pública de Zustand persist
    try {
      const persistApi = useAppStore.persist;
      if (persistApi && typeof persistApi.rehydrate === "function") {
        const result = persistApi.rehydrate();
        if (result && typeof result.then === "function") {
          result
            .then(() => useAppStore.getState().setHasHydrated(true))
            .catch(() => useAppStore.getState().setHasHydrated(true));
        } else {
          useAppStore.getState().setHasHydrated(true);
        }
      } else {
        useAppStore.getState().setHasHydrated(true);
      }
    } catch {
      useAppStore.getState().setHasHydrated(true);
    }
  }, []);

  // En SSR o antes de montar: solo splash
  if (!mounted) {
    return <Splash />;
  }

  // Cliente montado pero store sin hidratar: splash
  if (!hasHydrated) {
    return <Splash />;
  }

  // Store hidratado: renderizar children
  return <>{children}</>;
}

function Splash() {
  return (
    <>
      <div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background"
        aria-hidden
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0072E5] to-[#A25BFF] flex items-center justify-center text-white shadow-lg"
            style={{ animation: "pulse-soft 1.4s ease-in-out infinite" }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
            </svg>
          </div>
          <div className="text-sm font-semibold text-foreground/80 tracking-tight">
            monday-AI
          </div>
          <div className="flex gap-1.5 mt-1">
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#0072E5]"
              style={{ animation: "bounce-dot 1s ease-in-out infinite", animationDelay: "0ms" }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#0072E5]"
              style={{ animation: "bounce-dot 1s ease-in-out infinite", animationDelay: "150ms" }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#0072E5]"
              style={{ animation: "bounce-dot 1s ease-in-out infinite", animationDelay: "300ms" }}
            />
          </div>
        </div>
      </div>
      <style>{`
        @keyframes pulse-soft {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.92); opacity: 0.85; }
        }
        @keyframes bounce-dot {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </>
  );
}
