import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ListToolsResultSchema, CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import crypto from "node:crypto";

const DEBUG = String(process.env.DEBUG_MCP || "0") === "1";

function ts() { return new Date().toISOString(); }
function mkReqId() { return crypto.randomBytes(4).toString("hex"); }

function log(reqId, ...args) { if (DEBUG) console.log(`[${ts()}][MCP-CLIENT][${reqId}]`, ...args); }
function warn(reqId, ...args) { console.warn(`[${ts()}][MCP-CLIENT][${reqId}][WARN]`, ...args); }
function errlog(reqId, ...args) { console.error(`[${ts()}][MCP-CLIENT][${reqId}][ERROR]`, ...args); }

function ensureFetch() {
  if (typeof fetch !== "function") {
    throw new Error("fetch não disponível. Use Node 18+ ou adicione node-fetch.");
  }
}

function safeJson(obj, maxLen = 1500) {
  try {
    const s = JSON.stringify(obj);
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + `... (truncado, len=${s.length})`;
  } catch {
    return "[unserializable]";
  }
}

function stripOwnerIdFromJsonSchema(schema) {
  if (!schema || typeof schema !== "object") return schema;
  const clone = JSON.parse(JSON.stringify(schema));
  if (clone?.properties?.owner_id) delete clone.properties.owner_id;

  if (Array.isArray(clone.required)) {
    clone.required = clone.required.filter((x) => x !== "owner_id");
    if (clone.required.length === 0) delete clone.required;
  }
  return clone;
}

function mcpToolToOpenAiTool(tool) {
  const params = tool.inputSchema || { type: "object", properties: {} };
  const noOwner = stripOwnerIdFromJsonSchema(params);

  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description || "",
      parameters: noOwner,
    },
  };
}

function parseToolArgs(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return {};
}

// --------------------
// Router determinístico (fallback)
// --------------------
function pad2(n) { return String(n).padStart(2, "0"); }
function toYmd(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

function parsePtBrDateToYmd(text) {
  const m = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!yyyy || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
}

function isListIntent(text) {
  const t = (text || "").toLowerCase();
  return t.includes("taref") || t.includes("compromiss") || t.includes("agenda") || t.includes("quais") || t.includes("listar");
}

function inferListDate(text) {
  const t = (text || "").toLowerCase();

  const explicit = parsePtBrDateToYmd(t);
  if (explicit) return explicit;

  const now = new Date();
  if (t.includes("hoje")) return toYmd(now);

  if (t.includes("amanh")) {
    const d = new Date(now); d.setDate(d.getDate() + 1);
    return toYmd(d);
  }

  if (t.includes("ontem")) {
    const d = new Date(now); d.setDate(d.getDate() - 1);
    return toYmd(d);
  }

  return null;
}

function shouldForceFallback(text) {
  // aqui você decide quais intents SEMPRE exigem tool
  // por enquanto: qualquer pedido de listar tarefas com data explícita/relativa
  const t = (text || "").toLowerCase();
  if (!isListIntent(t)) return false;
  if (t.includes("hoje") || t.includes("amanh") || t.includes("ontem") || parsePtBrDateToYmd(t)) return true;
  return false;
}


async function mcpCall(reqId, mcp, name, args, ownerId) {
  const finalArgs = { ...(args || {}), owner_id: ownerId };

  log(reqId, "MCP tools/call →", { name, arguments: finalArgs });

  const t0 = Date.now();
  const toolResult = await mcp.request(
    { method: "tools/call", params: { name, arguments: finalArgs } },
    CallToolResultSchema
  );

  log(reqId, `MCP tools/call OK (${Date.now() - t0}ms)`, safeJson(toolResult, 2000));
  return toolResult?.content ?? toolResult;
}

async function lmChatOnce(reqId, { baseUrl, model, systemPrompt, conversation, tools, tool_choice, signal }) {
  ensureFetch();

  const body = {
    model,
    temperature: 0.0, // mais determinístico
    max_tokens: 600,
    messages: [{ role: "system", content: systemPrompt }, ...conversation],
    ...(tools ? { tools } : {}),
    ...(tool_choice ? { tool_choice } : {}),
  };

  log(reqId, "LM request →", {
    url: `${baseUrl}/v1/chat/completions`,
    model,
    tool_choice,
    tools_count: Array.isArray(tools) ? tools.length : 0,
    messages_count: body.messages.length,
    last_user: (() => {
      const last = [...body.messages].reverse().find((m) => m.role === "user");
      return last?.content ? String(last.content).slice(0, 200) : null;
    })(),
  });

  const t0 = Date.now();
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify(body),
  });
  log(reqId, `LM response HTTP ${res.status} (${Date.now() - t0}ms)`);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    errlog(reqId, "LM error body:", text.slice(0, 2000));
    throw new Error(`LM Studio HTTP ${res.status}: ${text}`);
  }

  const json = await res.json();
  log(reqId, "LM raw response (trunc):", safeJson(json, 2000));
  return json;
}

