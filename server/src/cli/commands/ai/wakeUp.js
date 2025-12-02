import chalk from "chalk";
import { Command } from "commander";
import yoctoSpinner from "yocto-spinner";
import prisma from "../../../lib/db.js";
import { select } from "@clack/prompts";
import { getStoredToken } from "../../../lib/token.js";
import { startChat } from "../../chat/chat-with-ai.js";
import { startToolChat } from "../../chat/chat-with-ai-tool.js";
import { startAgentChat } from "../../chat/chat-with-ai-agent.js";
const wakeUpAction = async () => {
  const token = await getStoredToken();
  if (!token?.access_token) {
    console.log(chalk.red("No estas autorizado, por favor inicia sesion"));
    return;
  }
  const spinner = yoctoSpinner({ text: "Obteniendo informacion del usuario" });
  spinner.start();
  const user = await prisma.user.findFirst({
    where: {
      sessions: {
        some: {
          token: token?.access_token,
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  });
  spinner.stop();
  if (!user) {
    console.log(chalk.red("Usuario no encontrado"));
    return;
  }
  console.log(chalk.green(`Bienvenido de nuevo, ${user.name}!\n`));
  const choice = await select({
    message: "Selecciona una opcion",
    options: [
      {
        value: "chat",
        label: "Chat",
        hint: "Un chat simple con AI",
      },
      {
        value: "tool",
        label: "Llamar a herramienta",
        hint: "Chat con herramientas (busqueda,ejecucion de codigo)",
      },
      {
        value: "agent",
        label: "Agente",
        hint: "Agente con AI avanzado (proximamente)",
      },
    ],
  });
  switch (choice) {
    case "chat":
      await startChat("chat");
      break;
    case "tool":
      await startToolChat();
      break;
    case "agent":
      await startAgentChat();
      break;
  }
};
export const wakeUp = new Command("wakeup")
  .description("Esta activo la Ai")
  .action(wakeUpAction);
