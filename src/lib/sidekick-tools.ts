// ============================================================================
// Tool definitions para el Sidekick — lo que el agente puede hacer en el sistema
// ============================================================================
// Las tools se envían al LLM (Groq/Z.ai) y se ejecutan en el cliente contra
// el store de Zustand. El agente recibe los resultados y puede continuar.

import type { GroqTool } from "./groq-client";
import { executeAIBlock } from "./ai-blocks";

export interface ToolExecutionContext {
  // Snapshot read-only del estado — el ejecutor en cliente pasa esto
  getState: () => any;
  // API key de Groq (para AI Blocks que llaman al LLM)
  groqApiKey?: string | null;
  // Acciones que mutan el store
  actions: {
    addItem: (boardId: string, groupId: string, name: string, columnValues?: any) => string;
    updateItemName: (itemId: string, name: string) => void;
    updateColumnValue: (itemId: string, columnId: string, value: any) => void;
    deleteItem: (itemId: string) => void;
    moveItem: (itemId: string, toGroupId: string) => void;
    addGroup: (boardId: string, title: string) => void;
    setActiveBoard: (boardId: string) => void;
    selectItem: (itemId: string | null) => void;
    setSidebarView: (v: string) => void;
    addUpdate: (itemId: string, body: string) => void;
    pushNotification: (n: any) => void;
    addSubitem: (parentId: string, name: string) => void;
    addBoard: (workspaceId: string, name: string) => string;
    addWorkspace: (name: string) => string;
    renameBoard: (boardId: string, name: string) => void;
    deleteBoard: (boardId: string) => void;
    duplicateBoard: (boardId: string) => string;
    addColumn: (boardId: string, col: { title: string; type: string }) => void;
    deleteColumn: (boardId: string, columnId: string) => void;
    renameGroup: (boardId: string, groupId: string, title: string) => void;
    deleteGroup: (boardId: string, groupId: string) => void;
    duplicateItem: (itemId: string) => void;
    archiveItem: (itemId: string) => void;
    addFile: (file: { itemId: string; name: string; size: number; mime: string; content?: string }) => void;
  };
  // Archivos adjuntos por el usuario (para que el agente los lea)
  attachedFiles?: { name: string; size: number; mime: string; content: string }[];
  // Prompt del usuario actual — se usa para darle contexto al VLM
  userPrompt?: string;
}

