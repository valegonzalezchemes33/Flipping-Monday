# monday-AI — Guía de instalación local con Docker (Windows)

Esta guía te explica cómo descargar el proyecto, configurarlo con Docker y ejecutarlo en tu PC con Windows.

---

## ✅ Requisitos previos

Antes de empezar, necesitas instalar en tu Windows:

### 1. Docker Desktop
- **Descarga**: https://www.docker.com/products/docker-desktop/
- **Instala** el ejecutable y reinicia el PC si te lo pide
- **Abre Docker Desktop** y verifica que aparezca el icono de ballena en la bandeja del sistema (verde = funcionando)
- Verifica desde PowerShell:
  ```powershell
  docker --version
  docker-compose --version
  ```

> **Nota**: Docker Desktop requiere WSL 2 (Windows Subsystem for Linux). El instalador te lo configura automáticamente en Windows 10/11.

---

## 📦 Paso 1: Descomprimir el ZIP

1. Localiza el archivo `monday-ai.zip` que descargaste
2. Clic derecho → **Extraer todo...** → elige una ruta corta como `C:\monday-ai`
   - ⚠️ **EVITA** rutas con espacios o caracteres especiales (ej: `C:\Mi Carpeta\monday ai`)
   - ⚠️ **EVITA** `OneDrive` o rutas de red

Estructura esperada después de descomprimir:
```
C:\monday-ai\
├── Dockerfile
├── docker-compose.yml
├── docker-entrypoint.sh
├── .dockerignore
├── .env.example
├── package.json
├── bun.lock
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── components.json
├── prisma/
├── public/
└── src/
```

---

## ⚙️ Paso 2: Configurar variables de entorno

1. Abre PowerShell o Explorador de archivos
2. Ve a `C:\monday-ai`
3. Copia `.env.example` y renómbralo a `.env`
4. Ábrelo con Bloc de notas o VS Code
5. Completa tu Groq API key (opcional pero recomendado para chat más rápido):

```env
DATABASE_URL=file:/app/data/custom.db
GROQ_API_KEY=gsk_tu_api_key_aqui
NODE_ENV=production
PORT=3000
```

> **Cómo conseguir una Groq API key gratis**:
> 1. Ve a https://console.groq.com/keys
> 2. Crea una cuenta (gratis, sin tarjeta de crédito)
> 3. Click "Create API Key"
> 4. Copia el valor que empieza con `gsk_`

> **Sin Groq API key**: el chat funciona igual, pero usa el SDK Z.ai que es más lento y tiene rate limits.

---

## 🚀 Paso 3: Construir y arrancar

Abre PowerShell en la carpeta del proyecto:

```powershell
cd C:\monday-ai
```

### Primera vez (construye la imagen Docker — tarda 5-10 minutos):
```powershell
docker-compose up --build
```

Verás logs como:
```
✓ Building...
✓ Creating monday-ai ...
✓ Attaching monday-ai ...
monday-ai  | === monday-AI Docker Startup ===
monday-ai  | → Creando base de datos SQLite...
monday-ai  | → Arrancando servidor Next.js en puerto 3000...
monday-ai  | ▲ Next.js 16.1.3
monday-ai  | - Local: http://localhost:3000
monday-ai  | ✓ Ready in 92ms
```

### Siguientes veces (ya construido — arranca en 2 segundos):
```powershell
# En background (detached)
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener
docker-compose down
```

---

## 🌐 Paso 4: Abrir en el navegador

Una vez que veas `✓ Ready`, abre:

```
http://localhost:3000
```

Verás el splash de **monday-AI** y luego la app completa.

---

## 🔧 Comandos útiles

| Acción | Comando |
|--------|---------|
| Arrancar en background | `docker-compose up -d` |
| Ver logs en tiempo real | `docker-compose logs -f` |
| Detener | `docker-compose down` |
| Reiniciar | `docker-compose restart` |
| Reconstruir (después de cambios) | `docker-compose up --build -d` |
| Ver estado | `docker-compose ps` |
| Entrar al contenedor (debug) | `docker exec -it monday-ai sh` |
| Borrar todo (incluida la DB) | `docker-compose down -v` |

---

## 🐛 Solución de problemas

### **El puerto 3000 ya está en uso**
Cambia el puerto en `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # usa 3001 en tu PC
```
Luego accede a `http://localhost:3001`

### **Docker Desktop no arranca**
- Verifica que WSL 2 esté activado: `wsl --status` en PowerShell como admin
- Reinicia Docker Desktop
- Si persiste: Settings → Resources → asegúrate de que tenga al menos 2GB de RAM asignados

### **El build falla por memoria**
Edita `docker-compose.yml` y aumenta `mem_limit`:
```yaml
mem_limit: 4g
```

### **La página carga pero el chat no responde**
- Verifica tu conexión a internet (el chat llama a APIs externas)
- Si tienes Groq API key, verifica que sea válida
- Revisa los logs: `docker-compose logs -f` y busca errores `[groq]` o `[zai]`

### **Quiero resetear la base de datos**
```powershell
docker-compose down -v
docker-compose up -d
```

### **Error: "permission denied" en docker-entrypoint.sh**
En PowerShell:
```powershell
# Convertir CRLF a LF
(Get-Content docker-entrypoint.sh -Raw) -replace "`r`n", "`n" | Set-Content docker-entrypoint.sh -NoNewline
```

---

## 📂 ¿Dónde se guardan mis datos?

La base de datos SQLite se persiste en un volumen Docker llamado `monday-ai-data`. Tus boards, items, agentes y configuraciones sobreviven a restarts del contenedor.

Para ver los datos desde Windows:
```powershell
docker volume inspect monday-ai_monday-ai-data
```

Para hacer backup:
```powershell
docker run --rm -v monday-ai_monday-ai-data:/data -v ${PWD}:/backup alpine tar czf /backup/backup.tar.gz -C /data .
```

---

## 🆕 Actualizar el código

Si modificas archivos del proyecto:

1. **Solo código frontend** (componentes, estilos):
   ```powershell
   docker-compose restart
   ```

2. **Cambios en package.json o prisma/schema.prisma**:
   ```powershell
   docker-compose up --build -d
   ```

3. **Borrar cache completo y rebuild**:
   ```powershell
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

---

## 📊 Consumo de recursos esperado

- **Build**: 2-4GB RAM, ~5 min
- **Runtime**: 200-500MB RAM
- **Disco**: ~1.5GB (imagen + datos)
- **CPU**: bajo en idle, picos durante el chat IA

---

## ✨ Funcionalidades que funcionan en local

✅ Todas las vistas (Tabla, Kanban, Calendario, Gantt, etc.)
✅ Crear/editar/eliminar boards, items, columnas, workspaces
✅ Sidekick IA con tool calling (crear items, buscar, etc.)
✅ Análisis de imágenes adjuntas (VLM con Z.ai)
✅ Importar Excel exportado de Monday.com
✅ Conectar tu Monday.com real (con API key)
✅ Agentes IA con triggers automáticos
✅ Automatizaciones
✅ Persistencia de datos entre restarts

---

## 🆘 ¿Problemas?

Si algo no funciona:

1. **Revisa los logs**: `docker-compose logs -f`
2. **Reinicia**: `docker-compose restart`
3. **Reconstruye**: `docker-compose up --build -d`
4. **Reset completo**: `docker-compose down -v && docker-compose up --build -d`

El sistema está diseñado para funcionar 100% en local sin internet (excepto las llamadas a APIs de IA que sí necesitan conexión).
