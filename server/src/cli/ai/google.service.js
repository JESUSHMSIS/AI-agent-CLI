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

      if (tools && Object.keys(tools).length > 0) {
        streamConfig.tools = tools;
        streamConfig.maxSteps = 5;
        console.log(
          chalk.gray(
            `[DEBUG] Herramienta activada: ${Object.keys(tools).join(", ")}`,
          ),
        );
      }

      const result = await streamText(streamConfig);
      let fullResponse = "";

      for await (const chunk of result.textStream) {
        fullResponse += chunk;
        if (onChunk) {
          onChunk(chunk);
        }
      }

      const finalResult = result;

      const toolCalls = [];
      const toolResults = [];

      if (finalResult.steps && Array.isArray(finalResult.steps)) {
        for (const step of finalResult.steps) {
          if (step.toolCalls && step.toolCalls.length > 0) {
            for (const toolCall of step.toolCalls) {
              toolCalls.push(toolCall);
              if (toolCall) {
                onToolCall(toolCall);
              }
            }
          }
          if (step.toolResults && stem.toolResults.length > 0) {
            toolResults.push(...step.toolResults);
          }
        }
      }

      return {
        content: fullResponse,
        finishReason: finalResult.finishReason,
        usage: finalResult.usage,
        toolCalls,
        toolResults,
        steps: finalResult.steps,
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
    const result = await this.sendMessage(
      messages,
      (chunk) => {
        fullResponse += chunk;
      },
      tools,
    );
    return result.content;
  }
}
