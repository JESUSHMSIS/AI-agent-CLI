import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { config } from "../../config/google.config";
import chalk from "chalk";

export class AIService {
  constructor() {
    if (!config.googleApiKey) {
      throw new Error("GOOGLE_API_KEY is not set in env");
    }
    this.model = google(google.model, {
      apiKey: config.googleApiKey,
    });
  }
  /**
   * Send a message and get streaming responder
   * @param {Array} messages
   * @param {Function} onChunk
   * @param {Object} tools
   * @param {Function} onToolCall
   * @returns {Promise<Objetc>}
   * */
  async sendMessage(messages, onChunk, tools = undefined, onToolCall = null) {
    try {
      const streamConfig = {
        model: this.model,
        messages: messages,
      };
      const result = streamText(streamConfig);
      let fullResponse = "";
      for await (const chunk of result.textStream) {
        fullResponse += chunk;
        if (onChunk) {
          onChunk(chunk);
        }
      }
      const fullResult = result;
      return {
        content: fullResponse,
        finishResponse: fullResult.finishReason,
        usage: fullResult.usage,
      };
    } catch (error) {
      console.error(chalk.red("Servicio de AI tuvo un error"), error.message);
    }
  }
  /**
   * @param {Array} messages
   * @param {Object} tools
   * @returns {Promise<string>}
   * */
  async getMessage(messages, tools = undefined) {
    let fullResponse = "";
    await this.sendMessage(messages, (chunk) => {
      fullResponse += chunk;
    });
    return fullResponse;
  }
}