export async function callLmStudioWithMcp({
  mcpServerScriptPath,
  ownerId,
  systemPrompt,
  messages,
  lmBaseUrl = "http://127.0.0.1:1234",
  lmModel = "qwen/qwen3-4b-2507",
}) {
  const reqId = mkReqId();
  const tStart = Date.now();

  log(reqId, "START callLmStudioWithMcp", {
    mcpServerScriptPath,
    ownerId,
    lmBaseUrl,
    lmModel,
    messages_len: Array.isArray(messages) ? messages.length : null,
  });

  if (!mcpServerScriptPath) throw new Error("mcpServerScriptPath não definido");
  if (!ownerId) throw new Error("ownerId não definido");

  // Trunca histórico para reduzir contaminação
  let baseConversation = Array.isArray(messages) ? [...messages] : [];
  if (baseConversation.length > 12) {
    warn(reqId, `Truncando histórico: ${baseConversation.length} -> 12 (evitar prompt contaminado)`);
    baseConversation = baseConversation.slice(-12);
  }

  const lastUser = [...baseConversation].reverse().find((m) => m.role === "user");
  const lastUserText = String(lastUser?.content || "");
  log(reqId, "Última mensagem do usuário:", lastUserText);

  log(reqId, "Spawning MCP server via stdio…");
  const transport = new StdioClientTransport({ command: "node", args: [mcpServerScriptPath] });

  const mcp = new Client({ name: "notifly-mcp-host", version: "1.0.0" }, { capabilities: {} });

  try {
    const t0 = Date.now();
    await mcp.connect(transport);
    log(reqId, `MCP connected (${Date.now() - t0}ms)`);

    log(reqId, "MCP tools/list…");
    const t1 = Date.now();
    const list = await mcp.request({ method: "tools/list" }, ListToolsResultSchema);
    log(reqId, `tools/list OK (${Date.now() - t1}ms)`);

    const toolNames = (list.tools || []).map((t) => t.name);
    log(reqId, "Tools disponíveis:", toolNames);

    const openAiTools = (list.tools || []).map(mcpToolToOpenAiTool);
    log(reqId, "OpenAI tools payload (trunc):", safeJson(openAiTools, 2000));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      // --------------------
      // PASS 1: tenta tool_calls “normal”
      // --------------------
      const conversation = [...baseConversation];
      let usedAnyTool = false;

      for (let i = 0; i < 3; i++) {
        log(reqId, `--- ITERAÇÃO TOOL LOOP ${i + 1}/3 ---`);
        log(reqId, "conversation.len =", conversation.length);

        const json = await lmChatOnce(reqId, {
          baseUrl: lmBaseUrl,
          model: lmModel,
          systemPrompt,
          conversation,
          tools: openAiTools,
          tool_choice: "auto",
          signal: controller.signal,
        });

        const msg = json?.choices?.[0]?.message;
        if (!msg) throw new Error("LM Studio respondeu sem choices[0].message");

        const toolCalls = msg.tool_calls || [];
        log(reqId, "LM msg.content (trunc):", (msg.content || "").slice(0, 500));
        log(reqId, "LM tool_calls:", safeJson(toolCalls, 2000));

        if (!toolCalls.length) {
          log(reqId, "Nenhum tool_call retornado pelo modelo nesta iteração.");
          break;
        }

        usedAnyTool = true;

        conversation.push({
          role: "assistant",
          content: msg.content ?? "",
          tool_calls: toolCalls,
        });

        for (const call of toolCalls) {
          const toolName = call.function?.name;
          const args = parseToolArgs(call.function?.arguments);
          args.owner_id = ownerId;

          log(reqId, "Executando tool do modelo:", { toolName, call_id: call.id, args });

          let toolContent;
          try {
            toolContent = await mcpCall(reqId, mcp, toolName, args, ownerId);
          } catch (e) {
            errlog(reqId, "tools/call FALHOU:", e?.stack || e);
            toolContent = [{ type: "text", text: `Erro ao executar ${toolName}: ${String(e?.message || e)}` }];
          }

          conversation.push({
            role: "tool",
            name: toolName,
            tool_call_id: call.id,
            content: JSON.stringify(toolContent),
          });
        }
      }

      // --------------------
      // FALLBACK: se modelo se recusa e o pedido exige tool, chama direto
      // --------------------
      if (!usedAnyTool && shouldForceFallback(lastUserText)) {
        warn(reqId, "FALLBACK acionado: modelo não gerou tool_calls, mas o pedido exige tool.");

        // Hoje o teu caso é listDay com data explícita/relativa
        const date = inferListDate(lastUserText);
        log(reqId, "FALLBACK inferListDate =>", date);

        if (!date) {
          warn(reqId, "FALLBACK: não consegui inferir date. Vou pedir esclarecimento ao usuário.");
          return "Qual data exatamente? (ex: 11/12/2025, hoje, ontem, amanhã)";
        }

        const toolContent = await mcpCall(reqId, mcp, "listDay", { date }, ownerId);
        log(reqId, "FALLBACK listDay result:", safeJson(toolContent, 2000));

        // Redação final (sem tools) baseada no retorno real
        const finalPrompt = [
          systemPrompt,
          "",
          "A tool MCP já foi executada. Use APENAS o resultado abaixo para responder.",
          "Não invente tarefas. Se estiver vazio, diga que não há tarefas.",
          "",
          `Resultado listDay (date=${date}):`,
          JSON.stringify(toolContent),
          "",
          "Responda somente com a resposta final ao usuário (pt-BR).",
        ].join("\n");

        const json2 = await lmChatOnce(reqId, {
          baseUrl: lmBaseUrl,
          model: lmModel,
          systemPrompt: finalPrompt,
          conversation: [],
          tools: null,
          tool_choice: "none",
          signal: controller.signal,
        });

        const out = (json2?.choices?.[0]?.message?.content || "").trim();
        log(reqId, "FALLBACK final answer:", out.slice(0, 700));
        log(reqId, `END (${Date.now() - tStart}ms)`);
        return out;
      }

      // --------------------
      // PASS 2: se usou tools, faz final pass “normal”
      // --------------------
      if (usedAnyTool) {
        log(reqId, "FINAL PASS (sem tools) após tool loop…");
        const finalPrompt = [
          systemPrompt,
          "",
          "Agora responda APENAS com a resposta final ao usuário.",
          "Não mencione JSON, tool_calls, MCP, nem detalhes técnicos.",
          "Não chame ferramentas.",
        ].join("\n");

        const json2 = await lmChatOnce(reqId, {
          baseUrl: lmBaseUrl,
          model: lmModel,
          systemPrompt: finalPrompt,
          conversation: baseConversation, // suficiente
          tools: null,
          tool_choice: "none",
          signal: controller.signal,
        });

        const out = (json2?.choices?.[0]?.message?.content || "").trim();
        log(reqId, "FINAL PASS output (trunc):", out.slice(0, 700));
        log(reqId, `END (${Date.now() - tStart}ms)`);
        return out;
      }

      // --------------------
      // Se não usou tool e não era caso de fallback, devolve resposta normal
      // --------------------
      warn(reqId, "Sem tool_calls e sem fallback -> retornando resposta do modelo (caso não-tool).");
      const json3 = await lmChatOnce(reqId, {
        baseUrl: lmBaseUrl,
        model: lmModel,
        systemPrompt: systemPrompt + "\n\nResponda normalmente, sem chamar ferramentas.",
        conversation: baseConversation,
        tools: null,
        tool_choice: "none",
        signal: controller.signal,
      });

      const out = (json3?.choices?.[0]?.message?.content || "").trim();
      log(reqId, "Resposta normal (trunc):", out.slice(0, 700));
      log(reqId, `END (${Date.now() - tStart}ms)`);
      return out;
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    errlog(reqId, "FATAL:", e?.stack || e);
    throw e;
  } finally {
    log(reqId, "Fechando transport stdio…");
    await transport.close().catch((e) => warn(reqId, "transport.close falhou:", e?.message || e));
    log(reqId, "Transport fechado.");
  }
}
