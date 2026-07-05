"use client";
// ============================================================================
// MondayImportDialog — selecciona boards e impórtalos con progreso en vivo
// ============================================================================
import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  Database,
  Users,
  Boxes,
  FileSpreadsheet,
  ArrowRight,
} from "lucide-react";

interface MondayBoardListItem {
  id: string;
  name: string;
  description: string;
  board_kind: string;
  items_count: number;
  workspace_id?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function MondayImportDialog({ open, onOpenChange }: Props) {
  const mondayApiKey = useAppStore((s) => s.mondayApiKey);
  const mondayAccount = useAppStore((s) => s.mondayAccount);
  const mergeImportedData = useAppStore((s) => s.mergeImportedData);
  const importState = useAppStore((s) => s.importState);
  const setImportState = useAppStore((s) => s.setImportState);
  const pushImportLog = useAppStore((s) => s.pushImportLog);
  const resetImportState = useAppStore((s) => s.resetImportState);
  const setActiveBoard = useAppStore((s) => s.setActiveBoard);

  const [step, setStep] = useState<"select" | "loading-boards" | "importing" | "done">(
    "select"
  );
  const [boards, setBoards] = useState<MondayBoardListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<any>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Cargar lista de boards cuando se abre
  useEffect(() => {
    if (open && mondayApiKey) {
      setStep("loading-boards");
      setBoards([]);
      setSelectedIds(new Set());
      setImportError(null);
      (async () => {
        try {
          const res = await fetch("/api/monday/boards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiKey: mondayApiKey }),
          });
          const data = await res.json();
          if (data.ok && Array.isArray(data.boards)) {
            setBoards(data.boards);
            // Pre-seleccionar todos por defecto
            setSelectedIds(new Set(data.boards.map((b: any) => b.id)));
          } else {
            setImportError(data.error || "Error al cargar boards");
          }
        } catch (e: any) {
          setImportError(e?.message ?? "Error de red");
        } finally {
          setStep("select");
        }
      })();
    }
  }, [open, mondayApiKey]);

  // Reset al cerrar
  const handleClose = (v: boolean) => {
    if (!v) {
      abortRef.current?.abort();
      resetImportState();
      setStep("select");
      setBoards([]);
      setSelectedIds(new Set());
      setImportError(null);
      setImportSummary(null);
    }
    onOpenChange(v);
  };

