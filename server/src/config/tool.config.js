import { google } from "@ai-sdk/google";
import chalk from "chalk";

export const availableTools = [
  {
    id: "google_search",
    name: "Google Search",
    description:
      "Accede a la ultima informacion usando el buscador de google. Util para nuevos eventos , y informacion en tiempo real",
    getTool: () => google.tools.googleSearch({}),
    enabled: false,
  },
  {
    id: "code_execution",
    name: "Code Execution",
    description:
      "Genera y ejecuta codigo en cualquier lenguaje de la mejor manera para calculos, resolver problemas, o preveer informacion de calidad",
    getTool: () => google.tools.codeExecution({}),
    enabled: false,
  },
  {
    id: "url_context",
    name: "Url Context",
    description:
      "Proveer Urls especificas que tu quieras que analize el modelo directamente desde el prompt. Soporta hasta 20 Urls por peticion",
    getTool: () => google.tools.urlContext({}),
    enabled: false,
  },
];

export function getEnabledTools() {
  const tools = {};
  try {
    for (const toolConfig of availableTools) {
      if (toolConfig.enabled) {
        tools[toolConfig.id] = toolConfig.getTool();
      }
    }
    if (Object.keys(tools).length > 0) {
      console.log(
        chalk.gray(
          `[DEBUG] Herramienta activada: ${Object.keys(tools).join(", ")}`,
        ),
      );
    } else {
      console.log(chalk.yellow(`[DEBUG] Herramienta no activada`));
    }
    return Object.keys(tools).length > 0 ? tools : undefined;
  } catch (e) {
    console.log(
      chalk.red(`[ERROR] Fallo al iniciar la herramienta`),
      e.message,
    );
    console.log(
      chalk.yellow(
        `Asegurate de que tengas @ai-sdk/google version 2.0+ instalado`,
      ),
    );
    console.log(chalk.yellos(`Corre: npm i @ai-sdk/google@latest`));
    return undefined;
  }
}

export function toogleTool(toolId) {
  const tool = availableTools.find((t) => t.id === toolId);
  if (tool) {
    tool.enabled = !tool.enabled;
    console.log(
      chalk.gray(
        `[DEBUG] Herramienta ${toolId} seleccionada y ${tool.enabled}`,
      ),
    );
    return tool.enabled;
  }
  console.log(chalk.red(`[ERROR] Herramienta ${toolId} no encontrada`));
  return false;
}

export function activateTool(toolIds) {
  console.log(chalk.gray(`[DEBUG] Herramientas activadas con:`), toolIds);
  availableTools.forEach((tool) => {
    const wasEnabled = tool.enabled;
    tool.enabled = toolIds.includes(tool.id);
    if (tool.enabled !== wasEnabled) {
      console.log(
        chalk.gray(`[DEBUG] ${tool.id}: ${wasEnabled} -> ${tool.enabled} `),
      );
    }
  });
  const enabledCount = availableTools.filter((t) => t.enabled).length;
  console.log(
    chalk.gray(
      `[DEBUG] Total de herramientas activadas:${enabledCount}/${availableTools.length} `,
    ),
  );
}

export function getEnabledToolNames() {
  const names = availableTools.filter((t) => t.enabled).map((t) => t.name);
  console.log(chalk.gray(`[DEBUG] getEnabledToolNames te devuelve:`), names);
  return names;
}
export function resetTools() {
  availableTools.forEach((tool) => {
    tool.enabled = false;
  });
  console.log(
    chalk.gray(`[DEBUG] Todas las herramientas reseteadas (desactivadas)`),
  );
}
