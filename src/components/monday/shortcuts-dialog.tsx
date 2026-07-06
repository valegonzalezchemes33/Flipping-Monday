"use client";
// ============================================================================
// ShortcutsDialog — panel de atajos de teclado (presionar '?' o ⌘/)
// ============================================================================
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string; label: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Navegación",
    shortcuts: [
      { keys: "⌘K", label: "Abrir Command Palette" },
      { keys: "Esc", label: "Cerrar panel / modal" },
      { keys: "⌘⇧I", label: "Abrir/cerrar Sidekick IA" },
    ],
  },
  {
    title: "Creación",
    shortcuts: [
      { keys: "⌘N", label: "Nuevo item en board actual" },
      { keys: "⌘⇧N", label: "Nuevo board" },
    ],
  },
  {
    title: "Acciones",
    shortcuts: [
      { keys: "⌘E", label: "Exportar / Importar JSON" },
      { keys: "⌘S", label: "Abrir configuración (Settings)" },
      { keys: "⌘Z", label: "Deshacer última acción" },
      { keys: "⌘⇧Z", label: "Rehacer acción" },
    ],
  },
  {
    title: "Ayuda",
    shortcuts: [
      { keys: "?", label: "Mostrar este panel de atajos" },
    ],
  },
];

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Atajos de teclado</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h4 className="text-[11px] uppercase font-bold text-muted-foreground/70 tracking-wider mb-2">
                {group.title}
              </h4>
              <div className="space-y-1.5">
                {group.shortcuts.map((sc) => (
                  <div
                    key={sc.keys}
                    className="flex items-center justify-between gap-4 px-2 py-1.5 rounded-md hover:bg-secondary/50 transition"
                  >
                    <span className="text-xs text-foreground">{sc.label}</span>
                    <kbd className="text-[10px] font-mono bg-secondary px-2 py-0.5 rounded border border-border shrink-0">
                      {sc.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-muted-foreground/60 text-center pt-2 border-t border-border">
          Presiona <kbd className="text-[10px] font-mono bg-secondary px-1 py-0.5 rounded border border-border">?</kbd> en cualquier momento para abrir este panel
        </div>
      </DialogContent>
    </Dialog>
  );
}
