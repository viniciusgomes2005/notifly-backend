// src/server.js
const express = require("express");
const cors = require("cors");
const { envz } = require("./config/envz");
const { usersRoute } = require("./routes/user.routes");
const { chatsRoute } = require("./routes/chat.routes");
const { msgsRoute } = require("./routes/message.routes");

const kApp = express();

kApp.use(cors());
kApp.use(express.json());

kApp.get("/health", (req, res) => {
  res.json({ ok: true, srv: "notfly-backend", env: process.env.NODE_ENV || "dev" });
});

kApp.use("/users", usersRoute);
kApp.use("/chats", chatsRoute);
kApp.use("/messages", msgsRoute);

kApp.listen(envz.PORT, () => {
  console.log(`🚀 NotFly backend on porta ${envz.PORT}`);
});
