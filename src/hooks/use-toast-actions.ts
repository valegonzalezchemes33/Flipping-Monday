"use client";
// ============================================================================
// useToastActions — toasts automáticos para acciones del store
// ============================================================================
// FIX: antes era un no-op. Ahora subscribimos a cambios de activities
// y emitimos toasts cuando detectamos nuevas entradas.
import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";

export function useToastActions() {
  const lastActivityCountRef = useRef(0);

  useEffect(() => {
    // Inicializar con el count actual (no tostar al montar)
    lastActivityCountRef.current = useAppStore.getState().activities.length;

    const unsubscribe = useAppStore.subscribe((state) => {
      const currentCount = state.activities.length;
      if (currentCount > lastActivityCountRef.current) {
        const newCount = currentCount - lastActivityCountRef.current;
        const newActivities = state.activities.slice(0, newCount);
        for (const act of newActivities) {
          showToastForActivity(act.type, act.data);
        }
      }
      lastActivityCountRef.current = currentCount;
    });

    return () => unsubscribe();
  }, []);
}

function showToastForActivity(type: string, data: any) {
  switch (type) {
    case "item_created":
      toast.success("Tarea creada", {
        description: data?.name ? `"${data.name}"` : undefined,
      });
      break;
    case "update_posted":
      toast.success("Update publicado");
      break;
    case "item_archived":
      toast.success("Tarea archivada");
      break;
  }
}
