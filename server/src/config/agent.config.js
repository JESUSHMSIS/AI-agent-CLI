import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);

const AGENT_SYSTEM_PROMPT = `Eres un ingeniero de software experto especializado en crear aplicaciones completas y listas para producción a partir de descripciones.

Tu tarea es generar una aplicación completa con todos los archivos necesarios, dependencias e instrucciones de configuración.

INSTRUCCIONES CRÍTICAS:
1. Genera TODOS los archivos necesarios para que la aplicación funcione
2. Incluye package.json, README.md y cualquier archivo de configuración
3. Proporciona comandos bash para configuración y ejecución
4. Formatea tu respuesta usando esta ESTRUCTURA EXACTA:

\`\`\`STRUCTURE
nombre-carpeta/
├── archivo1.ext
├── archivo2.ext
└── subcarpeta/
    └── archivo3.ext
\`\`\`

Luego, para cada archivo, usa este formato:

\`\`\`file:nombre-carpeta/archivo1.ext
[contenido del archivo aquí]
\`\`\`

\`\`\`file:nombre-carpeta/archivo2.ext
[contenido del archivo aquí]
\`\`\`

Finalmente, proporciona los comandos bash en este formato (IMPORTANTE: NO REPITAS comandos, escribe cada comando UNA SOLA VEZ):

\`\`\`bash
# Navegar al proyecto
cd nombre-carpeta

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
\`\`\`

REGLAS IMPORTANTES:
- Crea un nombre de carpeta descriptivo y significativo (usa kebab-case)
- Incluye TODAS las dependencias en package.json con versiones correctas
- Código limpio, bien comentado y listo para producción
- Proporciona aplicaciones completas y funcionales (sin placeholders!)
- Incluye manejo de errores y validación de entrada
- Agrega README apropiado con instrucciones claras
- Usa prácticas modernas de JavaScript/TypeScript
- Incluye .gitignore y otros archivos de configuración
- Asegúrate de que todos los imports y paths sean correctos
- Verifica que el código realmente funcionaría
- NO REPITAS COMANDOS - cada comando debe aparecer una sola vez en el bloque bash

EJEMPLO DE FORMATO DE SALIDA:

\`\`\`STRUCTURE
todo-app/
├── package.json
├── README.md
├── .gitignore
├── index.html
└── src/
    ├── App.jsx
    └── main.jsx
\`\`\`

\`\`\`file:todo-app/package.json
{
  "name": "todo-app",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite"
  },
  "dependencies": {
    "react": "^18.2.0"
  }
}
\`\`\`

\`\`\`file:todo-app/README.md
# Todo App
Aplicación de tareas sencilla...
\`\`\`

\`\`\`bash
# Navegar al proyecto
cd todo-app

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
\`\`\`

Recuerda: Genera código COMPLETO y FUNCIONAL. Sin TODOs ni placeholders! Y NO REPITAS comandos.`;

function printSystem(message) {
  console.log(message);
}

function printAssistantStart() {
  console.log(chalk.magenta("\n🤖 Respuesta del Agente:\n"));
}

function printAssistantChunk(chunk) {
  process.stdout.write(chalk.gray(chunk));
}

function printAssistantEnd() {
  console.log(chalk.magenta("\n\n─────────────────────────────────────\n"));
}

/**
 * Parsear contenido de archivos desde la respuesta de la IA
 * Maneja formatos ```file:path y ```filename
 */
function parseFilesFromResponse(response) {
  const files = [];

  const fileRegex1 = /```file:([^\n]+)\n([\s\S]*?)```/g;
  let match;

  while ((match = fileRegex1.exec(response)) !== null) {
    const filePath = match[1].trim();
    const content = match[2].trim();

    // Saltar si parece un bloque bash
    if (!filePath.includes("bash")) {
      files.push({ path: filePath, content });
    }
  }

  // Formato alternativo: bloques de código con paths en comentarios
  // Ejemplo: ```javascript // src/App.jsx
  const fileRegex2 = /```(\w+)\s*(?:\/\/|#)\s*([^\n]+)\n([\s\S]*?)```/g;

  while ((match = fileRegex2.exec(response)) !== null) {
    const language = match[1].trim();
    const filePath = match[2].trim();
    const content = match[3].trim();

    // Solo agregar si no existe ya y parece un path de archivo
    if (filePath.includes("/") || filePath.includes(".")) {
      const exists = files.some((f) => f.path === filePath);
      if (!exists) {
        files.push({ path: filePath, content });
      }
    }
  }

  return files;
}

