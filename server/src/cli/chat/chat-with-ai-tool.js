import chalk from "chalk";
import boxen from "boxen";
import {
  text,
  isCancel,
  cancel,
  intro,
  outro,
  multiselect,
} from "@clack/prompts";
import yoctoSpinner from "yocto-spinner";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import { AIService } from "../ai/google.service.js";
import { ChatService } from "../../service/chat-service.js";
import prisma from "../../lib/db.js";
import {
  availableTools,
  getEnabledTools,
  resetTools,
  activateTool,
  getEnabledToolNames,
} from "../../config/tool.config.js";
import { getStoredToken } from "../../lib/token.js";

marked.use(
  markedTerminal({
    code: chalk.cyan,
    blockquote: chalk.gray.italic,
    heading: chalk.green.bold,
    firstHeading: chalk.magenta.underline.bold,
    hr: chalk.reset,
    listitem: chalk.reset,
    list: chalk.reset,
    paragraph: chalk.reset,
    strong: chalk.bold,
    em: chalk.italic,
    codespan: chalk.yellow.bgBlack,
    del: chalk.dim.gray.strikethrough,
    link: chalk.blue.underline,
    href: chalk.blue.underline,
  }),
);

const aiService = new AIService();
const chatService = new ChatService();

async function getUserFromToken() {
  const token = await getStoredToken();
  if (!token?.access_token) {
    throw new Error("No estas autenticado, por favor inicia sesion primero");
  }
  const spinner = yoctoSpinner({ text: "autenticando..." }).start();
  const user = await prisma.user.findFirst({
    where: {
      sessions: {
        some: {
          token: token.access_token,
        },
      },
    },
  });

  if (!user) {
    spinner.error("Usuario no encontrado");
    throw new Error("usuario no encontrado, por favor inicia sesion de nuevo.");
  }
  spinner.success(`Bienvenido de nuevo, ${user.name}`);
  return user;
}

async function selectTools() {
  const toolsOptions = availableTools.map((tool) => ({
    value: tool.id,
    label: tool.name,
    hint: tool.description,
  }));
  const selectedTools = await multiselect({
    message:
      "Seleccione las herramientas que desea usar (Espacio para seleccionar, Enter para confirmar)",
    options: toolsOptions,
    required: false,
  });
  if (isCancel(selectedTools)) {
    cancel(chalk.yellow("Herramienta no seleccionada"));
    process.exit(0);
  }
  activateTool(selectedTools);
  if (selectedTools.length === 0) {
    console.log(
      chalk.yellow(
        `\n Ninguna herramienta seleccionada. AI trabajara sin herramientas. \n`,
      ),
    );
  } else {
    const toolsBox = boxen(
      chalk.green(
        `Herramienta activada:\n${selectedTools
          .map((id) => {
            const tool = availableTools.find((t) => t.id === id);
            return ` -${tool.name}`;
          })
          .join("\n")}`,
      ),
      {
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderStyle: "round",
        borderColor: "green",
        title: "Herramientas Activadas",
        titleAlignment: "center",
      },
    );
    console.log(toolsBox);
  }
  return selectTools.length > 0;
}

async function initConversation(userId, conversationId = null, mode = "tool") {
  const spinner = yoctoSpinner({ text: "Cargando conversacion..." }).start();
  const conversation = await chatService.getOrCreateConversation(
    userId,
    conversationId,
    mode,
  );
  spinner.success("Conversacion Cargada");

  const enabledToolName = getEnabledToolNames();
  const toolDisplay =
    enabledToolName.length > 0
      ? `\n${chalk.gray("Activar Herramientas:")} ${enabledToolName.join(", ")}`
      : `\n${chalk.gray("Ninguna herramienta activada")}`;
  const conversationInfo = boxen(
    `${chalk.bold("Conversacion")}: ${conversation.title}\n${chalk.gray("ID: " + conversation.id)}\n${chalk.gray("Modo: " + conversation.mode)}${toolDisplay}`,
    {
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: "cyan",
      title: "Sesion de chat",
      titleAlignment: "center",
    },
  );
  console.log(conversationInfo);
  if (conversation.message?.length > 0) {
    console.log(chalk.yellow("Mensajes anteriores:\n"));
    displayMessages(conversation.message);
  }
  return conversation;
}

function displayMessages(messages) {
  messages.forEach((msg) => {
    if (msg.role === "user") {
      const userBolx = boxen(chalk.white(msg.content), {
        padding: 1,
        margin: { left: 2, bottom: 1 },
        borderStyle: "round",
        borderColor: "blue",
        title: "Tu",
        titleAlignment: "left",
      });
      console.log(userBolx);
    } else if (msg.role === "assistant") {
      const renderedContent = marked.parse(msg.content);
      const assistantBox = boxen(renderedContent.trim(), {
        padding: 1,
        margin: { left: 2, bottom: 1 },
        borderStyle: "round",
        borderColor: "green",
        title: "Asistente",
        titleAlignment: "left",
      });
      console.log(assistantBox);
    }
  });
}

async function saveMessage(conversationId, role, content) {
  return await chatService.addMessage(conversationId, role, content);
}

