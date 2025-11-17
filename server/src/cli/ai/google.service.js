import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { config } from "../../config/google.config.js";
import chalk from "chalk";

export class AIService {
  constructor() {
    if (!config.googleApiKey) {
      throw new Error("GOOGLE_API_KEY is not set in env");
    }
    this.model = google(config.model || "gemini-1.5-pro-latest", {
      apiKey: config.googleApiKey,
    });
  }

  /**
   * Send a message and get streaming response
   * @param {Array} messages
   * @param {Function} onChunk
   * @param {Object} tools
   * @param {Function} onToolCall
   * @returns {Promise<Object>}
   * */
  async sendMessage(messages, onChunk, tools = undefined, onToolCall = null) {
    try {
      const streamConfig = {
        model: this.model,
        messages: messages,
      };

      if (tools) {
        streamConfig.tools = tools;
      }

      const result = await streamText(streamConfig);
      let fullResponse = "";

      for await (const chunk of result.textStream) {
        fullResponse += chunk;
        if (onChunk) {
          onChunk(chunk);
        }
      }

      const finalResult = await result;

      return {
        content: fullResponse,
        finishReason: finalResult.finishReason,
        usage: finalResult.usage,
      };
    } catch (error) {
      console.error(chalk.red("Servicio de AI tuvo un error:"), error.message);
      throw error;
    }
  }

  /**
   * @param {Array} messages
   * @param {Object} tools
   * @returns {Promise<string>}
   * */
  async getMessage(messages, tools = undefined) {
    let fullResponse = "";
    await this.sendMessage(
      messages,
      (chunk) => {
        fullResponse += chunk;
      },
      tools,
    );
    return fullResponse;
  }
}
