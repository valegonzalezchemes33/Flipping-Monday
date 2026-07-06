"use client";
// ============================================================================
// SkeletonTable — esqueleto animado para la vista de tabla principal
// ============================================================================
import { cn } from "@/lib/utils";

const SHIMMER = "animate-pulse bg-secondary/60 rounded";

export function SkeletonTable() {
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar skeleton */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <div className={cn(SHIMMER, "h-7 w-16")} />
        <div className={cn(SHIMMER, "h-7 w-16")} />
        <div className={cn(SHIMMER, "h-7 w-16")} />
        <div className={cn(SHIMMER, "h-7 w-16")} />
        <div className="flex-1" />
        <div className={cn(SHIMMER, "h-7 w-24")} />
      </div>

      {/* Column headers */}
      <div className="flex items-stretch border-b border-border">
        <div className="w-8 border-r border-border" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="px-3 py-2.5 border-r border-border"
            style={{ width: i === 1 ? 340 : 140 }}
          >
            <div className={cn(SHIMMER, "h-3 w-16")} />
          </div>
        ))}
      </div>

      {/* Group headers + rows */}
      {[1, 2, 3].map((g) => (
        <div key={g} className="border-b border-border">
          <div className="flex items-center gap-2 px-3 py-2 bg-secondary/20">
            <div className={cn(SHIMMER, "h-3 w-3")} />
            <div className={cn(SHIMMER, "h-3 w-20")} />
            <div className={cn(SHIMMER, "h-3 w-6")} />
          </div>
          {[1, 2, 3].map((r) => (
            <div key={r} className="flex items-stretch border-b border-border">
              <div className="w-8 border-r border-border flex items-center justify-center">
                <div className={cn(SHIMMER, "h-3 w-3")} />
              </div>
              {[1, 2, 3, 4, 5].map((c) => (
                <div
                  key={c}
                  className="px-3 py-2.5 border-r border-border"
                  style={{ width: c === 1 ? 340 : 140 }}
                >
                  <div
                    className={cn(
                      SHIMMER,
                      c === 1 ? "h-3 w-32" : "h-3 w-16"
                    )}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
