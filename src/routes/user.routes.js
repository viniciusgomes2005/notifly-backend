const express = require("express");
const { userService } = require("../services/user.service");

const usersRoute = express.Router();

usersRoute.post("/upsert", async (req, res) => {
  try {
    const uPayload = req.body;
    const user = await userService.upsertUser(uPayload);
    return res.status(200).json({ ok: true, user });
  } catch (err) {
    console.error("[usersRoute.upsert]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

usersRoute.get("/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const user = await userService.getUserById(user_id);
    if (!user) {
      return res.status(404).json({ ok: false, error: "user_not_found" });
    }
    return res.json({ ok: true, user });
  } catch (err) {
    console.error("[usersRoute.getById]", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = { usersRoute };
