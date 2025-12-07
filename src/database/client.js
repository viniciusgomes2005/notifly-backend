const { createClient } = require("@supabase/supabase-js");
const { envz } = require("../config/envz");

const client = createClient(envz.SUPA_URL, envz.SUPA_SR);

const auth_client = createClient(envz.SUPA_URL, envz.SUPA_ANON);
    
module.exports = { client, auth_client };