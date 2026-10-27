const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));

app.get("/", (_req, res) => {
  res.status(200).json({
    service: "OlaPay API",
    status: "running",
    mode: "setup",
    message: "Backend is online. Payment endpoints are not enabled yet."
  });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`OlaPay API listening on port ${PORT}`);
});
