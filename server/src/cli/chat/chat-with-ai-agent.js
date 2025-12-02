import chalk from "chalk";
import boxen from "boxen";
import { text, isCancel, cancel, intro, outro, confirm } from "@clack/prompts";
import { AIService } from "../ai/google.service.js";
import { ChatService } from "../../service/chat-service.js";
import { getStoredToken } from "../../lib/token.js";
import prisma from "../../lib/db.js";
import { generateApplication as generateAplication } from "../../config/agent.config.js";

const aiService = new AIService();
const chatService = new ChatService();

async function getUserFromToken() {
  const token = await getStoredToken();
  if (!token?.access_token) {
    throw new Error(
      "No autenticado: Por favor ejecuta el comando 'AI-Agent login' primero",
    );
  }
  const user = await prisma.user.findFirst({
    where: {
      sessions: {
        some: { token: token.access_token },
      },
    },
  });
  if (!user) {
    throw new Error("Usuario no encontrado, por favor inicia sesion de nuevo.");
  }
  console.log(chalk.green(`\n Bienvenido de nuevo, ${user.name} \n`));
  return user;
}

async function initConversation(userId, conversationId = null) {
  const conversation = await chatService.getOrCreateConversation(
    userId,
    conversationId,
    "agent",
  );
  const conversationInfo = boxen(
    `${chalk.bold("Conversacion")}: ${conversation.title}\n` +
      `${chalk.gray("ID:")} ${conversation.id}\n` +
      `${chalk.gray("Modo:")} ${chalk.magenta("Agente (Code Generator)")}\n` +
      `${chalk.cyan("Directorio de trabajo: ")} ${process.cwd()}`,
    {
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: "cyan",
      title: "Modo Agente",
      titleAlignment: "center",
    },
  );
  console.log(conversationInfo);
  return conversation;
}

async function saveMessage(conversationId, role, content) {
  return await chatService.addMessage(conversationId, role, content);
}

async function agentLoop(conversation) {
  const helpbox = boxen(
    `${chalk.cyan.bold("Que puede hacer el Agente?")}\n\n` +
      `${chalk.gray("* Genera una aplicacion completa con solo darle una descripcion")}\n` +
      `${chalk.gray("* Crea todos los archivos necesarios para que la apliacion funcione")}\n` +
      `${chalk.gray("* Incluye las instrucciones de la configuracion y comandos")}\n` +
      `${chalk.gray("* Genera codigo listo para produccion")}\n` +
      `${chalk.yellow("Ejemplos:")}\n` +
      `${chalk.white("* Generar una aplicacion para una tienda de e-commerce")}\n` +
      `${chalk.white("* Genera una API REST con express y mongodb")}\n` +
      `${chalk.gray("Escribe 'exit' para terminar la session")}`,
    {
      padding: 1,
      margin: { bottom: 1 },
      borderStyle: "round",
      borderColor: "cyan",
      title: "Instrucciones de Agente",
    },
  );
  console.log(helpbox);

  while (true) {
    const userInput = await text({
      message: chalk.magenta("Que te gustaria construir?"),
      placeholder: "Describe tu aplicacion...",
      validate(value) {
        if (!value || value.trim().length === 0) {
          return "El mensaje no debe estar vacio";
        }
        if (value.trim().length < 10) {
          return "El mensaje debe tener al menos 10 caracteres";
        }
      },
    });

    if (isCancel(userInput)) {
      console.log(chalk.yellow("\n Sesion con agente cancelada\n"));
      process.exit(0);
    }

    if (userInput.toLowerCase() === "exit") {
      console.log(chalk.yellow("\n Sesion con agente terminado\n"));
      break;
    }

    // TODO EL CÓDIGO DE PROCESAMIENTO AHORA ESTÁ DENTRO DEL WHILE
    const userBox = boxen(chalk.white(userInput), {
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: "blue",
      title: "Tu",
      titleAlignment: "left",
    });
    console.log(userBox);

    await saveMessage(conversation.id, "user", userInput);

    try {
      const result = await generateAplication(
        userInput,
        aiService,
        process.cwd(),
      );

      if (result && result.success) {
        const responseMessage =
          `Aplicacion Generada: ${result.folderName}\n` +
          `Archivos Creados: ${result.files.length}\n` +
          `Ubicacion: ${result.appDir}\n\n` +
          `Comandos de Aplicacion:\n${result.commands.join("\n")}`;

        await saveMessage(conversation.id, "assistant", responseMessage);

        const successBox = boxen(chalk.green(responseMessage), {
          padding: 1,
          margin: { top: 1, bottom: 1 },
          borderStyle: "round",
          borderColor: "green",
          title: "Agente",
          titleAlignment: "left",
        });
        console.log(successBox);

        const continuePrompt = await confirm({
          message: chalk.cyan("Quisieras generar otra aplicacion?"),
          initialValue: false,
        });

        if (isCancel(continuePrompt) || !continuePrompt) {
          console.log(chalk.yellow("\nGenial! Revisa tu nueva aplicacion\n"));
          break; // Salir del while
        }
        // Si dice que sí, el while continúa y pregunta de nuevo
      } else {
        throw new Error("La generacion devolvio un error");
      }
    } catch (e) {
      console.log(chalk.red(`\n Error: ${e.message}\n`));
      await saveMessage(conversation.id, "assistant", `Error: ${e.message}`);

      const retry = await confirm({
        message: chalk.cyan("Quisieras intentar de nuevo?"),
        initialValue: true,
      });

      if (isCancel(retry) || !retry) {
        break; // Salir del while
      }
      // Si dice que sí, el while continúa y pregunta de nuevo
    }
  }
}

export async function startAgentChat(conversationId = null) {
  try {
    intro(
      boxen(
        chalk.bold.magenta("AI-Agent - Modo Agente\n\n") +
          chalk.gray("Generador de aplicaciones Autonomo"),
        {
          padding: 1,
          borderStyle: "double",
          borderColor: "magenta",
        },
      ),
    );

    const user = await getUserFromToken();

    const shouldContinue = await confirm({
      message: chalk.yellow(
        "El agente creara carpetas y archivos en tu directorio actual, continuar?",
      ),
      initialValue: true,
    });

    if (isCancel(shouldContinue) || !shouldContinue) {
      cancel(chalk.yellow("Modo agente cancelado"));
      process.exit(0);
    }

    const conversation = await initConversation(user.id, conversationId);
    await agentLoop(conversation);

    outro(chalk.green.bold("\n Gracias por usar el Modo Agente"));
  } catch (e) {
    const errorBox = boxen(chalk.red(`Error: ${e.message}`), {
      padding: 1,
      margin: 1,
      borderStyle: "round",
      borderColor: "red",
    });
    console.log(errorBox);
    process.exit(1);
  }
}
