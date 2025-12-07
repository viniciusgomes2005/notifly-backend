const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { client } = require("../database/client");
const { envz } = require("../config/envz");

function mkToken(user) {
  const payload = {
    sub: user.user_id,
    email: user.email,
  };

  const tok = jwt.sign(payload, envz.JWT_SECRET, {
    expiresIn: envz.JWT_EXP,
  });

  return tok;
}

const authService = {
  async signUp({ name, email, password, photo_url }) {
    const { data: existing, error: selErr } = await client
      .from("users")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();

    if (selErr) throw selErr;
    if (existing) {
      const err = new Error("email_already_in_use");
      err.code = "email_already_in_use";
      throw err;
    }

    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash(password, salt);

    const { data: user, error: insErr } = await client
      .from("users")
      .insert({
        name,
        email,
        photo_url,
        password_hash: passHash,
      })
      .select("*")
      .single();

    if (insErr) throw insErr;

    const token = mkToken(user);

    const { password_hash, ...safeUser } = user;
    return { user: safeUser, token };
  },

  async login({ email, password }) {
    const { data: user, error: selErr } = await client
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (selErr) throw selErr;
    if (!user || !user.password_hash) {
      const err = new Error("invalid_credentials");
      err.code = "invalid_credentials";
      throw err;
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      const err = new Error("invalid_credentials");
      err.code = "invalid_credentials";
      throw err;
    }

    const token = mkToken(user);
    const { password_hash, ...safeUser } = user;
    console.log(user);
    return { user: safeUser, token };
  },
};

module.exports = { authService };
