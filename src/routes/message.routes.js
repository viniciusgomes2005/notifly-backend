const express = require("express");
const { messagesService } = require("../services/message.service");

const msgsRoute = express.Router();

msgsRoute.get("/chat/:chat_id", async (req, res) => {
  try {
    const { chat_id } = req.params;
    const { limit } = req.query;
    const lim = Number(limit) || 50;

    const msgs = await messagesService.listMessagesByChat(chat_id, lim);
    return res.json({ ok: true, messages: msgs });
  } catch (err) {
    console.error("[msgsRoute.listByChat]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// criar mensagem
msgsRoute.post("/", async (req, res) => {
  try {
    const payload = req.body;
    const msg = await messagesService.createMessage(payload);
    return res.status(201).json({ ok: true, message: msg });
  } catch (err) {
    console.error("[msgsRoute.create]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = { msgsRoute };
