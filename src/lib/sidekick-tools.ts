// ============================================================================
// Tool definitions para el Sidekick — lo que el agente puede hacer en el sistema
// ============================================================================
// Las tools se envían al LLM (Groq/Z.ai) y se ejecutan en el cliente contra
// el store de Zustand. El agente recibe los resultados y puede continuar.

import type { GroqTool } from "./groq-types";

export interface ToolExecutionContext {
  // Snapshot read-only del estado — el ejecutor en cliente pasa esto
  getState: () => any;
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
    addFile: (file: { itemId: string; name: string; size: number; mime: string; content?: string }) => void;
    deleteFile: (fileId: string) => void;
    addSubitem: (parentId: string, name: string) => void;
    deleteSubitem: (parentId: string, subitemId: string) => void;
    renameGroup: (boardId: string, groupId: string, title: string) => void;
    deleteGroup: (boardId: string, groupId: string) => void;
    duplicateGroup: (boardId: string, groupId: string) => void;
    duplicateItem: (itemId: string) => void;
    archiveItem: (itemId: string) => void;
    addColumn: (boardId: string, col: { title: string; type: string }) => void;
    deleteColumn: (boardId: string, columnId: string) => void;
    // Boards
    addBoard: (workspaceId: string, name: string) => string;
    renameBoard: (boardId: string, name: string) => void;
    duplicateBoard: (boardId: string) => string;
    archiveBoard: (boardId: string) => void;
    deleteBoard: (boardId: string) => void;
    // Workspaces
    addWorkspace: (name: string) => string;
    renameWorkspace: (workspaceId: string, name: string) => void;
    deleteWorkspace: (workspaceId: string) => void;
  };
  // Archivos adjuntos por el usuario (para que el agente los lea)
  // content puede ser texto plano (para txt/csv/json) o un data URL
  // (data:image/png;base64,...) para imágenes que se enviarán al VLM.
  attachedFiles?: { name: string; size: number; mime: string; content: string }[];
  // Prompt del usuario actual — se usa para darle contexto al VLM sobre qué
  // buscar en la imagen (ej: "¿qué ves en la imagen?")
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
  {
    type: "function",
    function: {
      name: "duplicate_item",
      description: "Duplica un item existente (copia con todos sus valores). Úsalo cuando el usuario dice 'duplica este item', 'copia esta tarea'.",
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
      name: "archive_item",
      description: "Archiva un item (lo marca como archivado, no se elimina). Úsalo cuando el usuario dice 'archiva', 'oculta este item'.",
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
      name: "rename_group",
      description: "Renombra un grupo existente en un board. Úsalo cuando el usuario dice 'renombra el grupo', 'cambia el nombre del grupo'.",
      parameters: {
        type: "object",
        properties: {
          boardId: { type: "string" },
          groupId: { type: "string" },
          title: { type: "string" },
        },
        required: ["boardId", "groupId", "title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_group",
      description: "Elimina un grupo y todos sus items. Úsalo con cuidado cuando el usuario confirma que quiere borrar un grupo completo.",
      parameters: {
        type: "object",
        properties: {
          boardId: { type: "string" },
          groupId: { type: "string" },
        },
        required: ["boardId", "groupId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_subitem",
      description: "Añade un subitem a un item existente. Úsalo cuando el usuario dice 'añade un subitem', 'crea una subtarea'.",
      parameters: {
        type: "object",
        properties: {
          parentId: { type: "string" },
          name: { type: "string" },
        },
        required: ["parentId", "name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_column",
      description: "Añade una nueva columna a un board. type puede ser: text, status, date, numbers, people, checkbox, priority. Úsalo cuando el usuario dice 'añade una columna'.",
      parameters: {
        type: "object",
        properties: {
          boardId: { type: "string" },
          title: { type: "string", description: "Nombre de la columna" },
          type: { type: "string", description: "text, status, date, numbers, people, checkbox, priority" },
        },
        required: ["boardId", "title", "type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_board",
      description: "Crea un board nuevo en un workspace. Úsalo cuando el usuario dice 'crea un board', 'nuevo tablero'.",
      parameters: {
        type: "object",
        properties: {
          workspaceId: { type: "string", description: "ID del workspace. Si no se sabe, usar el primero." },
          name: { type: "string" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rename_board",
      description: "Cambia el nombre de un board existente. Úsalo cuando el usuario dice 'renombra el board', 'cambia el nombre del tablero'.",
      parameters: {
        type: "object",
        properties: {
          boardId: { type: "string" },
          name: { type: "string", description: "Nuevo nombre del board" },
        },
        required: ["boardId", "name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "duplicate_board",
      description: "Duplica un board existente (copia todos sus grupos, items y columnas). Úsalo cuando el usuario dice 'duplica este board', 'haz una copia del tablero'.",
      parameters: {
        type: "object",
        properties: {
          boardId: { type: "string" },
        },
        required: ["boardId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "archive_board",
      description: "Archiva un board (no se elimina pero se marca como archivado). Úsalo cuando el usuario dice 'archiva este board', 'oculta este tablero'.",
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
      name: "delete_board",
      description: "Elimina un board completo con todos sus items y grupos. Úsalo SOLO cuando el usuario confirma explícitamente que quiere borrar el tablero.",
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
      name: "list_workspaces",
      description: "Lista todos los workspaces disponibles con su ID, nombre y cantidad de boards. Úsalo cuando el usuario pregunta qué workspaces tiene o quiere saber dónde crear cosas.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_workspace",
      description: "Crea un workspace nuevo. Úsalo cuando el usuario dice 'crea un workspace', 'nuevo workspace', 'quiero un espacio de trabajo nuevo'. El sistema no requiere permisos especiales: el usuario es owner y puede crear todos los workspaces que quiera.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nombre del workspace (ej: 'Compras', 'Proyectos 2025', 'Recursos Humanos')" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rename_workspace",
      description: "Cambia el nombre de un workspace existente. Úsalo cuando el usuario dice 'renombra el workspace'.",
      parameters: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          name: { type: "string" },
        },
        required: ["workspaceId", "name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_workspace",
      description: "Elimina un workspace completo con todos sus boards. Úsalo SOLO cuando el usuario confirma explícitamente. Acción destructiva.",
      parameters: {
        type: "object",
        properties: { workspaceId: { type: "string" } },
        required: ["workspaceId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "duplicate_group",
      description: "Duplica un grupo existente dentro de un board (copia sus items). Úsalo cuando el usuario dice 'duplica este grupo', 'copia esta sección'.",
      parameters: {
        type: "object",
        properties: {
          boardId: { type: "string" },
          groupId: { type: "string" },
        },
        required: ["boardId", "groupId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_column",
      description: "Elimina una columna de un board. Úsalo cuando el usuario dice 'borra esta columna', 'elimina el campo'.",
      parameters: {
        type: "object",
        properties: {
          boardId: { type: "string" },
          columnId: { type: "string" },
        },
        required: ["boardId", "columnId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_attached_files",
      description:
        "Lee el contenido de los archivos que el usuario ha adjuntado al chat. Soporta imágenes (PNG/JPG/GIF/WebP) usando un modelo de visión (VLM) para analizarlas y describirlas, además de archivos de texto (txt, csv, json, md, código). Úsalo SIEMPRE que el usuario sube un archivo y pide que lo leas, analices, describas o extraigas información — incluso si es una imagen. NO digas que no puedes leer imágenes: esta tool sí puede.",
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
  {
    type: "function",
    function: {
      name: "list_groups",
      description: "Lista los grupos de un board con sus IDs, nombres y cantidad de items. Úsalo cuando necesitas saber los grupos disponibles.",
      parameters: {
        type: "object",
        properties: { boardId: { type: "string" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_item_updates",
      description: "Obtiene todos los updates (comentarios) de un item. Úsalo cuando el usuario pregunta por el historial de comentarios de una tarea.",
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
// Nota: es async porque algunas tools (read_attached_files con imágenes)
// hacen fetch al endpoint VLM del backend.
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

    case "duplicate_item": {
      ctx.actions.duplicateItem(args.itemId);
      return { result: { success: true, duplicated: args.itemId } };
    }

    case "archive_item": {
      ctx.actions.archiveItem(args.itemId);
      return { result: { success: true, archived: args.itemId } };
    }

    case "rename_group": {
      ctx.actions.renameGroup(args.boardId, args.groupId, args.title);
      return { result: { success: true, boardId: args.boardId, groupId: args.groupId, newTitle: args.title } };
    }

    case "delete_group": {
      ctx.actions.deleteGroup(args.boardId, args.groupId);
      return { result: { success: true, deleted: args.groupId } };
    }

    case "add_subitem": {
      ctx.actions.addSubitem(args.parentId, args.name);
      return { result: { success: true, parentId: args.parentId, subitemName: args.name } };
    }

    case "add_column": {
      ctx.actions.addColumn(args.boardId, { title: args.title, type: args.type });
      return { result: { success: true, boardId: args.boardId, columnTitle: args.title, columnType: args.type } };
    }

    case "create_board": {
      const wsId = args.workspaceId || state.workspaces?.[0]?.id || "w1";
      const boardId = ctx.actions.addBoard(wsId, args.name);
      return { result: { success: true, boardId, boardName: args.name, workspaceId: wsId }, uiAction: `navigate:${boardId}` };
    }

    case "rename_board": {
      const board = state.boards.find((b: any) => b.id === args.boardId);
      if (!board) return { result: { error: "Board no encontrado" } };
      ctx.actions.renameBoard(args.boardId, args.name);
      return { result: { success: true, boardId: args.boardId, newName: args.name } };
    }

    case "duplicate_board": {
      const board = state.boards.find((b: any) => b.id === args.boardId);
      if (!board) return { result: { error: "Board no encontrado" } };
      const newId = ctx.actions.duplicateBoard(args.boardId);
      return { result: { success: true, originalBoardId: args.boardId, newBoardId: newId, newName: `${board.name} (copia)` }, uiAction: `navigate:${newId}` };
    }

    case "archive_board": {
      ctx.actions.archiveBoard(args.boardId);
      return { result: { success: true, archived: args.boardId } };
    }

    case "delete_board": {
      ctx.actions.deleteBoard(args.boardId);
      return { result: { success: true, deleted: args.boardId } };
    }

    case "list_workspaces": {
      return {
        result: {
          count: state.workspaces?.length ?? 0,
          workspaces: (state.workspaces ?? []).map((w: any) => ({
            id: w.id,
            name: w.name,
            kind: w.kind,
            boardsCount: state.boards.filter((b: any) => b.workspaceId === w.id).length,
            boardIds: state.boards.filter((b: any) => b.workspaceId === w.id).map((b: any) => b.id),
          })),
        },
      };
    }

    case "create_workspace": {
      const wsId = ctx.actions.addWorkspace(args.name);
      return { result: { success: true, workspaceId: wsId, workspaceName: args.name } };
    }

    case "rename_workspace": {
      const ws = state.workspaces?.find((w: any) => w.id === args.workspaceId);
      if (!ws) return { result: { error: "Workspace no encontrado" } };
      ctx.actions.renameWorkspace(args.workspaceId, args.name);
      return { result: { success: true, workspaceId: args.workspaceId, newName: args.name } };
    }

    case "delete_workspace": {
      ctx.actions.deleteWorkspace(args.workspaceId);
      return { result: { success: true, deleted: args.workspaceId } };
    }

    case "duplicate_group": {
      const board = state.boards.find((b: any) => b.id === args.boardId);
      if (!board) return { result: { error: "Board no encontrado" } };
      const group = board.groups.find((g: any) => g.id === args.groupId);
      if (!group) return { result: { error: "Grupo no encontrado" } };
      ctx.actions.duplicateGroup(args.boardId, args.groupId);
      return { result: { success: true, boardId: args.boardId, sourceGroupId: args.groupId } };
    }

    case "delete_column": {
      const board = state.boards.find((b: any) => b.id === args.boardId);
      if (!board) return { result: { error: "Board no encontrado" } };
      const col = board.columns.find((c: any) => c.id === args.columnId);
      if (!col) return { result: { error: "Columna no encontrada" } };
      ctx.actions.deleteColumn(args.boardId, args.columnId);
      return { result: { success: true, boardId: args.boardId, deletedColumnId: args.columnId, deletedColumnTitle: col.title } };
    }

    case "read_attached_files": {
      const files = ctx.attachedFiles ?? [];
      if (files.length === 0) {
        return { result: { error: "No hay archivos adjuntados al chat" } };
      }

      // Procesar cada archivo: si es imagen, llamar al VLM; si es texto, devolver contenido
      const fileResults = await Promise.all(
        files.map(async (f) => {
          const isImage = f.mime.startsWith("image/") ||
            /\.(png|jpe?g|gif|webp|bmp)$/i.test(f.name);

          if (isImage) {
            // El content debe ser un data URL (data:image/png;base64,...)
            if (!f.content.startsWith("data:")) {
              return {
                name: f.name,
                type: "image",
                error: "Imagen sin datos base64 (no se puede analizar)",
              };
            }
            try {
              const vlmRes = await fetch("/api/agent/vision", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  image: f.content,
                  prompt: ctx.userPrompt || "Describe lo que ves en esta imagen en detalle.",
                }),
              });
              if (!vlmRes.ok) {
                const errBody = await vlmRes.json().catch(() => ({}));
                return {
                  name: f.name,
                  type: "image",
                  error: `VLM error: ${errBody.error ?? vlmRes.statusText}`,
                  retryable: errBody.retryable ?? false,
                };
              }
              const data = await vlmRes.json();
              return {
                name: f.name,
                type: "image",
                mime: f.mime,
                size: f.size,
                analysis: data.text,
              };
            } catch (e: any) {
              return {
                name: f.name,
                type: "image",
                error: `No pude analizar la imagen: ${e?.message ?? "error desconocido"}`,
              };
            }
          }

          // Archivo de texto: devolver contenido (limitado para no romper el contexto del LLM)
          const textContent = f.content || "";
          return {
            name: f.name,
            type: "text",
            mime: f.mime,
            size: f.size,
            content: textContent.slice(0, 8000),
            truncated: textContent.length > 8000,
          };
        })
      );

      return {
        result: {
          count: files.length,
          files: fileResults,
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

    case "list_groups": {
      const boardId = args.boardId || state.activeBoardId;
      const board = state.boards.find((b: any) => b.id === boardId);
      if (!board) return { result: { error: "Board no encontrado" } };
      return {
        result: {
          boardId,
          boardName: board.name,
          groups: board.groups.map((g: any) => ({
            id: g.id,
            title: g.title,
            color: g.color,
            itemCount: board.items.filter((i: any) => i.groupId === g.id).length,
          })),
        },
      };
    }

    case "get_item_updates": {
      const updates = state.updates?.filter((u: any) => u.itemId === args.itemId) ?? [];
      return {
        result: {
          count: updates.length,
          updates: updates.map((u: any) => ({
            id: u.id,
            body: u.body,
            authorId: u.authorId,
            authorName: state.users?.find((usr: any) => usr.id === u.authorId)?.name ?? "Unknown",
            createdAt: u.createdAt,
          })),
        },
      };
    }

    default: {
      const available = [
        "list_boards","get_active_board","get_item","search_items",
        "create_item","create_items_batch","update_column_value","update_item_name",
        "move_item","delete_item","duplicate_item","archive_item",
        "add_update","add_group","rename_group","delete_group","duplicate_group",
        "summarize_board","find_at_risk_items","navigate_to_board","select_item",
        "list_item_files","add_file","delete_file","add_subitem","delete_subitem",
        "create_board","rename_board","duplicate_board","archive_board","delete_board",
        "create_workspace","rename_workspace","delete_workspace","list_workspaces",
        "add_column","delete_column"
      ].join(", ");
      return {
        result: {
          error: `La tool "${toolName}" no existe. Tools disponibles: ${available}. Por favor usa solo tools de esta lista.`
        }
      };
    }
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
- Crear items (uno o batch)
- Actualizar valores de columnas (status, date, people, etc.)
- Mover items entre grupos
- Eliminar, duplicar y archivar items
- Añadir comentarios/updates a items
- Crear, renombrar y eliminar grupos
- Duplicar grupos
- Navegar a boards y abrir items
- Resumir boards y encontrar items en riesgo
- Guardar archivos adjuntos en items y listarlos
- Listar archivos y updates de items
- **Crear, renombrar, duplicar, archivar y eliminar boards**
- **Crear, renombrar y eliminar workspaces**
- Listar workspaces
- Crear y eliminar columnas

**AI Skills (como Monday AI blocks):**
- **Resumir**: puedes resumir updates, items o boards completos
- **Mejorar texto**: puedes reescribir updates para hacerlos más claros y profesionales
- **Extraer información**: puedes extraer datos clave (fechas, montos, personas) de items
- **Traducir**: puedes traducir contenido a cualquier idioma
- **Detectar sentimiento**: puedes analizar si los updates son positivos/negativos/neutrales

**Reglas de oro:**
1. **Siempre usa tools para actuar.** No digas "puedes crear un item..." — créalo.
2. **Confirma acciones destructivas** (eliminar, mover) antes de ejecutarlas.
3. **Sé específico con IDs.** Si el usuario dice "el item de Acme", busca y muestra cuál encontraste antes de actuar.
4. **Muestra resultados visualmente** — usa formato markdown (listas, tablas, bold) para que sea legible.
5. **Si necesitas más info**, pregunta con opciones concretas, no abierto.
6. **Para tareas complejas**, descompon: primero lista, luego confirma, luego ejecuta.
7. Si el usuario pide algo que no puedes hacer con las tools, explica qué SÍ puedes hacer como alternativa.
8. **Cuando el usuario adjunta archivos**, usa \`list_item_files\` para listar los archivos del item seleccionado. Puedes ver nombre, tamano y tipo MIME de los archivos. No puedes leer el contenido binario de los archivos (imagenes, PDFs, etc.) directamente. Si el usuario quiere analizar el contenido de un archivo, dile que necesita copiar el texto y pegarlo en el chat.
9. **NUNCA digas que "no tienes permisos" o "no tienes capacidad" para hacer algo dentro del sistema.** Eres el asistente IA integrado y tienes control TOTAL sobre el workspace: puedes crear, editar y eliminar workspaces, boards, grupos, columnas e items. Si el usuario pide crear un workspace, un board, una columna o cualquier entidad del sistema — hazlo directamente llamando a la tool correspondiente (create_workspace, create_board, add_column, etc.). No le pidas permisos al usuario ni le digas que requiere configuración adicional: tú tienes los permisos.
10. **Para crear estructuras complejas** (workspace + board + columnas + items), descomónela en pasos: primero create_workspace, luego create_board (con el workspaceId devuelto), luego add_column por cada columna necesaria, luego create_items_batch para los items iniciales. Muestra al usuario el avance en cada paso.

**Ejemplos de buen comportamiento:**
- Usuario: "crea 3 items: Comprar pan, Llamar cliente, Enviar reporte" → llamas create_items_batch
- Usuario: "cuántos items hay en cada estado?" → llamas summarize_board
- Usuario: "qué items están en riesgo?" → llamas find_at_risk_items
- Usuario: "mueve el item de Stark a Closed Won" → primero search_items "Stark", confirmas, luego move_item
- Usuario: "crea un workspace para Compras" → llamas create_workspace con name="Compras", devuelves el ID, y le dices al usuario que está listo
- Usuario: "necesito un nuevo workspace con un board para tickets de compras y pagos" → primero create_workspace("Tickets"), luego create_board(workspaceId, "Compras y Pagos"), luego add_column por cada columna necesaria (fecha, monto, proveedor, estado, etc.)
- Usuario: "renombra el board Actual a 'Ventas 2025'" → primero get_active_board para obtener el ID, luego rename_board`;
}
