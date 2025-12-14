const { client } = require("../database/client");

const chatsService = {
  async createChat(user_1_id, user_2_email, is_system = false) {
    const user_2_id  = await client
    .from("users")
    .select("user_id")
    .eq("email", user_2_email)
    .maybeSingle()
    .then(({ data }) => data.user_id);
    console.log(user_2_id);
    const { data, error } = await client
      .from("chats")
      .insert({
        user_1_id,
        user_2_id,
        is_system,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },

  async listChatsForUser(user_id) {
    const { data, error } = await client
      .from("chats_with_users")
      .select("*")
      .or(`user_1_id.eq.${user_id},user_2_id.eq.${user_id}`)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getChatById(chat_id) {
    const { data, error } = await client
      .from("chats_with_users")
      .select("*")
      .eq("chat_id", chat_id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },
};

module.exports = { chatsService };
