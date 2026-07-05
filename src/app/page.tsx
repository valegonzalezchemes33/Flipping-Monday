"use client";
// ============================================================================
// monday-AI — página principal (wrapper client-side)
// ============================================================================
// OPTIMIZACIÓN CRÍTICA: Esta página hace dynamic import del contenido real
// con ssr: false. Esto evita que el SSR importe TODOS los componentes pesados
// (Sidebar, Header, BoardView, store con seed data, etc.) que causaban OOM
// kill en el sandbox de 4GB.
//
// El SSR solo devuelve un HTML mínimo con un splash, y el cliente carga todo
// dinámicamente después.
import dynamic from "next/dynamic";

const HomeClient = dynamic(() => import("./home-client").then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: "linear-gradient(135deg, #0072E5, #A25BFF)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          boxShadow: "0 4px 12px rgba(0,114,229,0.3)",
          marginBottom: 16,
        }}
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
      <div style={{ fontSize: 14, fontWeight: 600, color: "#666" }}>monday-AI</div>
    </div>
  ),
});

export default function Home() {
  return <HomeClient />;
}