/**
 * Parsear comandos bash desde la respuesta de la IA
 * Elimina duplicados y comentarios
 */
function parseBashCommands(response) {
  const commandsSet = new Set(); // Usar Set para evitar duplicados
  const bashRegex = /```bash\n([\s\S]*?)```/g;
  let match;

  while ((match = bashRegex.exec(response)) !== null) {
    const commandBlock = match[1].trim();

    // Dividir por líneas y filtrar líneas vacías y comentarios puros
    const lines = commandBlock
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => {
        // Filtrar líneas vacías
        if (!line) return false;
        // Filtrar comentarios puros
        if (line.startsWith("#")) return false;
        return true;
      });

    // Agregar al Set (automáticamente elimina duplicados)
    lines.forEach((cmd) => commandsSet.add(cmd));
  }

  // Convertir Set a Array
  return Array.from(commandsSet);
}

/**
 * Obtener nombre de carpeta desde estructura o archivos
 */
function getFolderName(response, files) {
  // Intentar extraer del bloque STRUCTURE
  const structureMatch = response.match(/```STRUCTURE\n([\s\S]*?)```/);
  if (structureMatch) {
    const firstLine = structureMatch[1].trim().split("\n")[0];
    const folderMatch = firstLine.match(/^([a-z0-9-_]+)\//i);
    if (folderMatch) {
      return folderMatch[1];
    }
  }

  // Extraer del path del primer archivo
  if (files.length > 0) {
    const parts = files[0].path.split("/");
    if (parts.length > 1) {
      return parts[0];
    }
  }

  // Generar nombre basado en timestamp como fallback
  const timestamp = new Date().getTime();
  return `app-${timestamp}`;
}

/**
 * Crear aplicación desde la respuesta de la IA
 */
async function createApplicationFiles(baseDir, folderName, files) {
  const appDir = path.join(baseDir, folderName);

  // Crear directorio principal
  await fs.mkdir(appDir, { recursive: true });
  printSystem(chalk.cyan(`📁 Directorio creado: ${folderName}/`));

  // Escribir todos los archivos
  for (const file of files) {
    // Remover prefijo de carpeta si existe en el path
    let relativePath = file.path;
    if (relativePath.startsWith(folderName + "/")) {
      relativePath = relativePath.substring(folderName.length + 1);
    }

    const filePath = path.join(appDir, relativePath);
    const fileDir = path.dirname(filePath);

    // Crear estructura de directorios si es necesario
    await fs.mkdir(fileDir, { recursive: true });

    // Escribir archivo
    await fs.writeFile(filePath, file.content, "utf8");
    printSystem(chalk.green(`  ✓ ${relativePath}`));
  }

  return appDir;
}

/**
 * Mostrar árbol de estructura de archivos
 */
function displayFileTree(files, folderName) {
  printSystem(chalk.cyan("\n📂 Estructura del Proyecto:"));
  printSystem(chalk.white(`${folderName}/`));

  // Agrupar archivos por directorio
  const filesByDir = {};
  files.forEach((file) => {
    let relativePath = file.path;
    if (relativePath.startsWith(folderName + "/")) {
      relativePath = relativePath.substring(folderName.length + 1);
    }

    const parts = relativePath.split("/");
    const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";

    if (!filesByDir[dir]) {
      filesByDir[dir] = [];
    }
    filesByDir[dir].push(parts[parts.length - 1]);
  });

  // Mostrar árbol
  Object.keys(filesByDir)
    .sort()
    .forEach((dir) => {
      if (dir) {
        printSystem(chalk.white(`├── ${dir}/`));
        filesByDir[dir].forEach((file) => {
          printSystem(chalk.white(`│   └── ${file}`));
        });
      } else {
        filesByDir[dir].forEach((file) => {
          printSystem(chalk.white(`├── ${file}`));
        });
      }
    });
}

/**
 * Generar aplicación usando modo agente
 */
export async function generateApplication(
  description,
  aiService,
  cwd = process.cwd(),
) {
  try {
    printSystem(chalk.cyan("\n🤖 Modo Agente: Generando tu aplicación...\n"));
    printSystem(chalk.gray(`Solicitud: ${description}\n`));

    // Crear array de mensajes
    const messages = [
      {
        role: "user",
        content: `Crea una aplicación completa para: ${description}\n\nRecuerda seguir el formato EXACTO con bloque STRUCTURE, bloques file: y bloque bash. IMPORTANTE: No repitas comandos en el bloque bash.`,
      },
    ];

    // Obtener respuesta de la IA con prompt del sistema
    let response = "";

    printAssistantStart();

    try {
      const result = await aiService.sendMessage(
        [{ role: "system", content: AGENT_SYSTEM_PROMPT }, ...messages],
        (chunk) => {
          response += chunk;
          printAssistantChunk(chunk);
        },
      );

      response = result.content || response;
      printAssistantEnd();
    } catch (err) {
      printAssistantEnd();
      throw new Error(`Generación de IA falló: ${err.message}`);
    }

    // Parsear archivos y comandos
    const files = parseFilesFromResponse(response);
    const bashCommands = parseBashCommands(response);
    const folderName = getFolderName(response, files);

    if (files.length === 0) {
      printSystem(
        chalk.yellow("\n⚠️  No se encontraron archivos en la respuesta."),
      );
      printSystem(
        chalk.yellow("La IA podría no haber seguido el formato requerido.\n"),
      );
      printSystem(
        chalk.dim(
          "Formato esperado: ```file:carpeta/archivo.ext\n[contenido]\n```\n",
        ),
      );
      printSystem(chalk.dim("Vista previa de respuesta sin procesar:\n"));
      printSystem(chalk.dim(response.substring(0, 800) + "...\n"));

      // Guardar respuesta completa en un archivo para debugging
      const debugFile = path.join(cwd, "agent-debug-response.txt");
      await fs.writeFile(debugFile, response, "utf8");
      printSystem(chalk.dim(`Respuesta completa guardada en: ${debugFile}\n`));

      return null;
    }

    printSystem(
      chalk.green(
        `\n✅ Se parsearon ${files.length} archivo(s) de la respuesta de la IA\n`,
      ),
    );

    // Mostrar árbol de archivos
    displayFileTree(files, folderName);

    // Crear directorio de aplicación y archivos
    printSystem(chalk.cyan("\n📝 Creando archivos...\n"));
    const appDir = await createApplicationFiles(cwd, folderName, files);

    // Mostrar resultados
    printSystem(chalk.green.bold(`\n✨ ¡Aplicación creada exitosamente!\n`));
    printSystem(chalk.cyan(`📁 Ubicación: ${chalk.bold(appDir)}\n`));

    // Mostrar comandos bash (sin duplicados)
    if (bashCommands.length > 0) {
      printSystem(chalk.cyan("📋 Siguientes Pasos:\n"));
      printSystem(chalk.white("```bash"));
      bashCommands.forEach((cmd) => {
        printSystem(chalk.white(cmd));
      });
      printSystem(chalk.white("```\n"));
    } else {
      printSystem(
        chalk.yellow(
          "⚠️  No se encontraron comandos de configuración en la respuesta\n",
        ),
      );
      printSystem(
        chalk.gray("Puede que necesites configurar el proyecto manualmente\n"),
      );
    }

    return {
      folderName,
      appDir,
      files: files.map((f) => f.path),
      commands: bashCommands,
      success: true,
    };
  } catch (err) {
    printSystem(
      chalk.red(`\n❌ Error al generar la aplicación: ${err.message}\n`),
    );
    if (err.stack) {
      printSystem(chalk.dim(err.stack + "\n"));
    }
    throw err;
  }
}
