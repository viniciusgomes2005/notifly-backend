require("dotenv").config();

const envz = {
  PORT: process.env.PORT || 4000,
  SUPA_URL: process.env.SUPABASE_URL,
  SUPA_ANON: process.env.SUPABASE_ANON_KEY,
  SUPA_SR: process.env.SUPABASE_SERVICE_ROLE,
  JWT_SECRET: process.env.JWT_SECRET || "jwt_secr3t_inseguro_dev",
  JWT_EXP: process.env.JWT_EXPIRES_IN || "7d",
  NODE_ENV: process.env.NODE_ENV || "development",
  NOTIFLY_USER_ID: process.env.NOTIFLY_USER_ID,
  LMSTUDIO_BASE_URL: process.env.LMSTUDIO_BASE_URL,
  LMSTUDIO_MODEL: process.env.LMSTUDIO_MODEL,
  MCP_SERVER_SCRIPT_PATH: process.env.MCP_SERVER_SCRIPT_PATH,
};

if (!envz.SUPA_URL || !envz.SUPA_SR) {
  console.warn("[envz] ⚠ SUPABASE_URL / SERVICE_ROLE faltando.");
}

module.exports = { envz };