const { client } = require("../database/client");
const { envz } = require("../config/envz");

const LMSTUDIO_BASE_URL = envz.LMSTUDIO_BASE_URL || "http://127.0.0.1:1234";
const LMSTUDIO_MODEL = envz.LMSTUDIO_MODEL || "qwen/qwen3-4b-2507";

const notifly_id = String(envz.NOTIFLY_USER_ID || "");
const MCP_SERVER_SCRIPT_PATH = envz.MCP_SERVER_SCRIPT_PATH || ""; 

function idStr(v) {
  return v === null || v === undefined ? null : String(v);
}

function isNotiflyInChatRow(chatRow) {
  const u1 = idStr(chatRow?.user_1_id);
  const u2 = idStr(chatRow?.user_2_id);
  return u1 === notifly_id || u2 === notifly_id;
}

function getOtherUserId(chatRow) {
  const u1 = idStr(chatRow?.user_1_id);
  const u2 = idStr(chatRow?.user_2_id);

  if (u1 === notifly_id) return u2;
  if (u2 === notifly_id) return u1;

  console.error("[NotiFly] getOtherUserId: NotiFly não está no chat", {
    notifly_id,
    user_1_id: chatRow?.user_1_id,
    user_2_id: chatRow?.user_2_id,
  });
  return null;
}

function toRole(message) {
  const sender = idStr(message?.sender_id);
  return sender === notifly_id ? "assistant" : "user";
}

// Carrega o MCP client (ESM) a partir do CommonJS
let _mcpClientPromise = null;
async function getMcpClient() {
  if (_mcpClientPromise) return _mcpClientPromise;
  _mcpClientPromise = import("../mcp_client.mjs"); // ajuste o path se necessário
  return _mcpClientPromise;
}

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

    await client
      .from("chats")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", chat_id);

    // NÃO use this aqui
    setImmediate(() => {
      console.log("[NotiFly] Checking if NotiFly should reply to chat_id:", chat_id);

      messagesService
        .dispatchNotiflyReply({ chat_id, triggeringMessage: data })
        .catch((e) => console.error("[NotiFly] dispatchNotiflyReply failed:", e));
    });

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

  async dispatchNotiflyReply({ chat_id, triggeringMessage }) {
    if (!notifly_id) return;
    if (!MCP_SERVER_SCRIPT_PATH) {
      console.error("[NotiFly] MCP_SERVER_SCRIPT_PATH não definido no .env");
      return;
    }

    const { data: chatRow, error: chatErr } = await client
      .from("chats_with_users")
      .select("*")
      .eq("chat_id", chat_id)
      .maybeSingle();

    if (chatErr) throw chatErr;
    if (!chatRow) return;
    if (!isNotiflyInChatRow(chatRow)) return;

    // evita loop
    if (idStr(triggeringMessage?.sender_id) === notifly_id) return;

    // só responde texto
    if (triggeringMessage?.type && triggeringMessage.type !== "text") return;

    const otherUserId = getOtherUserId(chatRow);
    if (!otherUserId) return;

    const history = await messagesService.listMessagesByChat(chat_id, 25);

    const chatMessages = history
      .filter(
        (m) =>
          m.type === "text" &&
          typeof m.text_content === "string" &&
          m.text_content.trim()
      )
      .map((m) => ({
        role: toRole(m),
        content: m.text_content.trim(),
      }));

    if (chatMessages.length === 0) return;

    const systemPrompt = [
      "Você é o NotiFly, um usuário-bot dentro de um chat estilo WhatsApp.",
      `Você está conversando com o usuário ${otherUserId}.`,
      "Você tem acesso a ferramentas via MCP para gerenciar tarefas (criar, listar, concluir).",
      "",
      "Regras:",
      "- Se o usuário pedir para registrar/marcar/agendar/criar um compromisso ou tarefa, use a ferramenta apropriada.",
      "- Se o usuário perguntar tarefas de um dia específico, liste.",
      "- Se o usuário pedir para concluir uma tarefa, marque como concluída.",
      "- Não diga que fez algo sem usar ferramenta.",
      "- Depois de usar ferramenta(s), explique o resultado em linguagem natural.",
      "",
      "Se não houver ferramenta apropriada, responda em texto.",
    ].join("\n");

    const { callLmStudioWithMcp } = await getMcpClient();

    const replyText = await callLmStudioWithMcp({
      mcpServerScriptPath: MCP_SERVER_SCRIPT_PATH,
      ownerId: otherUserId,
      systemPrompt,
      messages: chatMessages,
      lmBaseUrl: LMSTUDIO_BASE_URL,
      lmModel: LMSTUDIO_MODEL,
    });

    if (!replyText) return;

    const { error: insertErr } = await client.from("messages").insert({
      chat_id,
      sender_id: notifly_id,
      type: "text",
      text_content: replyText,
      status: "sent",
    });

    if (insertErr) throw insertErr;

    await client
      .from("chats")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", chat_id);
  },
};

module.exports = { messagesService };