  const toggleBoard = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === boards.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(boards.map((b) => b.id)));
    }
  };

  const handleImport = async () => {
    if (selectedIds.size === 0 || !mondayApiKey) return;

    setStep("importing");
    setImportError(null);
    setImportSummary(null);
    resetImportState();
    setImportState({
      active: true,
      currentStep: "init",
      message: "Iniciando importación…",
      total: selectedIds.size,
      current: 0,
    });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/monday/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: mondayApiKey,
          boardIds: Array.from(selectedIds),
          importUsers: true,
          importTeams: true,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const evtBlock of events) {
          const lines = evtBlock.split("\n");
          let evt = "message";
          let data = "";
          for (const ln of lines) {
            if (ln.startsWith("event:")) evt = ln.slice(6).trim();
            else if (ln.startsWith("data:")) data += ln.slice(5).trim();
          }
          try {
            const p = JSON.parse(data);
            handleSSEEvent(evt, p);
          } catch {
            /* ignore */
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setImportError(e?.message ?? "Error durante la importación");
        pushImportLog("error", e?.message ?? "Error durante la importación");
      }
    } finally {
      setStep("done");
      setImportState({ active: false });
    }
  };

  const handleSSEEvent = (event: string, data: any) => {
    switch (event) {
      case "start":
        pushImportLog("info", `Importación iniciada · ${data.totalBoards} boards`);
        break;
      case "step":
        setImportState({
          currentStep: data.step,
          message: data.message,
          current: data.current ?? importState.current,
          total: data.total ?? importState.total,
        });
        pushImportLog("step", data.message);
        break;
      case "progress":
        pushImportLog(
          "progress",
          `${data.step}: ${data.count} elementos obtenidos`
        );
        break;
      case "board-imported":
        pushImportLog(
          "success",
          `Board «${data.boardName}» importado: ${data.itemsCount} items, ${data.columnsCount} columnas`
        );
        setImportState({
          current: data.current,
          total: data.total,
        });
        break;
      case "board-error":
        pushImportLog("error", `Board ${data.boardId}: ${data.message}`);
        break;
      case "warn":
        pushImportLog("warn", data.message);
        break;
      case "done":
        setImportSummary(data.summary);
        pushImportLog(
          "success",
          `Importación completada · ${data.summary.boards} boards, ${data.summary.totalItems} items, ${data.summary.users} users`
        );
        // Fusionar datos en el store
        if (data.payload) {
          mergeImportedData(data.payload);
          // Si hay boards importados, seleccionar el primero
          if (data.payload.boards && data.payload.boards.length > 0) {
            setActiveBoard(data.payload.boards[0].id);
          }
        }
        break;
      case "error":
        setImportError(data.message);
        pushImportLog("error", data.message);
        break;
    }
  };

  const totalItems = boards.reduce((a, b) => a + (b.items_count ?? 0), 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4 text-[#0072E5]" />
            Importar datos de Monday.com
          </DialogTitle>
          <DialogDescription className="text-xs">
            {mondayAccount && (
              <>
                Conectado como{" "}
                <span className="font-medium text-foreground">
                  {mondayAccount.name}
                </span>{" "}
                · {mondayAccount.email}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* STEP: loading boards */}
        {step === "loading-boards" && (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#0072E5] mb-3" />
            <div className="text-sm font-medium">Cargando boards de Monday…</div>
            <div className="text-xs text-muted-foreground mt-1">
              Consultando tu cuenta
            </div>
          </div>
        )}

        {/* STEP: select boards */}
        {step === "select" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {importError && (
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-[#E2445C]/8 border border-[#E2445C]/30 text-[11px] text-[#E2445C] mb-3">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <div>{importError}</div>
              </div>
            )}

            {boards.length > 0 && (
              <>
                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-secondary/40 rounded-md p-2.5 text-center">
                    <Boxes className="h-4 w-4 mx-auto text-[#0072E5] mb-1" />
                    <div className="text-lg font-bold">{boards.length}</div>
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Boards
                    </div>
                  </div>
                  <div className="bg-secondary/40 rounded-md p-2.5 text-center">
                    <FileSpreadsheet className="h-4 w-4 mx-auto text-[#00C875] mb-1" />
                    <div className="text-lg font-bold">{totalItems}</div>
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Items totales
                    </div>
                  </div>
                  <div className="bg-secondary/40 rounded-md p-2.5 text-center">
                    <Database className="h-4 w-4 mx-auto text-[#A25BFF] mb-1" />
                    <div className="text-lg font-bold">{selectedIds.size}</div>
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Seleccionados
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Selecciona boards
                  </span>
                  <button
                    onClick={handleSelectAll}
                    className="text-[11px] text-[#0072E5] hover:underline font-medium"
                  >
                    {selectedIds.size === boards.length
                      ? "Deseleccionar todos"
                      : "Seleccionar todos"}
                  </button>
                </div>

                <ScrollArea className="flex-1 max-h-[360px] -mx-1 px-1">
                  <div className="space-y-1">
                    {boards.map((b) => (
                      <label
                        key={b.id}
                        className={cn(
                          "flex items-start gap-2.5 p-2.5 rounded-md border cursor-pointer transition",
                          selectedIds.has(b.id)
                            ? "border-[#0072E5] bg-[#0072E5]/5"
                            : "border-border hover:border-[#0072E5]/30 hover:bg-secondary/30"
                        )}
                      >
                        <Checkbox
                          checked={selectedIds.has(b.id)}
                          onCheckedChange={() => toggleBoard(b.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {b.name}
                          </div>
                          {b.description && (
                            <div className="text-[11px] text-muted-foreground truncate">
                              {b.description}
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge
                              variant="outline"
                              className="text-[9px] h-4 capitalize"
                            >
                              {b.board_kind}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {b.items_count} items
                            </span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}

            {boards.length === 0 && !importError && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No se encontraron boards en tu cuenta
              </div>
            )}
          </div>
        )}

        {/* STEP: importing */}
        {step === "importing" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Progress bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-foreground">
                  {importState.message || "Importando…"}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {importState.current} / {importState.total}
                </span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#0072E5] to-[#00C875] transition-all"
                  style={{
                    width: `${
                      importState.total > 0
                        ? (importState.current / importState.total) * 100
                        : 5
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Log en tiempo real */}
            <div className="flex-1 bg-card border border-border rounded-md overflow-hidden flex flex-col">
              <div className="px-3 py-1.5 border-b border-border bg-secondary/30 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Log de importación
              </div>
              <ScrollArea className="flex-1 max-h-[300px]">
                <div className="p-2 space-y-0.5 font-mono text-[11px]">
                  {importState.log.length === 0 && (
                    <div className="text-muted-foreground italic px-1 py-2">
                      Esperando eventos…
                    </div>
                  )}
                  {importState.log.map((entry, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex items-start gap-2 px-1 py-0.5 rounded",
                        entry.type === "error" && "text-[#E2445C]",
                        entry.type === "success" && "text-[#00C875]",
                        entry.type === "warn" && "text-[#FFC700]",
                        entry.type === "step" && "text-foreground",
                        (entry.type === "info" || entry.type === "progress") &&
                          "text-muted-foreground"
                      )}
                    >
                      <span className="text-muted-foreground/60 shrink-0">
                        [{entry.ts}]
                      </span>
                      <span className="flex-1">{entry.message}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        {/* STEP: done */}
        {step === "done" && (
          <div className="flex-1 flex flex-col items-center justify-center py-8">
            {importError ? (
              <>
                <div className="w-14 h-14 rounded-full bg-[#E2445C]/15 flex items-center justify-center mb-3">
                  <AlertCircle className="h-7 w-7 text-[#E2445C]" />
                </div>
                <div className="text-sm font-semibold mb-1">
                  Importación con errores
                </div>
                <div className="text-xs text-muted-foreground max-w-md text-center">
                  {importError}
                </div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-[#00C875]/15 flex items-center justify-center mb-3">
                  <CheckCircle2 className="h-7 w-7 text-[#00C875]" />
                </div>
                <div className="text-sm font-semibold mb-1">
                  ¡Importación completada!
                </div>
                {importSummary && (
                  <div className="grid grid-cols-2 gap-2 mt-3 w-full max-w-md">
                    <div className="bg-secondary/40 rounded p-2.5 text-center">
                      <Boxes className="h-4 w-4 mx-auto text-[#0072E5] mb-1" />
                      <div className="text-lg font-bold">
                        {importSummary.boards}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Boards
                      </div>
                    </div>
                    <div className="bg-secondary/40 rounded p-2.5 text-center">
                      <FileSpreadsheet className="h-4 w-4 mx-auto text-[#00C875] mb-1" />
                      <div className="text-lg font-bold">
                        {importSummary.totalItems}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Items
                      </div>
                    </div>
                    <div className="bg-secondary/40 rounded p-2.5 text-center">
                      <Users className="h-4 w-4 mx-auto text-[#FF642E] mb-1" />
                      <div className="text-lg font-bold">
                        {importSummary.users}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Users
                      </div>
                    </div>
                    <div className="bg-secondary/40 rounded p-2.5 text-center">
                      <Database className="h-4 w-4 mx-auto text-[#A25BFF] mb-1" />
                      <div className="text-lg font-bold">
                        {importSummary.workspaces}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Workspaces
                      </div>
                    </div>
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground mt-4 max-w-md text-center">
                  Los datos importados ya están disponibles en tu sidebar. Los
                  boards de Monday aparecen con prefijo "m-b-".
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "select" && (
            <>
              <Button variant="ghost" size="sm" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="bg-[#0072E5] hover:bg-[#0058B5] text-white"
                onClick={handleImport}
                disabled={selectedIds.size === 0}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Importar {selectedIds.size} board{selectedIds.size !== 1 ? "s" : ""}
              </Button>
            </>
          )}

          {step === "importing" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                abortRef.current?.abort();
                handleClose(false);
              }}
            >
              Cancelar importación
            </Button>
          )}

          {step === "done" && (
            <Button
              size="sm"
              className="bg-[#0072E5] hover:bg-[#0058B5] text-white"
              onClick={() => handleClose(false)}
            >
              <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
              Ver datos importados
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
