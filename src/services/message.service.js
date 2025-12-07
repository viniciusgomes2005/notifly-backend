const { client } = require("../database/client");

const messagesService = {
  async createMessage(payload) {
    const {
      chat_id,
      sender_id,
      type = "text",
      text_content,
      img_url,
      status = "sent",
    } = payload;

    const { data, error } = await client
      .from("messages")
      .insert({
        chat_id,
        sender_id,
        type,
        text_content,
        img_url,
        status,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },

  async listMessagesByChat(chat_id, limit = 50) {
    const { data, error } = await client
      .from("messages")
      .select("*")
      .eq("chat_id", chat_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).reverse();
  },
};

module.exports = { messagesService };