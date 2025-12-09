const express = require("express");
const { authService } = require("../services/auth.service");

const authRoute = express.Router();

authRoute.post("/signup", async (req, res) => {
  try {
    const { name, email, password, photo_url } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ ok: false, error: "email_and_password_required" });
    }

    const result = await authService.signUp({
      name,
      email,
      password,
      photo_url,
    });

    return res.status(201).json({ ok: true, ...result });
  } catch (err) {
    console.error("[authRoute.signup]", err);

    if (err.code === "email_already_in_use") {
      return res.status(409).json({ ok: false, error: err.code });
    }

    return res.status(500).json({ ok: false, error: "signup_failed" });
  }
});

authRoute.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ ok: false, error: "email_and_password_required" });
    }

    const result = await authService.login({ email, password });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[authRoute.login]", err);

    if (err.code === "invalid_credentials") {
      return res
        .status(401)
        .json({ ok: false, error: "invalid_credentials" });
    }

    return res.status(500).json({ ok: false, error: "login_failed" });
  }
});

module.exports = { authRoute };
