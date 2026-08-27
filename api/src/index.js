import express from "express";

const app = express();
app.use(express.json());

app.get("/api/ping", (req, res) => {
  res.json({ mensaje: "La API está viva" });
});

app.listen(3000, () => {
  console.log("API escuchando en http://localhost:3000");
});