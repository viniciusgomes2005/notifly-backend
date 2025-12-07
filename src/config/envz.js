require("dotenv").config();

const envz = {
  PORT: process.env.PORT || 4000,
  SUPA_URL: process.env.SUPABASE_URL,
  SUPA_SR_KEY: process.env.SUPABASE_SERVICE_ROLE,
};

if (!envz.SUPA_URL || !envz.SUPA_SR_KEY) {
  console.warn("[envz] ⚠️ SUPABASE_URL ou SUPABASE_SERVICE_ROLE não definidos.");
}

module.exports = { envz };
