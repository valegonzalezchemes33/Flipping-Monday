"use client";
// ============================================================================
// useKeyboardShortcuts — atajos globales de teclado tipo Monday
// ⌘N → nuevo item · ⌘⇧N → nuevo board · ⌘E → export · ⌘S → settings
// ⌘⇧I → sidekick · Esc → cerrar drawer/modales · ⌘K → command palette
// ? → mostrar atajos de teclado
// ============================================================================
import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { getUndoHistory } from "@/lib/undo-middleware";
import { toast } from "sonner";

export function useKeyboardShortcuts(): { showShortcuts: boolean; setShowShortcuts: (v: boolean) => void } {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const activeBoardId = useAppStore((s) => s.activeBoardId);
  const selectedItemId = useAppStore((s) => s.selectedItemId);
  const showSidekick = useAppStore((s) => s.showSidekick);
  const showSettings = useAppStore((s) => s.showSettings);
  const commandPaletteOpen = useAppStore((s) => s.commandPaletteOpen);
  const showAgentBuilder = useAppStore((s) => s.showAgentBuilder);
  const showOrchestrator = useAppStore((s) => s.showOrchestrator);
  const showAutomations = useAppStore((s) => s.showAutomations);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const shift = e.shiftKey;

      // ⌘K — Command Palette (ya existe, no interceptar)
      // ⌘N — Nuevo item en board activo
      if (meta && !shift && e.key === "n") {
        e.preventDefault();
        const board = useAppStore.getState().boards.find((b) => b.id === activeBoardId);
        if (board) {
          useAppStore.getState().addItem(board.id, board.groups[0]?.id ?? "", "Nuevo item");
        }
      }

      // ⌘⇧N — Nuevo board
      if (meta && shift && e.key === "n") {
        e.preventDefault();
        useAppStore.getState().setShowAddBoard(true);
      }

      // ⌘E — Export/Import
      if (meta && !shift && e.key === "e") {
        e.preventDefault();
        useAppStore.getState().setShowExportImport(!useAppStore.getState().showExportImport);
      }

      // ⌘S — Settings (solo si no estamos en un input editando)
      if (meta && !shift && e.key === "s") {
        const el = document.activeElement;
        const tag = el?.tagName;
        const isEditable = (el instanceof HTMLElement && el.isContentEditable) || false;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || isEditable) return;
        e.preventDefault();
        useAppStore.getState().setShowSettings(!useAppStore.getState().showSettings);
      }

      // ⌘⇧I — Sidekick
      if (meta && shift && e.key === "i") {
        e.preventDefault();
        useAppStore.getState().setShowSidekick(!useAppStore.getState().showSidekick);
      }

      // ⌘Z — Undo (deshacer última mutación, solo fuera de inputs)
      if (meta && !shift && e.key === "z") {
        const el = document.activeElement;
        const tag = el?.tagName;
        const isEditable = (el instanceof HTMLElement && el.isContentEditable) || false;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || isEditable) return;
        const state = useAppStore.getState();
        if (state.undo && getUndoHistory(state).past.length > 0) {
          e.preventDefault();
          state.undo();
          toast.success("Deshecho", { duration: 1500 });
        }
      }

      // ⌘⇧Z — Redo (rehacer, solo fuera de inputs)
      if (meta && shift && e.key === "z") {
        const el = document.activeElement;
        const tag = el?.tagName;
        const isEditable = (el instanceof HTMLElement && el.isContentEditable) || false;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || isEditable) return;
        const state = useAppStore.getState();
        if (state.redo && getUndoHistory(state).future.length > 0) {
          e.preventDefault();
          state.redo();
          toast.success("Rehecho", { duration: 1500 });
        }
      }

      // Escape — cerrar panel/modal abierto
      if (e.key === "Escape") {
        const state = useAppStore.getState();

        if (state.selectedItemId) {
          e.preventDefault();
          state.selectItem(null);
          return;
        }
        if (state.commandPaletteOpen) {
          e.preventDefault();
          state.setCommandPaletteOpen(false);
          return;
        }
        if (state.showSidekick) {
          e.preventDefault();
          state.setShowSidekick(false);
          return;
        }
        if (state.showSettings) {
          e.preventDefault();
          state.setShowSettings(false);
          return;
        }
        if (state.showAgentBuilder) {
          e.preventDefault();
          state.setShowAgentBuilder(false);
          return;
        }
        if (state.showOrchestrator) {
          e.preventDefault();
          state.setShowOrchestrator(false);
          return;
        }
        if (state.showAutomations) {
          e.preventDefault();
          state.setShowAutomations(false);
          return;
        }
        if (state.showExportImport) {
          e.preventDefault();
          state.setShowExportImport(false);
          return;
        }
        if (state.showAddBoard) {
          e.preventDefault();
          state.setShowAddBoard(false);
          return;
        }
        if (state.showAddColumn) {
          e.preventDefault();
          state.setShowAddColumn(false);
          return;
        }
      }

      // '?' — mostrar atajos de teclado (solo si no estamos en un input)
      if (e.key === "?" && !meta && !shift) {
        const el = document.activeElement;
        const tag = el?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        setShowShortcuts(true);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeBoardId, selectedItemId, showSidekick, showSettings, commandPaletteOpen, showAgentBuilder, showOrchestrator, showAutomations]);

  return { showShortcuts, setShowShortcuts };
}