// ----------------------------------------------------------------------------
// Definición de tools (formato OpenAI/Groq function calling)
// ----------------------------------------------------------------------------
export const SIDEKICK_TOOLS: GroqTool[] = [
  {
    type: "function",
    function: {
      name: "list_boards",
      description:
        "Lista todos los boards disponibles en el workspace con su ID, nombre, número de items y columnas. Úsalo cuando el usuario pregunta qué boards tiene o quiere navegar.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_active_board",
      description:
        "Obtiene el board actualmente activo: columns, groups, items con sus valores. Úsalo cuando el usuario pregunta por el board actual o quiere ver items.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_item",
      description:
        "Obtiene un item específico por ID, con todos sus columnValues, subitems y updates. Úsalo cuando el usuario pregunta por un item concreto o quiere ver su detalle.",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string", description: "ID del item" },
        },
        required: ["itemId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_items",
      description:
        "Busca items por texto en el nombre o en valores de columnas. Devuelve coincidencias con su board, grupo y valores principales. Úsalo para 'find items where...', 'search for...'.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Texto a buscar" },
          boardId: {
            type: "string",
            description: "Opcional: limitar búsqueda a un board",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_item",
      description:
        "Crea uno o más items nuevos en un board y grupo específicos. Úsalo cuando el usuario dice 'create item...', 'add a task...', o lista varias cosas a agregar.",
      parameters: {
        type: "object",
        properties: {
          boardId: { type: "string", description: "ID del board" },
          groupId: {
            type: "string",
            description: "ID del grupo. Si se omite, usa el primer grupo.",
          },
          name: { type: "string", description: "Nombre del item" },
        },
        required: ["boardId", "name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_items_batch",
      description:
        "Crea múltiples items de una sola vez en el mismo board y grupo. Úsalo cuando el usuario lista varias tareas a crear.",
      parameters: {
        type: "object",
        properties: {
          boardId: { type: "string" },
          groupId: { type: "string" },
          names: {
            type: "array",
            items: { type: "string" },
            description: "Lista de nombres de items a crear",
          },
        },
        required: ["boardId", "names"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_column_value",
      description:
        "Actualiza el valor de una columna de un item. Úsalo para cambiar estado, prioridad, fecha, etc. El 'value' depende del tipo de columna: status → {labelId: '0'}, people → {userIds: ['u1']}, date → {date: '2024-01-15'}, text → {text: '...'}, checkbox → {checked: true}.",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string" },
          columnId: { type: "string" },
          value: {
            type: "object",
            description: "Estructura del valor según el tipo de columna",
          },
        },
        required: ["itemId", "columnId", "value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "move_item",
      description:
        "Mueve un item a otro grupo dentro del mismo board. Úsalo cuando el usuario dice 'move item to...', 'change group...'.",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string" },
          toGroupId: { type: "string" },
        },
        required: ["itemId", "toGroupId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_item",
      description: "Elimina un item del board. Úsalo cuando el usuario confirma que quiere borrar.",
      parameters: {
        type: "object",
        properties: { itemId: { type: "string" } },
        required: ["itemId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_update",
      description:
        "Publica un comentario/update en un item. Úsalo cuando el usuario dice 'add a comment to...', 'note on this item...'.",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string" },
          body: { type: "string", description: "Contenido del update" },
        },
        required: ["itemId", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_group",
      description: "Crea un nuevo grupo en un board. Úsalo cuando el usuario pide añadir una sección/columna kanban nueva.",
      parameters: {
        type: "object",
        properties: {
          boardId: { type: "string" },
          title: { type: "string" },
        },
        required: ["boardId", "title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate_to_board",
      description:
        "Navega a un board específico (lo activa en la UI). Úsalo cuando el usuario dice 'open board X', 'go to board...'.",
      parameters: {
        type: "object",
        properties: { boardId: { type: "string" } },
        required: ["boardId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_item",
      description:
        "Abre el detalle de un item en el drawer lateral. Úsalo cuando el usuario quiere ver el detalle de un item.",
      parameters: {
        type: "object",
        properties: { itemId: { type: "string" } },
        required: ["itemId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "summarize_board",
      description:
        "Genera un resumen del board actual: total items, distribución por estado, items destacados, deadlines próximos, items atascados. Úsalo para 'summarize this board', 'give me an overview'.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "find_at_risk_items",
      description:
        "Encuentra items en riesgo: deadlines próximos (<7 días) sin completar, items atascados (Stuck), items sin asignar. Úsalo para 'what's at risk', 'show me problems'.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  // ===== AI BLOCK TOOLS (funciones agenticas de Monday) =====
  {
    type: "function",
    function: {
      name: "ai_summarize",
      description:
        "Resume el texto de un item o de todos sus updates. Úsalo cuando el usuario pide 'resume este item', 'dame un resumen de lo que pasó'.",
      parameters: {
        type: "object",
        properties: { itemId: { type: "string" } },
        required: ["itemId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ai_categorize",
      description:
        "Categoriza un item en una de las categorías disponibles usando IA. Úsalo para 'categoriza este item', 'asigna una categoría'.",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string" },
          columnName: { type: "string", description: "Nombre de la columna status/priority donde asignar" },
        },
        required: ["itemId", "columnName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ai_detect_sentiment",
      description:
        "Analiza el sentimiento de los updates de un item (positive/negative/neutral). Úsalo para 'cómo se siente el equipo sobre este item'.",
      parameters: {
        type: "object",
        properties: { itemId: { type: "string" } },
        required: ["itemId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ai_suggest_actions",
      description:
        "Sugiere 3 acciones concretas para un item basándose en su contenido y estado. Úsalo para 'qué deberíamos hacer con este item'.",
      parameters: {
        type: "object",
        properties: { itemId: { type: "string" } },
        required: ["itemId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ai_prioritize",
      description:
        "Calcula la prioridad (1-5) de un item basándose en su contenido, deadlines y estado. Úsalo para 'prioriza este item'.",
      parameters: {
        type: "object",
        properties: { itemId: { type: "string" } },
        required: ["itemId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ai_translate_item",
      description:
        "Traduce el nombre y descripción de un item al idioma especificado. Úsalo para 'traduce este item al inglés'.",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string" },
          targetLanguage: { type: "string", description: "ej: english, spanish, french" },
        },
        required: ["itemId", "targetLanguage"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ai_improve_update",
      description:
        "Mejora el texto de un update publicando una versión corregida y más profesional. Úsalo para 'mejora este update'.",
      parameters: {
        type: "object",
        properties: { updateId: { type: "string" } },
        required: ["updateId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ai_generate_subitems",
      description:
        "Genera subitems sugeridos por IA para un item (ej: desglosar una tarea en subtareas). Úsalo para 'descompón este item en subtareas'.",
      parameters: {
        type: "object",
        properties: { itemId: { type: "string" } },
        required: ["itemId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ai_board_insights",
      description:
        "Genera insights del board activo: distribución de estados, items destacados, blockers, tendencias. Úsalo para 'dame insights del board', 'analiza este board'.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "ai_detect_duplicates",
      description:
        "Detecta items duplicados en el board activo comparando nombres y contenido. Úsalo para 'hay items duplicados?'.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "ai_generate_report",
      description:
        "Genera un reporte ejecutivo del board activo (estado general, progreso, riesgos, próximos pasos). Úsalo para 'genera un reporte', 'dame un resumen ejecutivo'.",
      parameters: {
        type: "object",
        properties: {
          format: { type: "string", description: "brief o detailed" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ai_draft_email",
      description:
        "Redacta un email basado en el contexto de un item (ej: notificar a cliente, recordar deadline). Úsalo para 'redacta un email sobre este item'.",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string" },
          recipient: { type: "string", description: "ej: cliente, equipo, manager" },
          purpose: { type: "string", description: "ej: notificar, recordar, actualizar" },
        },
        required: ["itemId", "purpose"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ai_extract_action_items",
      description:
        "Extrae action items de los updates de un item (qué tareas concretas se mencionan). Úsalo para 'qué acciones se mencionan en los updates'.",
      parameters: {
        type: "object",
        properties: { itemId: { type: "string" } },
        required: ["itemId"],
      },
    },
  },
  // ===== FILE TOOLS — leer y guardar archivos adjuntos =====
  {
    type: "function",
    function: {
      name: "read_attached_files",
      description:
        "Lee el contenido de los archivos que el usuario ha adjuntado al chat. Soporta imágenes (PNG/JPG/GIF/WebP) usando un modelo de visión (VLM), Excel (.xlsx/.xls) extrayendo todas las hojas como tablas, Word (.docx) extrayendo el texto del documento, PDF extrayendo el texto, CSV como texto, y archivos de texto plano (.txt/.json/.md/código). Úsalo SIEMPRE que el usuario sube un archivo y pide que lo leas, analices, describas o extraigas información — incluso si es un Excel o Word. NO digas que no puedes leer archivos: esta tool SÍ puede interpretarlos todos.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "save_file_to_item",
      description:
        "Guarda un archivo adjunto del chat en un item del board. Úsalo cuando el usuario dice 'guarda este archivo en el item', 'adjunta este archivo'.",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string" },
          fileName: { type: "string", description: "Nombre del archivo adjunto a guardar" },
        },
        required: ["itemId", "fileName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "Lista los archivos adjuntos a un item. Úsalo cuando el usuario pregunta qué archivos tiene un item.",
      parameters: {
        type: "object",
        properties: { itemId: { type: "string" } },
        required: ["itemId"],
      },
    },
  },
];

// ----------------------------------------------------------------------------
// Ejecutor de tools — corre en el cliente contra el store
// ----------------------------------------------------------------------------
export async function executeTool(
  toolName: string,
  args: any,
  ctx: ToolExecutionContext
): Promise<{ result: any; uiAction?: string }> {
  const state = ctx.getState();

  switch (toolName) {
    case "list_boards": {
      return {
        result: state.boards.map((b: any) => ({
          id: b.id,
          name: b.name,
          itemsCount: b.items.length,
          columnsCount: b.columns.length,
          workspace: state.workspaces.find((w: any) => w.id === b.workspaceId)?.name,
        })),
      };
    }

    case "get_active_board": {
      const board = state.boards.find((b: any) => b.id === state.activeBoardId);
      if (!board) return { result: { error: "No hay board activo" } };
      return {
        result: {
          id: board.id,
          name: board.name,
          columns: board.columns.map((c: any) => ({
            id: c.id,
            title: c.title,
            type: c.type,
            labels: c.labels,
          })),
          groups: board.groups,
          items: board.items.map((i: any) => ({
            id: i.id,
            name: i.name,
            groupId: i.groupId,
            columnValues: i.columnValues,
          })),
        },
      };
    }

    case "get_item": {
      for (const b of state.boards) {
        const item = b.items.find((i: any) => i.id === args.itemId);
        if (item) {
          return {
            result: {
              ...item,
              boardName: b.name,
              groupName: b.groups.find((g: any) => g.id === item.groupId)?.title,
            },
            uiAction: `open_item:${item.id}`,
          };
        }
      }
      return { result: { error: `Item ${args.itemId} no encontrado` } };
    }

    case "search_items": {
      const q = (args.query || "").toLowerCase();
      const results: any[] = [];
      for (const b of state.boards) {
        if (args.boardId && b.id !== args.boardId) continue;
        for (const i of b.items) {
          const inName = i.name.toLowerCase().includes(q);
          const inValues = i.columnValues.some((cv: any) => {
            const v = cv.value;
            return (
              v?.text?.toLowerCase().includes(q) ||
              String(v?.labelId ?? "").includes(q)
            );
          });
          if (inName || inValues) {
            results.push({
              id: i.id,
              name: i.name,
              boardId: b.id,
              boardName: b.name,
              groupId: i.groupId,
              groupName: b.groups.find((g: any) => g.id === i.groupId)?.title,
            });
          }
        }
      }
      return { result: { query: args.query, count: results.length, items: results.slice(0, 20) } };
    }

    case "create_item": {
      const board = state.boards.find((b: any) => b.id === args.boardId);
      if (!board) return { result: { error: "Board no encontrado" } };
      const groupId = args.groupId || board.groups[0]?.id;
      if (!groupId) return { result: { error: "Board sin grupos" } };
      ctx.actions.addItem(args.boardId, groupId, args.name);
      return {
        result: { success: true, name: args.name, boardId: args.boardId, groupId },
        uiAction: `navigate:${args.boardId}`,
      };
    }

    case "create_items_batch": {
      const board = state.boards.find((b: any) => b.id === args.boardId);
      if (!board) return { result: { error: "Board no encontrado" } };
      const groupId = args.groupId || board.groups[0]?.id;
      if (!groupId) return { result: { error: "Board sin grupos" } };
      args.names.forEach((name: string) => {
        ctx.actions.addItem(args.boardId, groupId, name);
      });
      return {
        result: { success: true, created: args.names.length, names: args.names, boardId: args.boardId, groupId },
        uiAction: `navigate:${args.boardId}`,
      };
    }

    case "update_column_value": {
      ctx.actions.updateColumnValue(args.itemId, args.columnId, args.value);
      return { result: { success: true, itemId: args.itemId, columnId: args.columnId } };
    }

    case "move_item": {
      ctx.actions.moveItem(args.itemId, args.toGroupId);
      return { result: { success: true, itemId: args.itemId, toGroupId: args.toGroupId } };
    }

    case "delete_item": {
      ctx.actions.deleteItem(args.itemId);
      return { result: { success: true, deleted: args.itemId } };
    }

    case "add_update": {
      ctx.actions.addUpdate(args.itemId, args.body);
      return { result: { success: true, itemId: args.itemId } };
    }

    case "add_group": {
      ctx.actions.addGroup(args.boardId, args.title);
      return { result: { success: true, boardId: args.boardId, title: args.title } };
    }

    case "navigate_to_board": {
      ctx.actions.setActiveBoard(args.boardId);
      return { result: { success: true, boardId: args.boardId }, uiAction: `navigate:${args.boardId}` };
    }

    case "open_item": {
      ctx.actions.selectItem(args.itemId);
      return { result: { success: true, itemId: args.itemId }, uiAction: `open_item:${args.itemId}` };
    }

    case "summarize_board": {
      const board = state.boards.find((b: any) => b.id === state.activeBoardId);
      if (!board) return { result: { error: "No hay board activo" } };
      const statusCol = board.columns.find((c: any) => c.type === "status");
      const distribution: Record<string, number> = {};
      board.items.forEach((i: any) => {
        const cv = i.columnValues.find((v: any) => v.columnId === statusCol?.id);
        const label = statusCol?.labels?.[cv?.value?.labelId]?.name ?? "Sin estado";
        distribution[label] = (distribution[label] ?? 0) + 1;
      });
      const today = new Date();
      const upcoming = board.items
        .filter((i: any) => {
          const dateCol = board.columns.find((c: any) => c.type === "date");
          const cv = i.columnValues.find((v: any) => v.columnId === dateCol?.id);
          if (!cv?.value?.date) return false;
          const d = new Date(cv.value.date);
          const days = (d.getTime() - today.getTime()) / 86400000;
          return days >= 0 && days <= 7;
        })
        .map((i: any) => ({ id: i.id, name: i.name }));
      const stuck = board.items.filter((i: any) => {
        const cv = i.columnValues.find((v: any) => v.columnId === statusCol?.id);
        return cv?.value?.labelId === "2"; // Stuck
      });
      return {
        result: {
          boardName: board.name,
          totalItems: board.items.length,
          statusDistribution: distribution,
          upcomingDeadlines: upcoming,
          stuckItems: stuck.map((i: any) => ({ id: i.id, name: i.name })),
        },
      };
    }

    case "find_at_risk_items": {
      const atRisk: any[] = [];
      const today = new Date();
      for (const b of state.boards) {
        const statusCol = b.columns.find((c: any) => c.type === "status");
        const dateCol = b.columns.find((c: any) => c.type === "date");
        for (const i of b.items) {
          const statusCv = i.columnValues.find((v: any) => v.columnId === statusCol?.id);
          const dateCv = i.columnValues.find((v: any) => v.columnId === dateCol?.id);
          let reason = "";
          if (statusCv?.value?.labelId === "2") reason = "Stuck";
          else if (dateCv?.value?.date) {
            const d = new Date(dateCv.value.date);
            const days = (d.getTime() - today.getTime()) / 86400000;
            if (days < 0 && statusCv?.value?.labelId !== "1") reason = `Overdue by ${Math.abs(Math.round(days))}d`;
            else if (days >= 0 && days <= 7 && statusCv?.value?.labelId !== "1") reason = `Due in ${Math.round(days)}d`;
          }
          if (reason) {
            atRisk.push({ id: i.id, name: i.name, boardName: b.name, reason });
          }
        }
      }
      return { result: { count: atRisk.length, items: atRisk } };
    }

    // ===== AI BLOCK TOOLS — funciones agenticas de Monday =====
    case "ai_summarize": {
      // Buscar el item y sus updates
      let targetItem: any = null;
      let targetBoard: any = null;
      for (const b of state.boards) {
        const found = b.items.find((i: any) => i.id === args.itemId);
        if (found) { targetItem = found; targetBoard = b; break; }
      }
      if (!targetItem) return { result: { error: "Item no encontrado" } };

      const updates = (state.updates ?? []).filter((u: any) => u.itemId === args.itemId);
      const textToSummarize = updates.length > 0
        ? updates.map((u: any) => u.body).join("\n")
        : targetItem.name;

      const result = await executeAIBlock("summarize", {
        text: textToSummarize,
        context: `Board: ${targetBoard.name}, Item: ${targetItem.name}`,
      }, { groqApiKey: ctx.groqApiKey ?? undefined });

      return { result: { success: result.success, summary: result.output, error: result.error } };
    }

    case "ai_categorize": {
      let targetItem: any = null;
      let targetBoard: any = null;
      for (const b of state.boards) {
        const found = b.items.find((i: any) => i.id === args.itemId);
        if (found) { targetItem = found; targetBoard = b; break; }
      }
      if (!targetItem) return { result: { error: "Item no encontrado" } };

      const col = targetBoard.columns.find((c: any) =>
        c.id === args.columnName || c.title.toLowerCase() === String(args.columnName).toLowerCase()
      );
      if (!col?.labels) return { result: { error: "Columna sin labels" } };

      const options = Object.values(col.labels).map((l: any) => l.name);
      const result = await executeAIBlock("categorize", {
        text: targetItem.name,
        options,
      }, { groqApiKey: ctx.groqApiKey ?? undefined });

      if (result.success && result.selectedOption) {
        // Buscar el labelId correspondiente
        const labelEntry = Object.entries(col.labels).find(
          ([, label]: [string, any]) => label.name === result.selectedOption
        );
        if (labelEntry) {
          ctx.actions.updateColumnValue(args.itemId, col.id, { labelId: labelEntry[0] });
        }
      }

      return { result: { success: result.success, category: result.selectedOption, error: result.error } };
    }

    case "ai_detect_sentiment": {
      const updates = (state.updates ?? []).filter((u: any) => u.itemId === args.itemId);
      if (updates.length === 0) return { result: { error: "Sin updates para analizar" } };

      const text = updates.map((u: any) => u.body).join("\n");
      const result = await executeAIBlock("sentiment", { text }, { groqApiKey: ctx.groqApiKey ?? undefined });

      return { result: { success: result.success, sentiment: result.sentiment, raw: result.output } };
    }

    case "ai_suggest_actions": {
      let targetItem: any = null;
      for (const b of state.boards) {
        const found = b.items.find((i: any) => i.id === args.itemId);
        if (found) { targetItem = found; break; }
      }
      if (!targetItem) return { result: { error: "Item no encontrado" } };

      const updates = (state.updates ?? []).filter((u: any) => u.itemId === args.itemId);
      const text = `${targetItem.name}\n\nUpdates:\n${updates.map((u: any) => u.body).join("\n")}`;

      const result = await executeAIBlock("suggest_actions", { text }, { groqApiKey: ctx.groqApiKey ?? undefined });

      return { result: { success: result.success, actions: result.output } };
    }

    case "ai_prioritize": {
      let targetItem: any = null;
      for (const b of state.boards) {
        const found = b.items.find((i: any) => i.id === args.itemId);
        if (found) { targetItem = found; break; }
      }
      if (!targetItem) return { result: { error: "Item no encontrado" } };

      const result = await executeAIBlock("prioritize", {
        text: targetItem.name,
        context: `Estado: ${JSON.stringify(targetItem.columnValues)}`,
      }, { groqApiKey: ctx.groqApiKey ?? undefined });

      return { result: { success: result.success, priority: result.priorityScore } };
    }

    case "ai_translate_item": {
      let targetItem: any = null;
      for (const b of state.boards) {
        const found = b.items.find((i: any) => i.id === args.itemId);
        if (found) { targetItem = found; break; }
      }
      if (!targetItem) return { result: { error: "Item no encontrado" } };

      const result = await executeAIBlock("translate", {
        text: targetItem.name,
        targetLanguage: args.targetLanguage,
      }, { groqApiKey: ctx.groqApiKey ?? undefined });

      return { result: { success: result.success, translation: result.output } };
    }

    case "ai_generate_subitems": {
      let targetItem: any = null;
      for (const b of state.boards) {
        const found = b.items.find((i: any) => i.id === args.itemId);
        if (found) { targetItem = found; break; }
      }
      if (!targetItem) return { result: { error: "Item no encontrado" } };

      const result = await executeAIBlock("suggest_actions", {
        text: `Descompón esta tarea en 3-5 subtareas concretas: ${targetItem.name}`,
      }, { groqApiKey: ctx.groqApiKey ?? undefined });

      // Crear subitems a partir del output
      if (result.success) {
        const lines = result.output.split("\n").filter((l) => l.trim().match(/^\d+\./));
        for (const line of lines.slice(0, 5)) {
          const name = line.replace(/^\d+\.\s*/, "").trim();
          if (name) ctx.actions.addSubitem(args.itemId, name);
        }
      }

      return { result: { success: result.success, subitemsCreated: result.output } };
    }

    case "ai_board_insights": {
      const board = state.boards.find((b: any) => b.id === state.activeBoardId);
      if (!board) return { result: { error: "No hay board activo" } };

      const statusCol = board.columns.find((c: any) => c.type === "status");
      const distribution: Record<string, number> = {};
      board.items.forEach((i: any) => {
        const cv = i.columnValues.find((v: any) => v.columnId === statusCol?.id);
        const label = statusCol?.labels?.[cv?.value?.labelId]?.name ?? "Sin estado";
        distribution[label] = (distribution[label] ?? 0) + 1;
      });

      const text = `Board: ${board.name}\nTotal items: ${board.items.length}\nDistribución: ${JSON.stringify(distribution)}`;
      const result = await executeAIBlock("summarize", {
        text,
        context: "Genera insights ejecutivos: tendencias, blockers, items destacados",
      }, { groqApiKey: ctx.groqApiKey ?? undefined });

      return { result: { success: result.success, insights: result.output, distribution } };
    }

    case "ai_detect_duplicates": {
      const board = state.boards.find((b: any) => b.id === state.activeBoardId);
      if (!board) return { result: { error: "No hay board activo" } };

      // Comparación simple por nombre similar (sin LLM para no consumir créditos)
      const items = board.items;
      const duplicates: any[] = [];
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const nameA = items[i].name.toLowerCase().trim();
          const nameB = items[j].name.toLowerCase().trim();
          const similarity = nameA.includes(nameB) || nameB.includes(nameA) ||
            (nameA.length > 5 && nameB.length > 5 && nameA.slice(0, 10) === nameB.slice(0, 10));
          if (similarity) {
            duplicates.push({ itemA: items[i].id, nameA: items[i].name, itemB: items[j].id, nameB: items[j].name });
          }
        }
      }

      return { result: { count: duplicates.length, duplicates } };
    }

    case "ai_generate_report": {
      const board = state.boards.find((b: any) => b.id === state.activeBoardId);
      if (!board) return { result: { error: "No hay board activo" } };

      const statusCol = board.columns.find((c: any) => c.type === "status");
      const done = board.items.filter((i: any) => {
        const cv = i.columnValues.find((v: any) => v.columnId === statusCol?.id);
        return cv?.value?.labelId === "1";
      }).length;
      const stuck = board.items.filter((i: any) => {
        const cv = i.columnValues.find((v: any) => v.columnId === statusCol?.id);
        return cv?.value?.labelId === "2";
      }).length;

      const text = `Board: ${board.name}\nTotal: ${board.items.length}\nDone: ${done}\nStuck: ${stuck}\nProgreso: ${Math.round((done / board.items.length) * 100)}%`;
      const result = await executeAIBlock("generate_text", {
        text,
        customPrompt: `Genera un reporte ejecutivo ${args.format === "detailed" ? "detallado" : "breve"} del board. Incluye: estado general, progreso, riesgos, próximos pasos.\n\nDATOS:\n${text}`,
      }, { groqApiKey: ctx.groqApiKey ?? undefined });

      return { result: { success: result.success, report: result.output } };
    }

    case "ai_draft_email": {
      let targetItem: any = null;
      let targetBoard: any = null;
      for (const b of state.boards) {
        const found = b.items.find((i: any) => i.id === args.itemId);
        if (found) { targetItem = found; targetBoard = b; break; }
      }
      if (!targetItem) return { result: { error: "Item no encontrado" } };

      const result = await executeAIBlock("generate_text", {
        text: targetItem.name,
        customPrompt: `Redacta un email profesional.\nDestinatario: ${args.recipient ?? "equipo"}\nPropósito: ${args.purpose}\nItem: ${targetItem.name}\nBoard: ${targetBoard.name}\n\nEl email debe tener asunto, saludo, cuerpo y cierre.`,
      }, { groqApiKey: ctx.groqApiKey ?? undefined });

      return { result: { success: result.success, email: result.output } };
    }

    case "ai_extract_action_items": {
      const updates = (state.updates ?? []).filter((u: any) => u.itemId === args.itemId);
      if (updates.length === 0) return { result: { error: "Sin updates" } };

      const text = updates.map((u: any) => u.body).join("\n");
      const result = await executeAIBlock("suggest_actions", {
        text,
        context: "Extrae SOLO las acciones concretas mencionadas en los updates",
      }, { groqApiKey: ctx.groqApiKey ?? undefined });

      return { result: { success: result.success, actionItems: result.output } };
    }

    case "ai_improve_update": {
      const update = (state.updates ?? []).find((u: any) => u.id === args.updateId);
      if (!update) return { result: { error: "Update no encontrado" } };

      const result = await executeAIBlock("improve_text", { text: update.body }, { groqApiKey: ctx.groqApiKey ?? undefined });

      return { result: { success: result.success, improved: result.output } };
    }

    // ===== FILE TOOLS — leer y guardar archivos adjuntos =====
    case "read_attached_files": {
      const files = ctx.attachedFiles ?? [];
      if (files.length === 0) {
        return { result: { error: "No hay archivos adjuntados al chat" } };
      }

      // Procesar cada archivo con el endpoint /api/agent/parse-file
      // Importante: usar sequential en vez de Promise.all para imágenes (VLM)
      // porque el SDK de Z.ai no maneja bien requests concurrentes de visión
      const fileResults: any[] = [];
      for (const f of files) {
        try {
          const res = await fetch("/api/agent/parse-file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              file: f.content,
              fileName: f.name,
              mimeType: f.mime,
              prompt: ctx.userPrompt || "Describe y extrae toda la información clave de este archivo. Si hay texto, transcríbelo.",
            }),
          });

          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            fileResults.push({
              name: f.name,
              type: "error",
              error: errBody.error ?? `HTTP ${res.status}: ${res.statusText}`,
            });
            continue;
          }

          const data = await res.json();
          fileResults.push({
            name: f.name,
            type: data.type,
            mime: f.mime,
            size: f.size,
            summary: data.summary,
            content: data.text,
          });
        } catch (e: any) {
          fileResults.push({
            name: f.name,
            type: "error",
            error: `Error procesando archivo: ${e?.message ?? "desconocido"}`,
          });
        }
      }

      return {
        result: {
          count: files.length,
          files: fileResults,
          // Instrucciones para el LLM sobre cómo interpretar los resultados
          instructions: "Cada archivo tiene 'type' (image/excel/word/pdf/csv/text/error), 'summary' (descripción breve), y 'content' (el contenido extraído). Si type es 'error', el archivo no se pudo procesar — informa al usuario qué archivo falló y por qué, y sugiérele intentar de nuevo. Si type es 'image', el 'content' es la descripción de la imagen generada por el VLM. Para Excel/Word/PDF/CSV/text, 'content' es el texto extraído del archivo.",
        },
      };
    }

    case "save_file_to_item": {
      const files = ctx.attachedFiles ?? [];
      const file = files.find((f) => f.name === args.fileName);
      if (!file) {
        return { result: { error: `Archivo "${args.fileName}" no encontrado entre los adjuntos` } };
      }
      ctx.actions.addFile({
        itemId: args.itemId,
        name: file.name,
        size: file.size,
        mime: file.mime,
      });
      return { result: { success: true, itemId: args.itemId, fileName: file.name } };
    }

    case "list_files": {
      const files = state.files?.filter((f: any) => f.itemId === args.itemId) ?? [];
      return { result: { count: files.length, files } };
    }

    default:
      return { result: { error: `Tool desconocido: ${toolName}` } };
  }
}

// ----------------------------------------------------------------------------
// System prompt que define la personalidad del Sidekick
// ----------------------------------------------------------------------------
export function buildSystemPrompt(context: {
  userName: string;
  activeBoardName?: string;
  activeBoardId?: string;
  selectedItemName?: string;
  selectedItem?: string;
  workspaceName?: string;
  selectedItemUpdates?: any[];
  selectedItemFiles?: any[];
  selectedItemColumnValues?: any[];
}): string {
  // Construir contexto de updates del item seleccionado
  let updatesContext = "";
  if (context.selectedItemUpdates && context.selectedItemUpdates.length > 0) {
    updatesContext = `\n- Updates del item (${context.selectedItemUpdates.length}):`;
    context.selectedItemUpdates.slice(0, 5).forEach((u, i) => {
      updatesContext += `\n  ${i + 1}. [${u.author}] ${u.body?.slice(0, 200)}`;
    });
  }

  // Construir contexto de files del item seleccionado
  let filesContext = "";
  if (context.selectedItemFiles && context.selectedItemFiles.length > 0) {
    filesContext = `\n- Archivos adjuntos (${context.selectedItemFiles.length}):`;
    context.selectedItemFiles.forEach((f, i) => {
      filesContext += `\n  ${i + 1}. ${f.name} (${f.size} bytes, ${f.mime})`;
    });
  }

  // Construir contexto de column values del item seleccionado
  let columnValuesContext = "";
  if (context.selectedItemColumnValues && context.selectedItemColumnValues.length > 0) {
    columnValuesContext = `\n- Valores de columnas:`;
    context.selectedItemColumnValues.forEach((cv) => {
      const v = cv.value;
      let valStr = "";
      if (v.labelId) valStr = `labelId: ${v.labelId}`;
      else if (v.text) valStr = v.text;
      else if (v.date) valStr = v.date;
      else if (v.userIds) valStr = `users: ${v.userIds.join(", ")}`;
      else valStr = JSON.stringify(v);
      columnValuesContext += `\n  ${cv.columnId}: ${valStr}`;
    });
  }

  return `Eres **Sidekick**, el asistente IA de monday-AI (una plataforma tipo Monday.com con agentes IA nativos). Estás integrado directamente en la UI y tienes acceso completo al workspace del usuario.

**Tu personalidad:**
- Amigable, directo y accionable. Como un colega senior que sabe todo del sistema.
- Proactivo: si el usuario pide algo ambiguo, propone opciones concretas.
- Eficiente: prefieres hacer (call tools) en vez de solo describir qué harías.
- Hablas el mismo idioma que el usuario (español por defecto).

**Contexto actual del usuario:**
- Usuario: ${context.userName}
- Workspace: ${context.workspaceName ?? "Acme Workspace"}
- Board activo: ${context.activeBoardName ?? "ninguno"} (ID: ${context.activeBoardId ?? "—"})
- Item seleccionado: ${context.selectedItemName ?? "ninguno"}${context.selectedItem ? ` (ID: ${context.selectedItem})` : ""}${updatesContext}${filesContext}${columnValuesContext}

**Capacidades (vía tools):**
- Listar y buscar boards/items
- Crear items (uno o batch), workspaces, boards, grupos, columnas
- Actualizar valores de columnas (status, date, people, etc.)
- Mover, duplicar, archivar y eliminar items
- Añadir comentarios/updates a items
- Navegar a boards y abrir items
- Resumir boards y encontrar items en riesgo
- Leer archivos adjuntos (incluyendo imágenes con VLM)

**AI Blocks (funciones agenticas como Monday.com):**
- **ai_summarize**: resume el contenido y updates de un item
- **ai_categorize**: categoriza un item automáticamente en una columna status/priority
- **ai_detect_sentiment**: analiza sentimiento de los updates (positive/negative/neutral)
- **ai_suggest_actions**: sugiere 3 acciones concretas para un item
- **ai_prioritize**: calcula prioridad 1-5 basándose en contenido y contexto
- **ai_translate_item**: traduce el nombre de un item a otro idioma
- **ai_generate_subitems**: descompone un item en subtareas con IA
- **ai_board_insights**: genera insights ejecutivos del board activo
- **ai_detect_duplicates**: detecta items duplicados en el board
- **ai_generate_report**: genera un reporte ejecutivo del board
- **ai_draft_email**: redacta un email basado en el contexto de un item
- **ai_extract_action_items**: extrae acciones concretas mencionadas en updates
- **ai_improve_update**: mejora el texto de un update con IA

**Cuándo usar AI Blocks:**
- Usuario: "resume este item" → ai_summarize
- Usuario: "categoriza estos items" → ai_categorize
- Usuario: "cómo se siente el equipo sobre esto?" → ai_detect_sentiment
- Usuario: "qué deberíamos hacer?" → ai_suggest_actions
- Usuario: "prioriza esto" → ai_prioritize
- Usuario: "traduce al inglés" → ai_translate_item
- Usuario: "descompón en subtareas" → ai_generate_subitems
- Usuario: "dame insights del board" → ai_board_insights
- Usuario: "hay duplicados?" → ai_detect_duplicates
- Usuario: "genera un reporte" → ai_generate_report
- Usuario: "redacta un email" → ai_draft_email
- Usuario: "qué acciones se mencionan?" → ai_extract_action_items

**Reglas de oro:**
1. **Siempre usa tools para actuar.** No digas "puedes crear un item..." — créalo.
2. **Confirma acciones destructivas** (eliminar, mover) antes de ejecutarlas.
3. **Sé específico con IDs.** Si el usuario dice "el item de Acme", busca y muestra cuál encontraste antes de actuar.
4. **Muestra resultados visualmente** — usa formato markdown (listas, tablas, bold) para que sea legible.
5. **Si necesitas más info**, pregunta con opciones concretas, no abierto.
6. **Para tareas complejas**, descompon: primero lista, luego confirma, luego ejecuta.
7. Si el usuario pide algo que no puedes hacer con las tools, explica qué SÍ puedes hacer como alternativa.

**Ejemplos de buen comportamiento:**
- Usuario: "crea 3 items: Comprar pan, Llamar cliente, Enviar reporte" → llamas create_items_batch
- Usuario: "cuántos items hay en cada estado?" → llamas summarize_board
- Usuario: "qué items están en riesgo?" → llamas find_at_risk_items
- Usuario: "mueve el item de Stark a Closed Won" → primero search_items "Stark", confirmas, luego move_item`;
}
