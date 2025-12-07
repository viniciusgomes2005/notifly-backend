const { client } = require("../database/client");

const userService = {
  async upsertUser(uPayload) {
    const { user_id, name, email, photo_url } = uPayload;

    const { data, error } = await client
      .from("users")
      .upsert(
        {
          user_id,
          name,
          email,
          photo_url,
        },
        { onConflict: "email" }
      )
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },

  async getUserById(user_id) {
    const { data, error } = await client
      .from("users")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },
};

module.exports = { userService };