const { createClient } = require("@supabase/supabase-js");
const { envz } = require("../config/envz");

const client = createClient(envz.SUPA_URL, envz.SUPA_SR_KEY);

module.exports = { client };
