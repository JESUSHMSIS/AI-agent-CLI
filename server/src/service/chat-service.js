import prisma from "../lib/db.js";

export class ChatService {
  /**
   * Create new conversation
   * @param {string} userId
   * @param {string} mode
   * @param {string} title
   */
  async createConversation(userId, mode = "chat", title = null) {
    return prisma.conversation.create({
      data: {
        userId,
        mode,
        title: title || `Nueva ${mode} conversacion`,
      },
    });
  }

  /**
   * obtener o crear una nueva conversacion para el usuario
   * @param {string} userId
   * @param {string} conversationId
   * @param {string} mode
   * */
  async getOrCreateConversation(userId, conversationId = null, mode = "chat") {
    if (conversationId) {
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId,
        },
        include: {
          messages: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });
      if (conversation) return conversation;
    }
    return await this.createConversation(userId, mode);
  }

  /**
   * añadir un mensaje a la conversacion
   * @param {string} conversationId
   * @param {string} role
   * @param {string | object} content
   */
  async addMessage(conversationId, role, content) {
    const contStr =
      typeof content === "string" ? content : JSON.stringify(content);
    return await prisma.message.create({
      data: {
        conversationId,
        role,
        content: contStr,
      },
    });
  }

  /**
   * obtener conversaciones
   * @param {string} conversationId
   */
  async getMessages(conversationId) {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });
    return messages.map((msg) => ({
      ...msg,
      content: msg?.content ? this.parseContent(msg.content) : "",
    }));
  }

  /**
   * @param {string} userId
   */
  async getUserConversation(userId) {
    return await prisma.conversation.findMany({
      where: {
        userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  /**
   * Borrar conversaciones
   * @param {string} conversationId
   * @param {string} userId
   */
  async deleteConversation(conversationId, userId) {
    return await prisma.conversation.deleteMany({
      where: {
        id: conversationId,
        userId,
      },
    });
  }

  /**
   * Actualizar el titulo de la conversacion
   * @param {string} conversationId
   * @param {string} title
   */
  async updateTitle(conversationId, title) {
    return await prisma.conversation.update({
      where: { id: conversationId },
      data: { title },
    });
  }

  parseContent(content) {
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  }

  /**
   * @param {Array} messages
   */
  formatMessagesForAI(messages) {
    return messages.map((msg) => ({
      role: msg.role === "asistente" ? "assistant" : msg.role,
      content:
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content),
    }));
  }
}