async function getAIResponse(conversationId) {
  const spinner = yoctoSpinner({
    text: "Generando respuesta...",
    color: "cyan",
  }).start();
  const dbMessages = await chatService.getMessages(conversationId);
  const aiMessage = chatService.formatMessagesForAI(dbMessages);
  const tools = getEnabledTools();
  let fullResponse = "";
  let isFirstChunk = true;
  const toolCallsDetected = [];
  try {
    const result = await aiService.sendMessage(
      aiMessage,
      (chunk) => {
        if (isFirstChunk) {
          spinner.stop();
          console.log("\n");
          const header = chalk.green.bold("Asistente:");
          console.log(header);
          console.log(chalk.gray("-".repeat(60)));
          isFirstChunk = false;
        }
        fullResponse += chunk;
      },
      tools,
      (toolCall) => {
        toolCallsDetected.push(toolCall);
      },
    );

    if (toolCallsDetected.length > 0) {
      console.log("\n");
      const toolsCallBox = boxen(
        toolCallsDetected
          .map(
            (tc) =>
              `${chalk.cyan("Herramienta:")} ${tc.toolName}\n${chalk.gray("Args:")} ${JSON.stringify(tc.args, null, 2)}`,
          )
          .join("\n\n"),
        {
          padding: 1,
          margin: 1,
          borderStyle: "round",
          borderColor: "cyan",
          title: "Herramientas Activadas",
        },
      );
      console.log(toolsCallBox);
    }
    if (result.toolResult && result.toolResult.length > 0) {
      const toolResultBox = boxen(
        result.toolResult
          .map(
            (tr) =>
              `${chalk.green("Herramienta:")} ${tr.toolName}\n${chalk.gray("Result:")} ${JSON.stringify(tr.result, null, 2).slice(0, 100)}...`,
          )
          .join("\n\n"),
        {
          padding: 1,
          margin: 1,
          borderStyle: "round",
          borderColor: "green",
          title: "Resultados de Herramientas",
        },
      );
      console.log(toolResultBox);
    }

    console.log("\n");
    const rendererMarkdown = marked.parse(fullResponse);
    console.log(rendererMarkdown);
    console.log(chalk.gray("-".repeat(60)));
    console.log("\n");

    return result.content;
  } catch (e) {
    spinner.error("Error al generar la respuesta");
    throw e;
  }
}
async function updateConversationTitle(
  conversationId,
  userInput,
  messageCount,
) {
  if (messageCount === 1) {
    const title = userInput.slice(0, 50) + (userInput.length > 50 ? "..." : "");
    await chatService.updateTitle(conversationId, title);
  }
}

async function chatLoop(conversation) {
  const enabledToolName = getEnabledToolNames();
  const helpbox = boxen(
    `${chalk.gray("- Escribe tu mensaje y presiona Enter")}\n${chalk.gray("- Ai tiene acceso a:")} ${enabledToolName.length > 0 ? enabledToolName.join(", ") : "ninguna herramienta activada"}\n${chalk.gray("- Escribe 'exit' para finalizar la conversacion")}\n${chalk.gray("- Presiona Ctrl+C para salir en cualquier momento")}`,
    {
      padding: 1,
      margin: { bottom: 1 },
      borderStyle: "round",
      borderColor: "gray",
      dimBorder: true,
    },
  );
  console.log(helpbox);
  while (true) {
    const userInput = await text({
      message: chalk.blue("Tu mensaje"),
      placeholder: "Escribe tu mensaje....",
      validate(value) {
        if (!value || value.trim().length === 0) {
          return "El mensaje no debe estar vacio";
        }
      },
    });
    if (isCancel(userInput)) {
      const exitBox = boxen(
        chalk.yellow("La interaccion con el chat termino, adios"),
        {
          padding: 1,
          margin: 1,
          borderStyle: "round",
          borderColor: "yellow",
        },
      );
      console.log(exitBox);
      process.exit(0);
    }
    if (userInput.toLowerCase() === "exit") {
      const exitBox = boxen(
        chalk.yellow("La interaccion con el chat termino, adios"),
        {
          padding: 1,
          margin: 1,
          borderStyle: "round",
          borderColor: "yellow",
        },
      );
      console.log(exitBox);
      break;
    }
    const userBox = boxen(chalk.white(userInput), {
      padding: 1,
      margin: { left: 2, top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: "blue",
      title: "Tu",
      titleAlignment: "left",
    });
    console.log(userBox);
    await saveMessage(conversation.id, "user", userInput);

    const messages = await chatService.getMessages(conversation.id);
    const aiResponse = await getAIResponse(conversation.id);
    await saveMessage(conversation.id, "asistente", aiResponse);

    await updateConversationTitle(conversation.id, userInput, messages.length);
  }
}
export async function startToolChat(conversationId = null) {
  try {
    intro(
      boxen(chalk.bold.cyan("AI-AGENT - Modo llamada herramienta"), {
        padding: 1,
        borderStyle: "double",
        borderColor: "cyan",
      }),
    );
    const user = await getUserFromToken();
    await selectTools();
    const conversation = await initConversation(
      user.id,
      conversationId,
      "tool",
    );
    await chatLoop(conversation);
    resetTools();
    outro(chalk.green("Gracias por usar la herramienta"));
  } catch (e) {
    const errorBox = boxen(chalk.red(`Error: ${e.message}`), {
      padding: 1,
      margin: 1,
      borderStyle: "round",
      borderColor: "red",
    });
    console.log(errorBox);
    resetTools();
    process.exit(1);
  }
}
