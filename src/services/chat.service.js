const { client } = require("../database/client");

const chatsService = {
  async createChat(user_1_id, user_2_id, is_system = false) {
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

  async createChatWithEmail(user_1_id, user_2_email, is_system = false) {
    const { data: otherUser, error: uErr } = await client
      .from("users")
      .select("user_id, email")
      .eq("email", user_2_email)
      .maybeSingle();

    if (uErr) throw uErr;
    if (!otherUser) {
      const err = new Error("user_not_found");
      err.code = "user_not_found";
      throw err;
    }
    const { data, error } = await client
      .from("chats")
      .insert({
        user_1_id,
        user_2_id: otherUser.user_id,
        is_system,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },

  async listChatsForUser(user_id) {
    const { data, error } = await client
      .from("chats")
      .select("*")
      .or(`user_1_id.eq.${user_id},user_2_id.eq.${user_id}`)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getChatById(chat_id) {
    const { data, error } = await client
      .from("chats")
      .select("*")
      .eq("chat_id", chat_id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },
};

module.exports = { chatsService };
