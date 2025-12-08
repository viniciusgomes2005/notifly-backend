const express = require("express");
const { chatsService } = require("../services/chat.service");

const chatsRoute = express.Router();

chatsRoute.get("/user/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const chats = await chatsService.listChatsForUser(user_id);
    return res.json({ ok: true, chats });
  } catch (err) {
    console.error("[chatsRoute.listForUser]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

chatsRoute.post("/", async (req, res) => {
  try {
    const { user_1_id, user_2_email, is_system } = req.body;
    const chat = await chatsService.createChatWithEmail(
      user_1_id,
      user_2_email,
      is_system
    );
    return res.status(201).json({ ok: true, chat });
  } catch (err) {
    console.error("[chatsRoute.create]", err);
    if (err.code === "user_not_found") {
      return res.status(404).json({ ok: false, error: "user_not_found" });
    }
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = { chatsRoute };
