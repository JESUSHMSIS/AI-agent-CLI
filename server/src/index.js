import express from "express";
import dotnev from "dotenv";
dotnev.config();

const app = express();

app.get("/health", (req, res) => {
  res.send("todo bien en el server");
});

app.listen(process.env.PORT, () => {
  console.log(
    `El servidor esta corriendo en http://localhost:${process.env.PORT}`,
  );
});
