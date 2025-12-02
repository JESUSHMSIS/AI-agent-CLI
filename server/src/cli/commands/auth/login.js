import { cancel, confirm, intro, isCancel, outro } from "@clack/prompts";
import { logger } from "better-auth";
import { createAuthClient } from "better-auth/client";
import { deviceAuthorizationClient } from "better-auth/plugins";

import chalk from "chalk";
import { Command } from "commander";
import os from "os";
import path from "path";
import yoctoSpinner from "yocto-spinner";
import * as z from "zod/v4";
import dotenv from "dotenv";
import prisma from "../../../lib/db.js";
import open from "open";
import {
  clearStoredToken,
  getStoredToken,
  isTokenExpired,
  requiredAuth,
  storeToken,
} from "../../../lib/token.js";

dotenv.config();
const URL = "http://localhost:4000";
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
export const CONFIG_DIR = path.join(os.homedir(), ".better-auth");
export const TOKEN_FILE = path.join(CONFIG_DIR, "token.json");

export async function loginAction(opts) {
  const options = z.object({
    serverUrl: z.string().optional(),
    clientId: z.string().optional(),
  });

  const serverUrl = options.serverUrl || URL;
  const clientId = options.clientId || CLIENT_ID;

  intro(chalk.bold("Better-Auth Login"));

  if (!clientId) {
    logger.error("El CLIENT_ID no esta configurado en tu .env");
    console.log(chalk.red("Por favor configura el CLIENT_ID en tu .env"));
    process.exit(1);
  }
  const existingToken = await getStoredToken();
  const expired = await isTokenExpired();

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
      const urlToOpen = verification_uri_complete || verification_uri;
      await open(urlToOpen);
    }
    console.log(
      chalk.gray(
        `Esperando por la autorizacion (expira en ${Math.floor(expires_in / 60)} minutos)...`,
      ),
    );
    const token = await pollForToken(
      authClient,
      device_code,
      clientId,
      interval,
    );
    if (token) {
      const saved = await storeToken(token);
      if (!saved) {
        console.log(
          chalk.yellow(
            "\n Peligro: No se pudo guardar el token de autenticacion",
          ),
        );
        console.log(
          chalk.yellow("Debes iniciar sesion de nuevo para volver a usar"),
        );
      }
      outro(chalk.green("inicio de sesion exitoso"));
      console.log(chalk.gray(`\n Token guardado en: ${TOKEN_FILE}`));
      console.log(
        chalk.gray(
          "Ya puedes usar los comandos de AI sin iniciar sesion de nuevo. \n",
        ),
      );
    }
  } catch (error) {
    spinner.stop();
    console.error(chalk.red("\nInicio de sesion fallo"), error.message);
    process.exit(1);
  }
}
async function pollForToken(
  authClient,
  deviceCode,
  clientId,
  initialIntervalue,
) {
  let pollingInterval = initialIntervalue;
  let spinner = yoctoSpinner({ text: "", color: "cyan" });
  let dots = 0;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      dots = (dots + 1) % 4;
      spinner.text = chalk.gray(`
      Polling for authorization${".".repeat(dots)}${" ".repeat(3 - dots)}
`);
      if (!spinner.isSpinning) spinner.start();
      try {
        const { data, error } = await authClient.device.token({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: deviceCode,
          client_id: clientId,
          fetchOptions: {
            headers: {
              "user-agent": `My CLI`,
            },
          },
        });

        if (data?.access_token) {
          console.log(
            chalk.bold.yellow(`Tu token de acceso: ${data.access_token}`),
          );
          spinner.stop();
          resolve(data);
          return;
        } else if (error) {
          switch (error.error) {
            case "authorization_pending":
              // Continue polling
              break;
            case "slow_down":
              pollingInterval += 5;
              break;
            case "access_denied":
              console.error("Access was denied by the user");
              return;
            case "expired_token":
              console.error("The device code has expired. Please try again.");
              return;
            default:
              spinner.stop();
              console.error(`Error: ${error.error_description}`);
              process.exit(1);
          }
        }
      } catch (error) {
        spinner.stop();
        logger.error("Network Error:", error.message);
        process.exit(1);
      }
      setTimeout(poll, pollingInterval * 1000);
    };
    setTimeout(poll, pollingInterval * 1000);
  });
}
export async function logoutAction() {
  intro(chalk.bold("Cerrar sesion"));
  const token = await getStoredToken();
  if (!chalk) {
    console.log(chalk.yellow("Tu no iniciaste sesion"));
    process.exit(0);
  }
  const shouldLogout = await confirm({
    message: "Estas seguro de cerrar sesion?",
    initialValue: false,
  });
  if (isCancel(shouldLogout) || !shouldLogout) {
    cancel("No se cerro la sesion");
    process.exit(0);
  }
  const cleared = await clearStoredToken();
  if (cleared) {
    outro(chalk.green("Se cerro sesion correctamente"));
  } else {
    console.log(chalk.yellow("No se limpio el archivo del token"));
  }
}
export async function whoamiAction(opts) {
  const token = await requiredAuth();
  if (!token.access_token) {
    console.log("No se encontro el access token. por favor iniciar sesion");
    process.exit(1);
  }
  const user = await prisma.user.findFirst({
    where: {
      sessions: {
        some: {
          token: token.access_token,
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
  console.log(
    chalk.bold.greenBright(`\n   Usuario: ${user.name}
   Email: ${user.email}
   ID: ${user.id}
`),
  );
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

export const logout = new Command("logout")
  .description("Se cerrara sesion y se quitaran las credenciales")
  .action(logoutAction);

export const whoami = new Command("whoami")
  .description("Mostrar los datos del usuario autenticado")
  .option("--server-url <url>", "The better-auth server url", URL)
  .action(whoamiAction);
