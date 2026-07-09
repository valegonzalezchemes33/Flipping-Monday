"use client";
// ============================================================================
// ExcelImportDialog — subir archivo Excel de Monday.com e importarlo
// ============================================================================
import { useState, useRef } from "react";
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
import { cn } from "@/lib/utils";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Boxes,
  List,
  Columns3,
  GitBranch,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ExcelImportDialog({ open, onOpenChange }: Props) {
  const mergeImportedData = useAppStore((s) => s.mergeImportedData);
  const setActiveBoard = useAppStore((s) => s.setActiveBoard);

  const [step, setStep] = useState<"select" | "uploading" | "done">("select");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = (v: boolean) => {
    if (!v) {
      setStep("select");
      setError(null);
      setSummary(null);
    }
    onOpenChange(v);
  };

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.xlsx?$/i)) {
      setError("El archivo debe ser .xlsx o .xls");
      setStep("done");
      return;
    }

    setStep("uploading");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/excel/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!data.ok) {
        setError(data.error || "Error al procesar el Excel");
        setStep("done");
        return;
      }

      // Fusionar el board en el store
      mergeImportedData({ boards: [data.board] });
      setSummary(data.summary);
      setStep("done");
    } catch (e: any) {
      setError(e?.message ?? "Error de red al subir el archivo");
      setStep("done");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-[#00C875]" />
            Importar desde Excel de Monday
          </DialogTitle>
          <DialogDescription className="text-xs">
            Sube un archivo Excel exportado desde Monday.com. Se crearán boards,
            grupos, items y columnas idénticos a los del Excel.
          </DialogDescription>
        </DialogHeader>

        {/* STEP: select */}
        {step === "select" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition",
              dragOver
                ? "border-[#00C875] bg-[#00C875]/5"
                : "border-border hover:border-[#00C875]/40 hover:bg-[#00C875]/5"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileInput}
              className="hidden"
            />
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <div className="text-sm font-medium mb-1">
              Arrastra tu Excel aquí
            </div>
            <div className="text-xs text-muted-foreground">
              o click para seleccionar · .xlsx o .xls
            </div>
            <div className="mt-4 text-[10px] text-muted-foreground/70 max-w-xs mx-auto">
              Exporta desde Monday: abre tu board → botón kebab (⋮) →
              "Export to Excel"
            </div>
          </div>
        )}

        {/* STEP: uploading */}
        {step === "uploading" && (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#00C875] mb-3" />
            <div className="text-sm font-medium">Procesando Excel…</div>
            <div className="text-xs text-muted-foreground mt-1">
              Parseando columnas, grupos e items
            </div>
          </div>
        )}

        {/* STEP: done */}
        {step === "done" && (
          <div className="py-6 flex flex-col items-center justify-center text-center">
            {error ? (
              <>
                <div className="w-14 h-14 rounded-full bg-[#E2445C]/15 flex items-center justify-center mb-3">
                  <AlertCircle className="h-7 w-7 text-[#E2445C]" />
                </div>
                <div className="text-sm font-semibold mb-1">Error al importar</div>
                <div className="text-xs text-muted-foreground max-w-md text-center">
                  {error}
                </div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-[#00C875]/15 flex items-center justify-center mb-3">
                  <CheckCircle2 className="h-7 w-7 text-[#00C875]" />
                </div>
                <div className="text-sm font-semibold mb-1">
                  ¡Excel importado correctamente!
                </div>
                <div className="text-xs text-muted-foreground mb-4">
                  Board «{summary?.boardName}» creado en tu workspace
                </div>
                {summary && (
                  <div className="grid grid-cols-4 gap-2 w-full max-w-sm">
                    <div className="bg-secondary/40 rounded p-2 text-center">
                      <Boxes className="h-4 w-4 mx-auto text-[#0072E5] mb-1" />
                      <div className="text-base font-bold">{summary.groups}</div>
                      <div className="text-[9px] text-muted-foreground uppercase font-semibold">
                        Grupos
                      </div>
                    </div>
                    <div className="bg-secondary/40 rounded p-2 text-center">
                      <List className="h-4 w-4 mx-auto text-[#00C875] mb-1" />
                      <div className="text-base font-bold">{summary.items}</div>
                      <div className="text-[9px] text-muted-foreground uppercase font-semibold">
                        Items
                      </div>
                    </div>
                    <div className="bg-secondary/40 rounded p-2 text-center">
                      <Columns3 className="h-4 w-4 mx-auto text-[#A25BFF] mb-1" />
                      <div className="text-base font-bold">{summary.columns}</div>
                      <div className="text-[9px] text-muted-foreground uppercase font-semibold">
                        Columnas
                      </div>
                    </div>
                    <div className="bg-secondary/40 rounded p-2 text-center">
                      <GitBranch className="h-4 w-4 mx-auto text-[#FF642E] mb-1" />
                      <div className="text-base font-bold">{summary.subitems}</div>
                      <div className="text-[9px] text-muted-foreground uppercase font-semibold">
                        Subitems
                      </div>
                    </div>
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground mt-4 max-w-md text-center">
                  ✅ El board está en tu sidebar dentro de{" "}
                  <strong className="text-[#0072E5]">"Importados de Monday"</strong>.
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "select" && (
            <Button variant="ghost" size="sm" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
          )}
          {step === "done" && (
            <Button
              size="sm"
              className="bg-[#00C875] hover:bg-[#00A85F] text-white"
              onClick={() => {
                if (!error && summary) {
                  const state = useAppStore.getState();
                  const importedBoard = state.boards.find((b) =>
                    b.id.startsWith("excel-b-")
                  );
                  if (importedBoard) {
                    state.setActiveBoard(importedBoard.id);
                    state.setSidebarView("boards");
                  }
                }
                handleClose(false);
              }}
            >
              <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
              {error ? "Cerrar" : "Ver board importado"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
