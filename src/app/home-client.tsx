"use client";
// ============================================================================
// monday-AI — página principal
// ============================================================================
// Optimizaciones de performance:
// 1. Los modales pesados (AgentBuilder, Orchestrator, AutomationCenter,
//    MondayImport) se cargan con next/dynamic + solo se montan cuando su
//    flag `open` es true. Antes estaban siempre en el DOM aunque cerrados.
// 2. Los overlays usan `LazyMount` para destruirse cuando se cierran,
//    liberando memoria y listeners.
// 3. BoardView se monta solo cuando sidebarView === "boards" (antes siempre
//    se importaba aunque estuviera en otra vista).
import { useEffect, useState, lazy, Suspense } from "react";
import { Sidebar } from "@/components/monday/sidebar";
import { Header } from "@/components/monday/header";
import { BoardView } from "@/components/monday/board-view";
import { ItemDetailDrawer } from "@/components/monday/item-detail-drawer";
import { CommandPalette } from "@/components/monday/command-palette";
import {
  HomeView,
  MyWorkView,
  TeamView,
  DocsView,
  DashboardsView,
} from "@/components/monday/sidebar-views";
import { ActivityLogView } from "@/components/monday/activity-log-view";
import { useToastActions } from "@/hooks/use-toast-actions";
import { useAppStore } from "@/lib/store";
import { AddBoardDialog, AddColumnDialog, AddViewDialog } from "@/components/monday/board-modals";
import { MondayConnectDialog } from "@/components/monday/monday-connect-dialog";
import { SidekickChat, SidekickButton } from "@/components/monday/sidekick-chat";
import { ExportImportDialog } from "@/components/monday/export-import-dialog";
import { useAgentTriggers } from "@/hooks/use-agent-triggers";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { ShortcutsDialog } from "@/components/monday/shortcuts-dialog";

// Lazy load de modales pesados — solo se cargan cuando se abren por primera vez
const AgentBuilder = lazy(() =>
  import("@/components/monday/agent-builder").then((m) => ({ default: m.AgentBuilder }))
);
const OrchestratorVisualizer = lazy(() =>
  import("@/components/monday/orchestrator-visualizer").then((m) => ({ default: m.OrchestratorVisualizer }))
);
const AutomationCenter = lazy(() =>
  import("@/components/monday/automation-center").then((m) => ({ default: m.AutomationCenter }))
);
const MondayImportDialog = lazy(() =>
  import("@/components/monday/monday-import-dialog").then((m) => ({ default: m.MondayImportDialog }))
);
const SettingsDialog = lazy(() =>
  import("@/components/monday/settings-dialog").then((m) => ({ default: m.SettingsDialog }))
);

/** Wrapper que solo monta el children cuando `open` es true.
 *  Esto evita que componentes pesados (modales con tabs, forms, etc.)
 *  estén en el DOM cuando están cerrados. */
function LazyMount({
  open,
  children,
  fallback = null,
}: {
  open: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  // Pequeño delay al desmontar para que la animación de cierre termine
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
    } else {
      const t = setTimeout(() => setMounted(false), 250);
      return () => clearTimeout(t);
    }
  }, [open]);
  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}

/** Placeholder simple para suspenses */
function ModalSkeleton() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-12 h-12 rounded-full border-4 border-[#0072E5] border-t-transparent animate-spin" />
    </div>
  );
}

export default function Home() {
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const sidebarView = useAppStore((s) => s.sidebarView);
  const activeBoardId = useAppStore((s) => s.activeBoardId);
  const setSidebarView = useAppStore((s) => s.setSidebarView);
  const showMondayConnect = useAppStore((s) => s.showMondayConnect);
  const setShowMondayConnect = useAppStore((s) => s.setShowMondayConnect);
  const showMondayImport = useAppStore((s) => s.showMondayImport);
  const setShowMondayImport = useAppStore((s) => s.setShowMondayImport);
  const showAgentBuilder = useAppStore((s) => s.showAgentBuilder);
  const showOrchestrator = useAppStore((s) => s.showOrchestrator);
  const showAutomations = useAppStore((s) => s.showAutomations);
  const showAddBoard = useAppStore((s) => s.showAddBoard);
  const showAddColumn = useAppStore((s) => s.showAddColumn);
  const showAddView = useAppStore((s) => s.showAddView);
  const showExportImport = useAppStore((s) => s.showExportImport);
  const setShowExportImport = useAppStore((s) => s.setShowExportImport);
  const showSettings = useAppStore((s) => s.showSettings);

  // Activar triggers automáticos de agentes (auto-fill + item_created + column_change)
  useAgentTriggers();
  // Activar toasts de confirmación para todas las acciones
  useToastActions();
  // Activar atajos de teclado globales
  const { showShortcuts, setShowShortcuts } = useKeyboardShortcuts();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setCommandPaletteOpen]);

  // Renderiza la vista según sidebarView seleccionado
  const renderMain = () => {
    if (sidebarView === "home") return <HomeView />;
    if (sidebarView === "my_work") return <MyWorkView />;
    if (sidebarView === "team") return <TeamView />;
    if (sidebarView === "docs") return <DocsView />;
    if (sidebarView === "dashboards") return <DashboardsView />;
    if (sidebarView === "activity") return <ActivityLogView />;
    if (!activeBoardId) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-background text-muted-foreground gap-3">
          <div className="text-3xl">📋</div>
          <div className="text-sm">Selecciona un board del sidebar</div>
          <button
            onClick={() => useAppStore.getState().setShowAddBoard(true)}
            className="text-xs text-[#0072E5] hover:underline"
          >
            o crea uno nuevo →
          </button>
        </div>
      );
    }
    return <BoardView />;
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Show "back to boards" button when in non-board view */}
          {sidebarView !== "boards" && (
            <button
              onClick={() => setSidebarView("boards")}
              className="text-[11px] text-muted-foreground hover:text-foreground px-4 py-1.5 border-b border-border bg-card text-left"
            >
              ← Volver a boards
            </button>
          )}
          {renderMain()}
        </div>
      </div>

      {/* Overlays — solo se montan cuando su flag `open` es true */}
      <ItemDetailDrawer />

      <LazyMount open={showAgentBuilder}>
        <Suspense fallback={<ModalSkeleton />}>
          <AgentBuilder />
        </Suspense>
      </LazyMount>

      <LazyMount open={showOrchestrator}>
        <Suspense fallback={<ModalSkeleton />}>
          <OrchestratorVisualizer />
        </Suspense>
      </LazyMount>

      <CommandPalette />

      <LazyMount open={showAutomations}>
        <Suspense fallback={<ModalSkeleton />}>
          <AutomationCenter />
        </Suspense>
      </LazyMount>

      <AddBoardDialog />
      <AddColumnDialog />
      <AddViewDialog />

      <ExportImportDialog
        open={showExportImport}
        onOpenChange={setShowExportImport}
      />

      <MondayConnectDialog
        open={showMondayConnect}
        onOpenChange={setShowMondayConnect}
        onConnected={() => setShowMondayImport(true)}
      />

      <LazyMount open={showMondayImport}>
        <Suspense fallback={<ModalSkeleton />}>
          <MondayImportDialog
            open={showMondayImport}
            onOpenChange={setShowMondayImport}
          />
        </Suspense>
      </LazyMount>

      <SidekickChat />
      <SidekickButton />

      <LazyMount open={showSettings}>
        <Suspense fallback={<ModalSkeleton />}>
          <SettingsDialog />
        </Suspense>
      </LazyMount>

      <ShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} />
    </div>
  );
}
