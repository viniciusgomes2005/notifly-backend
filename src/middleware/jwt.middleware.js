const jwt = require("jsonwebtoken");
const { envz } = require("../config/envz");

function jwtGuard(req, res, next) {
  try {
    const raw = req.headers["authorization"] || "";
    const parts = raw.split(" ");

    if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
      return res
        .status(401)
        .json({ ok: false, error: "missing_or_invalid_auth_header" });
    }

    const tok = parts[1];

    const payload = jwt.verify(tok, envz.JWT_SECRET);

    req.authUser = {
      id: payload.sub,
      email: payload.email,
    };

    return next();
  } catch (err) {
    console.error("[jwtGuard] err:", err.message);
    return res.status(401).json({ ok: false, error: "invalid_or_expired_token" });
  }
}

module.exports = { jwtGuard };
