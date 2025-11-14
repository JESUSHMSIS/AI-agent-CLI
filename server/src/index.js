import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import dotnev from "dotenv";
import express from "express";
import { auth } from "./lib/auth.js";
dotnev.config();

const app = express();
app.use(
  cors({
    origin: "http://localhost:3000", // Replace with your frontend's origin
    methods: ["GET", "POST", "PUT", "DELETE"], // Specify allowed HTTP methods
    credentials: true, // Allow credentials (cookies, authorization headers, etc.)
  }),
);
app.all("/api/auth/*splat", toNodeHandler(auth));
app.use(express.json());

app.get("/health", (req, res) => {
  res.send("todo bien en el server");
});
app.get("/api/me", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  return res.json(session);
});
app.get("/device", (req, res) => {
  const { user_code } = req.query;
  res.redirect(`http://localhost:3000/device?user_code=${user_code}`);
});
app.listen(process.env.PORT, () => {
  console.log(
    `El servidor esta corriendo en http://localhost:${process.env.PORT}`,
  );
});
