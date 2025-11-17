import chalk from "chalk";
import boxen from "boxen";
import { text, isCancel, cancel, intro, outro } from "@clack/prompts";
import yoctoSpinner from "yocto-spinner";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import { AIService } from "../ai/google.service.js";
import { ChatService } from "../../service/chat-service.js";
import prisma from "../../lib/db.js";
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
    string: chalk.bold,
    em: chalk.italic,
    codespan: chalk.yellow.bgBlack,
    del: chalk.gray.strikethrough,
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
async function initConversation(userId, conversationId = null, mode = "chat") {
  const spinner = yoctoSpinner({ text: "Cargando conversacion..." }).start();
  const conversation = await chatService.getOrCreateConversation(
    userId,
    conversationId,
    mode,
  );
  spinner.success("conversacion cargado");
  const conversacionInfo = boxen(
    `${chalk.bold("conversacion")}: ${conversation.title}\n${chalk.gray("ID: " + conversation.id)}\n${chalk.gray("Modo: " + conversation.mode)}`,
    {
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: "cyan",
      title: "Sesion de chat",
      titleAlignment: "center",
    },
  );
  console.log(conversacionInfo);
  if (conversation.messages?.length > 0) {
    console.log(chalk.yellow("Mensajes anteriores:\n"));
    displayMessage(conversation.messages);
  }
  return conversation;
}

function displayMessage(messages) {
  messages.forEach((msg) => {
    if (msg.role === "user") {
      const userBox = boxen(chalk.white(msg.content), {
        padding: 1,
        margin: { left: 2, bottom: 1 },
        borderStyle: "round",
        borderColor: "blue",
        title: "Tu",
        titleAlignment: "left",
      });
      console.log(userBox);
    } else {
      const renderedContent = marked.parse(msg.content);
      const assistandBox = boxen(renderedContent.trim(), {
        padding: 1,
        margin: { left: 2, bottom: 1 },
        borderStyle: "round",
        borderColor: "green",
        title: "Asistente",
        titleAlignment: "left",
      });
      console.log(assistandBox);
    }
  });
}

async function saveMessage(conversationId, role, content) {
  return await chatService.addMessage(conversationId, role, content);
}

async function getAIResponse(conversationId) {
  const spinner = yoctoSpinner({
    text: "Esta pensando la AI",
    color: "cyan",
  }).start();
  const dbMessages = await chatService.getMessages(conversationId);
  const aiMessages = chatService.formatMessagesForAI(dbMessages);
  let fullResponse = "";
  let isFirstChunk = true;
  try {
    const result = await aiService.sendMessage(aiMessages, (chunk) => {
      if (isFirstChunk) {
        spinner.stop();
        console.log("\n");
        const header = chalk.green.bold("Asistente:");
        console.log(header);
        console.log(chalk.gray("-".repeat(60)));
        isFirstChunk = false;
      }
      fullResponse += chunk;
    });
    console.log("\n");
    const rendererMarkdown = marked.parse(fullResponse);
    console.log(rendererMarkdown);
    console.log(chalk.gray("-".repeat(60)));
    console.log("\n");

    return result.content;
  } catch (e) {
    spinner.error("Algo fallo al obtener la respuesta de la AI");
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
  const helpBox = boxen(
    `${chalk.gray("*Escribe tu mensaje y presiona enter")}\n${chalk.gray("* Escribe 'exit' para finalizar la conversacion")}\n${chalk.gray("* Presiona Ctrl+C para salir en cualquier momento")}`,
    {
      padding: 1,
      margin: { bottom: 1 },
      borderStyle: "round",
      borderColor: "gray",
      dimBorder: true,
    },
  );
  console.log(helpBox);
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
    if (userInput?.toLowerCase() === "exit") {
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
    await saveMessage(conversation.id, "user", userInput);

    const messages = await chatService.getMessages(conversation.id);
    const aiResponse = await getAIResponse(conversation.id);
    await saveMessage(conversation.id, "asistente", aiResponse);

    await updateConversationTitle(conversation.id, userInput, messages.length);
  }
}
// ... (resto del código igual hasta el catch final)

export async function startChat(mode = "chat", conversationId = null) {
  try {
    intro(
      boxen(chalk.bold.cyan("AI Agent Chat"), {
        padding: 1,
        borderStyle: "double",
        borderColor: "cyan",
      }),
    );
    const user = await getUserFromToken();
    const conversation = await initConversation(user.id, conversationId, mode);
    await chatLoop(conversation);
    outro(chalk.green("Gracias por escribir"));
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
