#!/usr/bin/env node

import dotenv from "dotenv";
import chalk from "chalk";
import figlet from "figlet";
import { Command } from "commander";
import { login, logout, whoami } from "./commands/auth/login.js";
import { wakeUp } from "./commands/ai/wakeUp.js";

dotenv.config();

async function main() {
  console.log(
    chalk.cyan(
      figlet.textSync("AI-Agent-by-JH", {
        font: "Standard",
        horizontalLayout: "default",
      }),
    ),
  );
  console.log(chalk.red("A cli based AI tool \n"));
  const program = new Command("AI-Agent");
  program
    .version("0.0.1")
    .description("AI-agent - Una CLI basado en una AI")
    .addCommand(login)
    .addCommand(logout)
    .addCommand(whoami)
    .addCommand(wakeUp);
  program.action(() => {
    program.help();
  });
  program.parse();
}

main().catch((error) => {
  console.log(chalk.red("Error al correr AI-agent CLI:"), error);
  process.exit(1);
});
