"use client";
// ============================================================================
// FilesView — vista galería de todos los archivos adjuntos del board
// ============================================================================
import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Paperclip,
  Download,
  Trash2,
  FileText,
  Image as ImageIcon,
  Archive,
  FileSpreadsheet,
} from "lucide-react";

const FILE_ICONS: Record<string, React.ReactNode> = {
  "image/": <ImageIcon className="h-8 w-8 text-[#A25BFF]" />,
  "application/pdf": <FileText className="h-8 w-8 text-[#E2445C]" />,
  "application/vnd.openxmlformats-officedocument": <FileSpreadsheet className="h-8 w-8 text-[#00C875]" />,
  "application/zip": <Archive className="h-8 w-8 text-[#FFC700]" />,
};

function getFileIcon(mime: string): React.ReactNode {
  for (const [prefix, icon] of Object.entries(FILE_ICONS)) {
    if (mime.startsWith(prefix)) return icon;
  }
  return <Paperclip className="h-8 w-8 text-muted-foreground" />;
}

const fmtSize = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

export function FilesView() {
  const board = useAppStore((s) => s.boards.find((b) => b.id === s.activeBoardId));
  const allFiles = useAppStore((s) => s.files);
  const users = useAppStore((s) => s.users);
  const deleteFile = useAppStore((s) => s.deleteFile);
  const selectItem = useAppStore((s) => s.selectItem);
  const setActiveBoard = useAppStore((s) => s.setActiveBoard);

  if (!board) return null;

  // Files belonging to items in this board
  const boardFileIds = new Set(board.items.map((i) => i.id));
  const files = useMemo(
    () => allFiles.filter((f) => boardFileIds.has(f.itemId)),
    [allFiles, boardFileIds]
  );

  if (files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background p-8">
        <div className="text-center">
          <Paperclip className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <div className="text-sm font-medium mb-1">Sin archivos adjuntos</div>
          <p className="text-xs text-muted-foreground">
            Este board no tiene archivos. Sube archivos desde el detalle de un item.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <h2 className="text-lg font-bold">Archivos</h2>
          <p className="text-sm text-muted-foreground">
            {files.length} archivo{files.length !== 1 ? "s" : ""} en {board.name}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {files.map((f) => {
            const uploader = users.find((u) => u.id === f.uploadedById);
            const parentItem = board.items.find((i) => i.id === f.itemId);

            return (
              <Card
                key={f.id}
                className="p-3 hover:shadow-md transition group cursor-pointer"
                onClick={() => {
                  if (parentItem) {
                    setActiveBoard(board.id);
                    selectItem(parentItem.id);
                  }
                }}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-full aspect-square rounded-lg bg-secondary/50 flex items-center justify-center">
                    {getFileIcon(f.mime)}
                  </div>
                  <div className="w-full text-center min-w-0">
                    <div className="text-xs font-medium truncate">{f.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {fmtSize(f.size)}
                    </div>
                    {parentItem && (
                      <div className="text-[10px] text-[#0072E5] truncate mt-0.5">
                        {parentItem.name}
                      </div>
                    )}
                    <div className="text-[9px] text-muted-foreground mt-0.5">
                      {uploader?.name ?? "—"} ·{" "}
                      {formatDistanceToNow(new Date(f.createdAt), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-1 right-1 h-6 w-6 p-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-[#E2445C]"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteFile(f.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
