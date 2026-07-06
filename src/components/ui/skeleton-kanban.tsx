"use client";
// ============================================================================
// SkeletonKanban — esqueleto animado para la vista Kanban
// ============================================================================
import { cn } from "@/lib/utils";

const SHIMMER = "animate-pulse bg-secondary/60 rounded";

export function SkeletonKanban() {
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
        <div className={cn(SHIMMER, "h-7 w-24")} />
        <div className={cn(SHIMMER, "h-7 w-36")} />
        <div className="flex-1" />
        <div className={cn(SHIMMER, "h-5 w-20")} />
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="flex gap-3 h-full">
          {[1, 2, 3, 4].map((col) => (
            <div
              key={col}
              className="w-72 shrink-0 bg-secondary/20 rounded-lg flex flex-col"
            >
              <div className="flex items-center gap-2 px-3 py-3 border-b border-border/50">
                <div className={cn(SHIMMER, "h-2.5 w-2.5 rounded-full")} />
                <div className={cn(SHIMMER, "h-3 w-16")} />
                <div className={cn(SHIMMER, "h-4 w-6 rounded-full ml-auto")} />
              </div>
              <div className="flex-1 p-2 space-y-2">
                {[1, 2, 3].map((card) => (
                  <div
                    key={card}
                    className="bg-card rounded-lg border border-border p-3 space-y-2"
                  >
                    <div className={cn(SHIMMER, "h-3 w-full")} />
                    <div className={cn(SHIMMER, "h-3 w-3/4")} />
                    <div className="flex items-center justify-between mt-2">
                      <div className={cn(SHIMMER, "h-3 w-12")} />
                      <div className={cn(SHIMMER, "h-5 w-5 rounded-full")} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
