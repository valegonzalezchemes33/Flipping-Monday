"use client";
// ============================================================================
// monday-AI — página principal
// ============================================================================
import { useEffect } from "react";
import { Sidebar } from "@/components/monday/sidebar";
import { Header } from "@/components/monday/header";
import { BoardView } from "@/components/monday/board-view";
import { ItemDetailDrawer } from "@/components/monday/item-detail-drawer";
import { AgentBuilder } from "@/components/monday/agent-builder";
import { OrchestratorVisualizer } from "@/components/monday/orchestrator-visualizer";
import { CommandPalette } from "@/components/monday/command-palette";
import { AutomationCenter } from "@/components/monday/automation-center";
import {
  HomeView,
  TeamView,
  DocsView,
  DashboardsView,
} from "@/components/monday/sidebar-views";
import { useToastActions } from "@/hooks/use-toast-actions";
import { useAppStore } from "@/lib/store";
import { AddBoardDialog, AddColumnDialog, AddViewDialog } from "@/components/monday/board-modals";
import { MondayConnectDialog } from "@/components/monday/monday-connect-dialog";
import { MondayImportDialog } from "@/components/monday/monday-import-dialog";
import { SidekickChat, SidekickButton } from "@/components/monday/sidekick-chat";
import { useAgentTriggers } from "@/hooks/use-agent-triggers";
import { useAIAutomations } from "@/hooks/use-ai-automations";
import { ExportImportDialog } from "@/components/monday/export-import-dialog";

export default function Home() {
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const sidebarView = useAppStore((s) => s.sidebarView);
  const activeBoardId = useAppStore((s) => s.activeBoardId);
  const setSidebarView = useAppStore((s) => s.setSidebarView);
  const showMondayConnect = useAppStore((s) => s.showMondayConnect);
  const setShowMondayConnect = useAppStore((s) => s.setShowMondayConnect);
  const showMondayImport = useAppStore((s) => s.showMondayImport);
  const setShowMondayImport = useAppStore((s) => s.setShowMondayImport);

  // Activar triggers automáticos de agentes (auto-fill + item_created + column_change)
  useAgentTriggers();
  // Activar AI Automations (recetas trigger → AI Block → action)
  useAIAutomations();
  // Activar toasts de confirmación para todas las acciones
  useToastActions();

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
    if (sidebarView === "team") return <TeamView />;
    if (sidebarView === "docs") return <DocsView />;
    if (sidebarView === "dashboards") return <DashboardsView />;
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

      {/* Overlays */}
      <ItemDetailDrawer />
      <AgentBuilder />
      <OrchestratorVisualizer />
      <CommandPalette />
      <AutomationCenter />
      <AddBoardDialog />
      <AddColumnDialog />
      <AddViewDialog />
      <ExportImportDialog
        open={useAppStore((s) => s.showExportImport)}
        onOpenChange={useAppStore((s) => s.setShowExportImport)}
      />
      <MondayConnectDialog
        open={showMondayConnect}
        onOpenChange={setShowMondayConnect}
        onConnected={() => setShowMondayImport(true)}
      />
      <MondayImportDialog
        open={showMondayImport}
        onOpenChange={setShowMondayImport}
      />
      <SidekickChat />
      <SidekickButton />
    </div>
  );
}
