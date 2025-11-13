import { cancel, confirm, intro, isCancel, outro } from "@clack/prompts";
import { logger } from "better-auth";
import { createAuthClient } from "better-auth/client";
import { deviceAuthorizationClient } from "better-auth/plugins";

import chalk from "chalk";
import { Command } from "commander";
import fs from "node:fs/promises";
import os from "os";
import path from "path";
import yoctoSpinner from "yocto-spinner";
import * as z from "zod/v4";
import dotenv from "dotenv";
import prisma from "../../../lib/db.js";
import open from "open";

dotenv.config();
const URL = "http://localhost:4000";
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CONFIG_DIR = path.join(os.homedir(), ".better-auth");
const TOKEN_FILE = path.join(CONFIG_DIR, "token.json");

export async function loginAction(opts) {
  const options = z.object({
    serverUrl: z.string().optional(),
    clientId: z.string().optional(),
  });

  const serverUrl = options.serverUrl || URL;
  const clientId = options.clientId || CLIENT_ID;

  intro(chalk.bold("Better-Auth Login"));
  //tarea: cambiar esto con el administrador de token utils
  const existingToken = false;
  const expired = false;

  if (existingToken && !expired) {
    const shouldReAuth = await confirm({
      message: "Ya tines una sesion. Quieres iniciar sesion nuevamente?",
      initialValue: false,
    });
    if (isCancel(shouldReAuth) || !shouldReAuth) {
      cancel("Inicio de sesion cancelado");
      process.exit(0);
    }
  }
  const authClient = createAuthClient({
    baseURL: serverUrl,
    plugins: [deviceAuthorizationClient()],
  });

  const spinner = yoctoSpinner({
    text: "Solicitando la autorizacion del dispositivo",
  });
  spinner.start();
  try {
    const { data, error } = await authClient.device.code({
      client_id: clientId,
      scope: "Abre tu perfil de email",
    });
    spinner.stop();

    if (error || !data) {
      logger.error(
        `Fallo en la autorizacion de dispositivo ${error.error_description}`,
      );
      process.exit(1);
    }
    const {
      device_code,
      user_code,
      verification_uri,
      verification_uri_complete,
      interval = 5,
      expires_in,
    } = data;
    console.log(chalk.cyan("Es necesario la autorizacion del dispositivo"));
    console.log(
      `Por favor visita ${chalk.underline.blue(verification_uri || verification_uri_complete)}`,
    );
    console.log(`Ingresa el codigo: ${chalk.bold.green(user_code)}`);
    const shouldOpen = await confirm({
      message: "Abrir navegador automaticamente",
      initialValue: true,
    });
    if (!isCancel(shouldOpen) && shouldOpen) {
      const urlToOpen = verification_uri || verification_uri_complete;
      await open(urlToOpen);
    }
    console.log(
      chalk.gray(
        `Esperando por la autorizacion (expira en ${Math.floor(expires_in / 60)} minutos)...`,
      ),
    );
  } catch (error) {}
}

//================
//COMMANDER SETUP
//================
//COMMANDER SETUP
export const login = new Command("login")
  .description("Iniciar sesion con Better-Auth")
  .option("--server-url <url>", "El servidor de Better-Auth esta en URL", URL)
  .option("--client-id <id>", "El OAuth Client ID", CLIENT_ID)
  .action(loginAction);
