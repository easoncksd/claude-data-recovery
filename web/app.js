const zipInput = document.getElementById("zipInput");
const folderInput = document.getElementById("folderInput");
const fileList = document.getElementById("fileList");
const statusBox = document.getElementById("status");
const generateBtn = document.getElementById("generateBtn");
const clearBtn = document.getElementById("clearBtn");
const previewPanel = document.getElementById("previewPanel");
const previewFrame = document.getElementById("previewFrame");
const openPreviewBtn = document.getElementById("openPreviewBtn");

let selectedFiles = [];
let latestHtml = "";
let latestPreviewUrl = "";
let latestAssetUrls = [];
let latestFiles = {};
let latestDataset = null;

zipInput.addEventListener("change", () => {
  selectedFiles = Array.from(zipInput.files || []);
  folderInput.value = "";
  renderFiles();
});

folderInput.addEventListener("change", () => {
  selectedFiles = Array.from(folderInput.files || []);
  zipInput.value = "";
  renderFiles();
});

clearBtn.addEventListener("click", () => {
  selectedFiles = [];
  zipInput.value = "";
  folderInput.value = "";
  previewPanel.hidden = true;
  setStatus("等待选择 conversations.json");
  renderFiles();
});

generateBtn.addEventListener("click", async () => {
  try {
    setStatus("正在本地解析数据...");
    const bundle = await buildRecoveryBundle(selectedFiles);
    latestFiles = bundle.files;
    latestDataset = bundle.dataset;
    latestHtml = createPreviewHtml(bundle.files);
    previewFrame.srcdoc = latestHtml;
    previewFrame.onload = wirePreviewFrame;
    previewPanel.hidden = false;

    setStatus(`生成完成。\n对话：${bundle.dataset.stats.conversation_count}\n消息：${bundle.dataset.stats.total_message_count}\n可在下方预览，或点击“新窗口打开”。`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  }
});

openPreviewBtn.addEventListener("click", () => {
  if (latestPreviewUrl) URL.revokeObjectURL(latestPreviewUrl);
  latestPreviewUrl = URL.createObjectURL(new Blob([latestHtml], { type: "text/html;charset=utf-8" }));
  window.open(latestPreviewUrl, "_blank", "noopener,noreferrer");
});

function createPreviewHtml(files) {
  const assets = Object.fromEntries(Object.entries(files).filter(([path]) => path !== "index.html"));
  const bridgeScript = `
<script>
(() => {
  const recoveryAssets = ${JSON.stringify(assets).replaceAll("</script", "<\\/script")};
  const openAsset = (path) => {
    const cleanPath = decodeURIComponent(String(path || "")).replace(/^\\.\\//, "");
    if (!Object.prototype.hasOwnProperty.call(recoveryAssets, cleanPath)) return false;
    const type = cleanPath.endsWith(".md") ? "text/markdown;charset=utf-8" : "application/json;charset=utf-8";
    const url = URL.createObjectURL(new Blob([recoveryAssets[cleanPath]], { type }));
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  };
  const copyTextLocal = (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  };
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (link) {
      const rawHref = link.getAttribute("href") || "";
      if (openAsset(rawHref)) {
        event.preventDefault();
        return;
      }
    }
    const button = event.target.closest("button");
    if (!button) return;
    if (button.id === "copyMemory") {
      event.preventDefault();
      copyTextLocal(document.getElementById("memoryText")?.textContent || "");
    }
    if (button.id === "copyLink") {
      const uuidText = document.querySelector(".detail-head .meta span:last-child")?.textContent || "";
      const uuid = uuidText.replace(/^UUID\\s*/, "").trim();
      if (uuid) {
        event.preventDefault();
        copyTextLocal(uuid);
      }
    }
  }, true);
})();
</script>`;
  return files["index.html"].replace("</body>", `${bridgeScript}\n</body>`);
}

function wirePreviewFrame() {
  const doc = previewFrame.contentDocument;
  if (!doc) return;
  doc.querySelectorAll("a[href]").forEach((link) => {
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
  });
  doc.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (link) {
      const rawHref = link.getAttribute("href") || "";
      const href = decodeURIComponent(rawHref).replace(/^\.\//, "");
      if (rawHref.startsWith("blob:")) {
        event.preventDefault();
        window.open(rawHref, "_blank", "noopener,noreferrer");
        return;
      }
      if (latestFiles[href]) {
        event.preventDefault();
        const type = href.endsWith(".md") ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8";
        const url = URL.createObjectURL(new Blob([latestFiles[href]], { type }));
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
    }

    const button = event.target.closest("button");
    if (!button) return;
    if (button.id === "copyMemory") {
      event.preventDefault();
      copyFromGenerator(latestDataset?.memory_import_text || "");
      setStatus("已复制记忆文本。");
    }
    if (button.id === "copyLink") {
      const uuidText = doc.querySelector(".detail-head .meta span:last-child")?.textContent || "";
      const uuid = uuidText.replace(/^UUID\\s*/, "").trim();
      if (uuid) {
        event.preventDefault();
        copyFromGenerator(uuid);
        setStatus("已复制 UUID。");
      }
    }
  }, true);
}

function copyFromGenerator(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function renderFiles() {
  fileList.innerHTML = selectedFiles.map((file) => {
    return `<li><strong>${escapeHtml(file.webkitRelativePath || file.name)}</strong><span>${formatBytes(file.size)}</span></li>`;
  }).join("");
  const hasZip = selectedFiles.some((file) => file.name.endsWith(".zip"));
  const hasConversations = hasZip || selectedFiles.some((file) => file.name === "conversations.json");
  generateBtn.disabled = !hasConversations;
  if (!selectedFiles.length) {
    setStatus("等待选择 conversations.json");
  } else if (!hasConversations) {
    setStatus("还没有选择 conversations.json 或 Claude 导出 zip。");
  } else {
    setStatus("已准备好。点击“生成恢复包”即可在浏览器本地处理。");
  }
}

async function buildRecoveryBundle(files) {
  const jsonFiles = {};
  for (const file of files) {
    if (file.name.endsWith(".zip")) {
      Object.assign(jsonFiles, await readZipJsonFiles(file));
      continue;
    }
    if (file.name.endsWith(".json")) {
      const key = file.webkitRelativePath || file.name;
      jsonFiles[key.replaceAll("\\", "/")] = JSON.parse(await file.text());
    }
  }

  const conversationsRaw = findJson(jsonFiles, "conversations.json");
  if (!Array.isArray(conversationsRaw)) {
    throw new Error("conversations.json 必须是 JSON 数组。");
  }

  const conversations = conversationsRaw
    .filter((item) => item && typeof item === "object")
    .map((item, index) => normalizeConversation(item, index + 1));
  const designChats = Object.entries(jsonFiles)
    .filter(([path, value]) => path.includes("design_chats/") && value && typeof value === "object" && !Array.isArray(value))
    .map(([, value], index) => normalizeDesignChat(value, index + 1));

  const memoriesRaw = findJson(jsonFiles, "memories.json") || [];
  const memories = Array.isArray(memoriesRaw) ? memoriesRaw : [memoriesRaw];
  const usersRaw = findJson(jsonFiles, "users.json") || [];
  const users = Array.isArray(usersRaw) ? usersRaw : [usersRaw];
  const projects = Object.entries(jsonFiles)
    .filter(([path, value]) => path.includes("projects/") && value && typeof value === "object" && !Array.isArray(value))
    .map(([, value]) => value);

  const allChats = conversations.concat(designChats);
  const dateValues = allChats.map((chat) => chat.created_at).filter(Boolean);
  const stats = {
    conversation_count: conversations.length,
    design_chat_count: designChats.length,
    total_chat_count: allChats.length,
    conversation_message_count: conversations.reduce((sum, chat) => sum + chat.message_count, 0),
    design_message_count: designChats.reduce((sum, chat) => sum + chat.message_count, 0),
    total_message_count: allChats.reduce((sum, chat) => sum + chat.message_count, 0),
    attachment_count: allChats.reduce((sum, chat) => sum + chat.attachment_count, 0),
    file_count: allChats.reduce((sum, chat) => sum + chat.file_count, 0),
    total_char_count: allChats.reduce((sum, chat) => sum + chat.char_count, 0),
    project_count: projects.length,
    memory_record_count: memories.filter(Boolean).length,
    date_min: dateValues.length ? dateValues.sort()[0] : "",
    date_max: allChats.map((chat) => chat.updated_at || chat.created_at).filter(Boolean).sort().at(-1) || "",
    month_counts: countBy(conversations, "month"),
    category_counts: countBy(conversations, "category"),
    priority_counts: countBy(conversations, "priority"),
  };

  const memoryImportText = buildMemoryText(memories);
  const projectRecoveryText = projectToText(projects);
  const dataset = {
    generated_at: new Date().toISOString(),
    stats,
    conversations,
    design_chats: designChats,
    users,
    memories,
    projects,
    memory_import_text: memoryImportText,
    project_recovery_text: projectRecoveryText,
    warnings: [],
    source_files: files.map((file) => ({ file: file.webkitRelativePath || file.name, size_bytes: file.size })),
  };

  const filesOut = {
    "index.html": buildViewerHtml({ stats, all_chats: allChats, memory_import_text: memoryImportText, project_recovery_text: projectRecoveryText }),
    "normalized_data.json": JSON.stringify(dataset, null, 2),
    "memory_import.md": memoryImportText || "没有可导入的记忆文本。",
    "project_recovery.md": `# Claude 项目恢复资料\n\n${projectRecoveryText}`,
    "account_appeal.md": buildAccountAppeal(users[0], stats),
    "README_RECOVERY.md": buildReadme(stats),
  };

  for (const chat of allChats) {
    filesOut[chat.markdown_file] = markdownForChat(chat);
  }
  return { files: filesOut, dataset };
}

async function readZipJsonFiles(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = findEndOfCentralDirectory(bytes);
  if (eocdOffset < 0) throw new Error("无法读取 zip 文件：没有找到中央目录。");
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder("utf-8");
  const jsonFiles = {};
  let offset = centralOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("无法读取 zip 文件：中央目录格式异常。");
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength)).replaceAll("\\", "/");
    offset += 46 + nameLength + extraLength + commentLength;

    if (!name.endsWith(".json") || name.endsWith("/")) continue;
    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error(`无法读取 ${name}：本地文件头异常。`);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
    const contentBytes = await inflateZipEntry(compressed, method, uncompressedSize, name);
    jsonFiles[name] = JSON.parse(decoder.decode(contentBytes));
  }
  return jsonFiles;
}

function findEndOfCentralDirectory(bytes) {
  const minOffset = Math.max(0, bytes.length - 0xffff - 22);
  for (let offset = bytes.length - 22; offset >= minOffset; offset -= 1) {
    if (bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b && bytes[offset + 2] === 0x05 && bytes[offset + 3] === 0x06) {
      return offset;
    }
  }
  return -1;
}

async function inflateZipEntry(compressed, method, uncompressedSize, name) {
  if (method === 0) return compressed;
  if (method !== 8) throw new Error(`无法读取 ${name}：暂不支持 zip 压缩方式 ${method}。`);
  if (typeof DecompressionStream === "undefined") {
    throw new Error("当前浏览器不支持直接解压 zip。请换用新版 Chrome/Edge，或先解压 Claude 导出 zip 后再选择目录。");
  }
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const buffer = await new Response(stream).arrayBuffer();
  const output = new Uint8Array(buffer);
  if (uncompressedSize && output.length !== uncompressedSize) {
    throw new Error(`无法读取 ${name}：解压后的文件大小不匹配。`);
  }
  return output;
}

function normalizeDesignChat(raw, ordinal) {
  const messages = (raw.messages || [])
    .filter((message) => message && typeof message === "object")
    .map((message, index) => normalizeDesignMessage(message, index + 1));
  const humanMessages = messages.filter((message) => ["human", "user"].includes(message.sender));
  const assistantMessages = messages.filter((message) => message.sender === "assistant");
  const rawTitle = cleanText(raw.title || "未命名设计对话");
  const firstPrompt = humanMessages[0]?.text || messages[0]?.text || "";
  const title = ["chat", "new chat", "untitled"].includes(rawTitle.trim().toLowerCase()) ? oneLine(firstPrompt, 90) || rawTitle : rawTitle;
  const uuid = cleanText(raw.uuid);
  const createdAt = cleanText(raw.created_at);
  const charCount = messages.reduce((sum, message) => sum + message.char_count, 0);
  const filename = `${isoDate(createdAt) || "未知日期"}_设计_${String(ordinal).padStart(2, "0")}_${slugify(rawTitle)}_${uuid.slice(0, 8) || ordinal}.md`;
  return {
    ordinal,
    uuid,
    title,
    summary: "",
    created_at: createdAt,
    updated_at: cleanText(raw.updated_at),
    month: monthOf(createdAt),
    account_uuid: "",
    project: cleanText(typeof raw.project === "object" ? raw.project?.name || raw.project?.uuid : raw.project),
    category: "产品与设计",
    source_type: "设计对话",
    message_count: messages.length,
    human_count: humanMessages.length,
    assistant_count: assistantMessages.length,
    attachment_count: messages.reduce((sum, message) => sum + message.attachments.length, 0),
    file_count: 0,
    char_count: charCount,
    priority: recoveryPriority(messages.length, charCount, 0, 0),
    first_prompt: oneLine(firstPrompt, 320),
    markdown_file: `markdown/${filename}`,
    messages,
    search_text: [title, ...messages.map((message) => message.text)].join("\n").toLowerCase(),
  };
}

function normalizeDesignMessage(message, sequence) {
  const nested = message.content && typeof message.content === "object" && !Array.isArray(message.content) ? message.content : {};
  const [text, types] = designMessageText(message);
  const attachments = (nested.attachments || []).filter(Boolean).map((item) => ({
    file_name: cleanText(item.file_name || item.fileName || item.name || item.title),
    file_type: cleanText(item.file_type || item.type),
    file_size: item.file_size || item.size || 0,
    extracted_content: cleanText(item.extracted_content || item.content),
  }));
  return {
    sequence,
    uuid: cleanText(message.uuid || nested.id),
    sender: cleanText(message.role || nested.role),
    sender_label: roleLabel(cleanText(message.role || nested.role)),
    created_at: cleanText(message.created_at || nested.timestamp),
    updated_at: cleanText(message.updated_at),
    types,
    text,
    char_count: [text, attachments.map((item) => item.extracted_content).join("\n")].join("\n").length,
    attachments,
    files: [],
  };
}

function designMessageText(message) {
  let content = message.content;
  if (content && typeof content === "object" && !Array.isArray(content) && "content" in content) {
    content = content.content;
  }
  if (typeof content === "string") return [cleanText(content), ["text"]];
  if (Array.isArray(content)) {
    const parts = [];
    const types = [];
    for (const block of content) {
      const [type, text] = blockToText(block);
      types.push(type);
      if (text.trim()) parts.push(text.trim());
    }
    return [parts.join("\n\n"), Array.from(new Set(types)).sort()];
  }
  return [scalarToText(content), ["other"]];
}

function findJson(jsonFiles, name) {
  const entry = Object.entries(jsonFiles).find(([path]) => path.endsWith(name));
  return entry ? entry[1] : null;
}

function normalizeConversation(raw, ordinal) {
  const messages = (raw.chat_messages || [])
    .filter((message) => message && typeof message === "object")
    .map((message, index) => normalizeMessage(message, index + 1));
  const humanMessages = messages.filter((message) => ["human", "user"].includes(message.sender));
  const assistantMessages = messages.filter((message) => message.sender === "assistant");
  const fullText = messages.map((message) => message.text).join("\n");
  const attachmentCount = messages.reduce((sum, message) => sum + message.attachments.length, 0);
  const fileCount = messages.reduce((sum, message) => sum + message.files.length, 0);
  const title = cleanText(raw.name || "未命名对话");
  const summary = cleanText(raw.summary);
  const firstPrompt = humanMessages[0]?.text || "";
  const uuid = cleanText(raw.uuid);
  const createdAt = cleanText(raw.created_at);
  const charCount = messages.reduce((sum, message) => sum + message.char_count, 0);
  const filename = `${isoDate(createdAt) || "未知日期"}_${String(ordinal).padStart(3, "0")}_${slugify(title)}_${uuid.slice(0, 8) || ordinal}.md`;
  return {
    ordinal,
    uuid,
    title,
    summary,
    created_at: createdAt,
    updated_at: cleanText(raw.updated_at),
    month: monthOf(createdAt),
    account_uuid: cleanText(typeof raw.account === "object" ? raw.account?.uuid : raw.account),
    category: classify([title, summary, firstPrompt.slice(0, 3000)].join("\n")),
    source_type: "普通对话",
    message_count: messages.length,
    human_count: humanMessages.length,
    assistant_count: assistantMessages.length,
    attachment_count: attachmentCount,
    file_count: fileCount,
    char_count: charCount,
    priority: recoveryPriority(messages.length, charCount, attachmentCount, fileCount),
    first_prompt: oneLine(firstPrompt, 320),
    markdown_file: `markdown/${filename}`,
    messages,
    search_text: [title, summary, fullText].join("\n").toLowerCase(),
  };
}

function normalizeMessage(message, sequence) {
  const [text, types] = messageText(message);
  const attachments = (message.attachments || []).filter(Boolean).map((item) => ({
    file_name: cleanText(item.file_name),
    file_type: cleanText(item.file_type),
    file_size: item.file_size || 0,
    extracted_content: cleanText(item.extracted_content),
  }));
  const files = (message.files || []).filter(Boolean).map((item) => ({
    file_name: cleanText(item.file_name),
    file_uuid: cleanText(item.file_uuid),
  }));
  const fullSearchText = [text, attachments.map((item) => item.extracted_content).join("\n")].join("\n");
  return {
    sequence,
    uuid: cleanText(message.uuid),
    sender: cleanText(message.sender),
    sender_label: roleLabel(message.sender),
    created_at: cleanText(message.created_at),
    updated_at: cleanText(message.updated_at),
    types,
    text,
    char_count: fullSearchText.length,
    attachments,
    files,
  };
}

function messageText(message) {
  const content = message.content;
  const parts = [];
  const types = [];
  if (Array.isArray(content) && content.length) {
    for (const block of content) {
      const [type, text] = blockToText(block);
      types.push(type);
      if (text.trim()) parts.push(text.trim());
    }
  } else if (message.text) {
    types.push("text");
    parts.push(cleanText(message.text).trim());
  }
  return [parts.join("\n\n").trim(), Array.from(new Set(types)).sort()];
}

function blockToText(block) {
  if (!block || typeof block !== "object") return ["other", scalarToText(block)];
  const type = cleanText(block.type || "other");
  if (type === "text") return [type, cleanText(block.text)];
  if (type === "thinking") return [type, `[思考过程]\n${cleanText(block.thinking || block.text)}`];
  if (type === "tool_use") return [type, `[工具调用：${cleanText(block.name || "tool")}]\n${scalarToText(block.input || block)}`];
  if (type === "tool_result") return [type, `[工具结果]\n${scalarToText(block.content || block.text || block)}`];
  return [type, `[${type}]\n${scalarToText(block)}`];
}

function markdownForChat(chat) {
  const lines = [`# ${chat.title}`, "", `- 类型：${chat.source_type}`, `- 分类：${chat.category}`, `- UUID：\`${chat.uuid}\``, `- 创建时间：${chat.created_at}`, `- 最后更新：${chat.updated_at}`, `- 消息数：${chat.message_count}`, ""];
  if (chat.summary) lines.push("## 原始摘要", "", chat.summary, "");
  lines.push("## 对话内容", "");
  for (const message of chat.messages) {
    lines.push(`### ${message.sender_label} · ${message.created_at || "时间未知"}`, "", message.text || "（空消息）", "");
    if (message.attachments.length) {
      lines.push("#### 附件", "");
      for (const attachment of message.attachments) {
        lines.push(`- \`${attachment.file_name || "未命名附件"}\` · ${attachment.file_type || "未知类型"} · ${attachment.file_size || 0} bytes`);
      }
      lines.push("");
    }
  }
  lines.push("---", "", "本文件由原始 Claude 数据导出自动整理；原始 JSON 未被修改。", "");
  return lines.join("\n");
}

function buildViewerHtml(data) {
  const safeData = JSON.stringify(data).replaceAll("</", "<\\/");
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Claude 数据恢复中心</title>
<style>
:root{--ink:#18211d;--muted:#67736c;--paper:#f4f0e8;--card:#fffdf8;--line:#ded8cc;--green:#244f3c;--sage:#dbe6dc;--gold:#d79d38;--blue:#456b7a;--shadow:0 14px 40px rgba(33,44,37,.10)}
*{box-sizing:border-box}body{margin:0;background:linear-gradient(135deg,#f7f3eb,#eef3ed);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB",sans-serif}
button,input,select{font:inherit}.shell{max-width:1600px;margin:auto;padding:26px}.hero{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:20px}
.eyebrow{letter-spacing:.12em;color:var(--green);font-weight:700;font-size:12px}.hero h1{font-family:Georgia,"Songti SC",serif;font-size:38px;line-height:1.05;margin:8px 0}.hero p{margin:0;color:var(--muted)}
.privacy{background:var(--sage);color:var(--green);padding:10px 14px;border-radius:999px;font-size:13px;white-space:nowrap}.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:16px}
.card{background:rgba(255,253,248,.92);border:1px solid var(--line);border-radius:16px;padding:16px;box-shadow:0 8px 24px rgba(33,44,37,.05)}.card .label{font-size:12px;color:var(--muted)}.card .value{font:700 27px Georgia,serif;margin-top:5px}.card .sub{font-size:12px;color:var(--muted);margin-top:4px}
.dashboard{display:grid;grid-template-columns:1.4fr 1fr;gap:14px;margin-bottom:16px}.panel{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px;box-shadow:var(--shadow)}
.panel h2{font:700 18px Georgia,"Songti SC",serif;margin:0 0 14px}.month-bars{display:flex;align-items:flex-end;gap:10px;height:120px;border-bottom:1px solid var(--line);padding:0 8px}.month{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:5px;height:100%}.month .bar{width:72%;min-width:18px;background:linear-gradient(180deg,var(--gold),#bd7921);border-radius:7px 7px 2px 2px}.month small{font-size:11px;color:var(--muted)}.month b{font-size:11px}
.category-list{display:grid;gap:8px}.category-row{display:grid;grid-template-columns:96px 1fr 34px;align-items:center;gap:8px;font-size:12px}.track{height:9px;background:#ece8df;border-radius:999px;overflow:hidden}.track i{display:block;height:100%;background:var(--green);border-radius:999px}
.workspace{display:grid;grid-template-columns:420px minmax(0,1fr);gap:14px;min-height:680px}.sidebar{background:var(--card);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);overflow:hidden;display:flex;flex-direction:column}
.filters{padding:14px;border-bottom:1px solid var(--line);display:grid;gap:9px}.search{width:100%;padding:12px 14px;border:1px solid var(--line);background:white;border-radius:12px;outline:none}.filter-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px}.filter-row select{min-width:0;border:1px solid var(--line);border-radius:10px;padding:8px;background:white}.results-meta{color:var(--muted);font-size:12px}.list{overflow:auto;max-height:760px}.item{padding:14px;border-bottom:1px solid #ebe6dc;cursor:pointer}.item:hover,.item.active{background:#edf3ed}.item h3{font-size:14px;margin:0 0 7px;line-height:1.35}.meta,.tags{display:flex;gap:6px;flex-wrap:wrap;color:var(--muted);font-size:11px}.tag{padding:3px 7px;border-radius:999px;background:#eee9df;color:#465148}.priority-高{background:#f7ddca;color:#8a3c1e}.priority-中{background:#f5ebc8;color:#765b14}
.detail{background:var(--card);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);overflow:hidden}.detail-head{padding:22px;border-bottom:1px solid var(--line);position:sticky;top:0;background:rgba(255,253,248,.97);z-index:2}.detail-head h2{font:700 24px Georgia,"Songti SC",serif;margin:0 0 10px}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.btn{border:1px solid var(--green);background:var(--green);color:white;border-radius:10px;padding:8px 11px;text-decoration:none;cursor:pointer}.btn.secondary{background:white;color:var(--green)}
.messages{padding:22px;max-height:690px;overflow:auto}.message{border-left:4px solid var(--blue);background:#f6f8f7;border-radius:4px 14px 14px 4px;padding:14px 16px;margin-bottom:14px}.message.human{border-color:var(--gold);background:#fff8e9}.message .who{font-weight:700;font-size:12px;margin-bottom:8px}.message .time{float:right;color:var(--muted);font-weight:400}.message pre{white-space:pre-wrap;word-break:break-word;font-family:inherit;line-height:1.6;margin:0;max-height:520px;overflow:auto}.attachment{margin-top:10px;padding:9px;background:white;border:1px dashed var(--line);border-radius:9px;font-size:12px}
.empty{padding:80px 30px;text-align:center;color:var(--muted)}.recovery{display:none;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:28px;box-shadow:var(--shadow)}.recovery.active{display:block}.recovery h2{font:700 25px Georgia,"Songti SC",serif}.recovery h3{margin-top:24px}.recovery li{margin:9px 0;line-height:1.6}.recovery pre{white-space:pre-wrap;background:#f1eee7;padding:15px;border-radius:12px;max-height:280px;overflow:auto}.nav{display:flex;gap:8px;margin-bottom:16px}.nav button{border:1px solid var(--green);background:white;color:var(--green);padding:9px 14px;border-radius:11px;cursor:pointer}.nav button.active{background:var(--green);color:white}
mark{background:#ffe294}.notice{font-size:12px;color:var(--muted);margin-top:14px}
@media(max-width:1000px){.cards{grid-template-columns:repeat(2,1fr)}.dashboard,.workspace{grid-template-columns:1fr}.sidebar{max-height:620px}.hero{flex-direction:column}.privacy{white-space:normal}}@media(max-width:620px){.shell{padding:14px}.cards{grid-template-columns:1fr}.filter-row{grid-template-columns:1fr}.hero h1{font-size:30px}}
</style>
</head>
<body>
<div class="shell">
  <div class="hero">
    <div><div class="eyebrow">PRIVATE · LOCAL · SEARCHABLE</div><h1>Claude Data Recovery</h1><p>把 Claude 数据导出变回可以搜索、筛选、阅读和继续使用的本地资料库。</p></div>
    <div class="privacy">🔒 单文件离线运行，不向网络上传数据</div>
  </div>
  <div class="cards" id="cards"></div>
  <div class="dashboard">
    <section class="panel"><h2>对话时间分布</h2><div class="month-bars" id="monthBars"></div></section>
    <section class="panel"><h2>主题分类</h2><div class="category-list" id="categoryList"></div></section>
  </div>
  <div class="nav"><button class="active" id="libraryTab">对话资料库</button><button id="recoveryTab">找回与申诉说明</button></div>
  <div id="libraryView" class="workspace">
    <aside class="sidebar">
      <div class="filters">
        <input class="search" id="search" placeholder="搜索标题、正文、附件内容...">
        <div class="filter-row"><select id="typeFilter"></select><select id="categoryFilter"></select><select id="priorityFilter"></select></div>
        <div class="results-meta" id="resultsMeta"></div>
      </div>
      <div class="list" id="list"></div>
    </aside>
    <main class="detail" id="detail"><div class="empty">从左侧选择一个对话。<br>也可以直接输入记得的关键词。</div></main>
  </div>
  <section class="recovery" id="recoveryView">
    <h2>最实际的找回路径</h2>
    <ol>
      <li><b>如账号被停用，可先申诉：</b>使用原账号登录 claude.ai 后进入官方申诉表。恢复原账号是唯一能原样恢复原聊天侧边栏的方式。</li>
      <li><b>完整历史无法导入新个人账号：</b>Anthropic 官方说明，数据导出不能导入另一个个人 Claude 账号，也不支持个人账号间迁移。</li>
      <li><b>恢复上下文：</b>在新账号中使用 Settings → Capabilities → Memory → Start import，粘贴下方记忆文本；官方提示该功能仍属实验性。</li>
      <li><b>继续具体项目：</b>从本页找到相关对话，点击“打开 Markdown”，把该文件上传到新 Claude 对话或项目中继续工作。</li>
    </ol>
    <div class="actions">
      <a class="btn" href="README_RECOVERY.md">打开完整恢复指南</a>
      <a class="btn secondary" href="memory_import.md">打开记忆导入文本</a>
      <button class="btn secondary" id="copyMemory">复制记忆文本</button>
    </div>
    <h3>账号记忆</h3>
    <pre id="memoryText"></pre>
    <h3>项目资料</h3>
    <pre id="projectText"></pre>
    <p class="notice">提示：你的导出包含账号资料、完整聊天和附件文本，优先使用当前离线版本。</p>
  </section>
</div>
<script type="application/json" id="dataset">${safeData}</script>
<script>
const data=JSON.parse(document.getElementById("dataset").textContent);
const chats=data.all_chats||[];
for(const chat of chats){
  chat.search_text=[
    chat.title,chat.summary,chat.first_prompt,
    ...chat.messages.flatMap(m=>[
      m.text,
      ...m.attachments.flatMap(a=>[a.file_name,a.extracted_content]),
      ...m.files.map(f=>f.file_name)
    ])
  ].filter(Boolean).join("\\n").toLowerCase()
}
const nf=new Intl.NumberFormat("zh-CN");
const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const shortDate=s=>s?String(s).slice(0,10):"未知";
const cards=[
  ["普通对话",nf.format(data.stats.conversation_count),"原 Claude 聊天"],
  ["全部消息",nf.format(data.stats.total_message_count),"含设计对话"],
  ["Design / Canvas",nf.format(data.stats.design_chat_count||0),nf.format(data.stats.design_message_count||0)+" 个设计对话"],
  ["附件与文件",nf.format((data.stats.attachment_count||0)+(data.stats.file_count||0)),"可按文件名搜索"],
  ["时间跨度",shortDate(data.stats.date_min),"至 "+shortDate(data.stats.date_max)]
];
document.getElementById("cards").innerHTML=cards.map(x=>'<div class="card"><div class="label">'+x[0]+'</div><div class="value">'+x[1]+'</div><div class="sub">'+x[2]+'</div></div>').join("");
const months=Object.entries(data.stats.month_counts||{}).sort((a,b)=>a[0].localeCompare(b[0])); const maxMonth=Math.max(...months.map(x=>x[1]),1);
document.getElementById("monthBars").innerHTML=months.map(([m,n])=>'<div class="month"><b>'+n+'</b><div class="bar" style="height:'+Math.max(5,n/maxMonth*85)+'px" title="'+escapeHtml(m)+': '+n+'"></div><small>'+escapeHtml(m.slice(2))+'</small></div>').join("");
const cats=Object.entries(data.stats.category_counts||{}).sort((a,b)=>b[1]-a[1]); const maxCat=Math.max(...cats.map(x=>x[1]),1);
document.getElementById("categoryList").innerHTML=cats.map(([c,n])=>'<div class="category-row"><span>'+escapeHtml(c)+'</span><div class="track"><i style="width:'+(n/maxCat*100)+'%"></i></div><b>'+n+'</b></div>').join("");
const search=document.getElementById("search"), typeFilter=document.getElementById("typeFilter"), categoryFilter=document.getElementById("categoryFilter"), priorityFilter=document.getElementById("priorityFilter");
function options(first,values){return ['<option value="">'+first+'</option>'].concat(values.map(v=>'<option>'+escapeHtml(v)+'</option>')).join("")}
typeFilter.innerHTML=options("全部类型",[...new Set(chats.map(x=>x.source_type))]);
categoryFilter.innerHTML=options("全部分类",[...new Set(chats.map(x=>x.category))].sort());
priorityFilter.innerHTML=options("全部优先级",["高","中","普通"]);
let current=null, filtered=[];
function matches(chat){
  const q=search.value.trim().toLowerCase().split(/\\s+/).filter(Boolean);
  return (!typeFilter.value||chat.source_type===typeFilter.value)&&(!categoryFilter.value||chat.category===categoryFilter.value)&&(!priorityFilter.value||chat.priority===priorityFilter.value)&&q.every(token=>chat.search_text.includes(token));
}
function renderList(){
  filtered=chats.filter(matches).sort((a,b)=>(b.updated_at||"").localeCompare(a.updated_at||""));
  document.getElementById("resultsMeta").textContent="找到 "+filtered.length+" / "+chats.length+" 个对话";
  document.getElementById("list").innerHTML=filtered.map(chat=>'<article class="item '+(current===chat.uuid?"active":"")+'" data-id="'+escapeHtml(chat.uuid)+'"><h3>'+escapeHtml(chat.title)+'</h3><div class="meta"><span>'+shortDate(chat.updated_at)+'</span><span>'+chat.message_count+' 条消息</span><span>'+nf.format(chat.char_count)+' 字符</span></div><div class="tags"><span class="tag">'+escapeHtml(chat.source_type)+'</span><span class="tag">'+escapeHtml(chat.category)+'</span><span class="tag priority-'+escapeHtml(chat.priority)+'">'+escapeHtml(chat.priority)+'优先</span></div></article>').join("");
  document.querySelectorAll(".item").forEach(el=>el.addEventListener("click",()=>selectChat(el.dataset.id)));
  if(!filtered.some(chat=>chat.uuid===current)){
    if(filtered[0]){current=filtered[0].uuid;location.hash=encodeURIComponent(current);renderDetail(filtered[0])}
    else{current=null;document.getElementById("detail").innerHTML='<div class="empty">没有符合条件的对话。<br>试试缩短关键词或清除筛选。</div>'}
  }
}
function messageHtml(m){
  const attachmentHtml=m.attachments.map(a=>'<div class="attachment">📎 '+escapeHtml(a.file_name||"未命名附件")+' · '+escapeHtml(a.file_type||"未知类型")+' · '+nf.format(a.file_size||0)+' bytes'+(a.extracted_content?'<details><summary>查看附件提取内容</summary><pre>'+escapeHtml(a.extracted_content)+'</pre></details>':"")+'</div>').join("");
  const fileHtml=m.files.map(f=>'<div class="attachment">📄 '+escapeHtml(f.file_name||"未命名文件")+' · '+escapeHtml(f.file_uuid)+'</div>').join("");
  return '<article class="message '+(["human","user"].includes(m.sender)?"human":"assistant")+'"><div class="who">'+escapeHtml(m.sender_label)+'<span class="time">'+escapeHtml(shortDate(m.created_at))+' · '+escapeHtml((m.types||[]).join(", "))+'</span></div><pre>'+escapeHtml(m.text||"（空消息）")+'</pre>'+attachmentHtml+fileHtml+'</article>'
}
function renderDetail(chat){
  document.getElementById("detail").innerHTML='<div class="detail-head"><h2>'+escapeHtml(chat.title)+'</h2><div class="meta"><span>'+escapeHtml(chat.source_type)+'</span><span>'+escapeHtml(chat.category)+'</span><span>'+shortDate(chat.created_at)+' → '+shortDate(chat.updated_at)+'</span><span>'+chat.message_count+' 条消息</span><span>UUID '+escapeHtml(chat.uuid)+'</span></div><div class="actions"><a class="btn" href="'+encodeURI(chat.markdown_file)+'">打开 Markdown</a><button class="btn secondary" id="copyLink">复制 UUID</button></div></div><div class="messages">'+(chat.summary?'<article class="message"><div class="who">原始摘要</div><pre>'+escapeHtml(chat.summary)+'</pre></article>':"")+chat.messages.map(messageHtml).join("")+'</div>';
  document.getElementById("copyLink").onclick=()=>copyText(chat.uuid);
}
function selectChat(id){
  const chat=chats.find(x=>x.uuid===id); if(!chat)return; current=id; location.hash=encodeURIComponent(id); renderList(); renderDetail(chat);
}
function copyText(text){if(navigator.clipboard&&location.protocol!=="file:"){navigator.clipboard.writeText(text)}else{const t=document.createElement("textarea");t.value=text;document.body.appendChild(t);t.select();document.execCommand("copy");t.remove()}}
[search,typeFilter,categoryFilter,priorityFilter].forEach(el=>el.addEventListener(el===search?"input":"change",renderList));
document.getElementById("memoryText").textContent=data.memory_import_text||"（无记忆数据）";
document.getElementById("projectText").textContent=data.project_recovery_text||"（无项目数据）";
document.getElementById("copyMemory").onclick=()=>copyText(data.memory_import_text||"");
const libraryTab=document.getElementById("libraryTab"), recoveryTab=document.getElementById("recoveryTab"), libraryView=document.getElementById("libraryView"), recoveryView=document.getElementById("recoveryView");
libraryTab.onclick=()=>{libraryTab.classList.add("active");recoveryTab.classList.remove("active");libraryView.style.display="grid";recoveryView.classList.remove("active")};
recoveryTab.onclick=()=>{recoveryTab.classList.add("active");libraryTab.classList.remove("active");libraryView.style.display="none";recoveryView.classList.add("active")};
renderList(); const hash=decodeURIComponent(location.hash.slice(1)); if(hash&&chats.some(x=>x.uuid===hash))selectChat(hash); else if(filtered[0])selectChat(filtered[0].uuid);
</script>
</body></html>`;
}

function buildMemoryText(memories) {
  return memories
    .filter((item) => item && typeof item === "object")
    .map((item) => [item.conversations_memory, scalarToText(item.project_memories)].filter(Boolean).join("\n\n"))
    .filter(Boolean)
    .join("\n\n");
}

function projectToText(projects) {
  if (!projects.length) return "没有项目数据。";
  return projects.map((project) => [
    `项目：${cleanText(project.name || "未命名项目")}`,
    `UUID：${cleanText(project.uuid)}`,
    `描述：${cleanText(project.description)}`,
    "",
    "项目提示词：",
    cleanText(project.prompt_template),
  ].join("\n")).join("\n\n");
}

function buildReadme(stats) {
  return `# Claude 数据恢复包

这是从 Claude 数据导出生成的本地恢复包。

- 对话：${stats.conversation_count}
- 消息：${stats.total_message_count}
- 附件：${stats.attachment_count}
- 项目：${stats.project_count}

打开 index.html 可以离线搜索和查看对话。`;
}

function buildAccountAppeal(user, stats) {
  const account = user && typeof user === "object" ? user : {};
  return `# 账号与申诉资料

- 姓名：${cleanText(account.full_name)}
- 邮箱：${cleanText(account.email_address)}
- 已验证手机号：${cleanText(account.verified_phone_number)}
- 账号 UUID：${cleanText(account.uuid)}
- 数据范围：${(stats.date_min || "").slice(0, 10)} 至 ${(stats.date_max || "").slice(0, 10)}
- 普通对话：${stats.conversation_count} 个
- 普通消息：${stats.conversation_message_count} 条

## 建议的申诉材料

1. 说明登录邮箱、账号 UUID 和大致被封时间。
2. 简洁描述日常用途，明确请求人工复核。
3. 如果怀疑异常登录或账号被盗，写明时间、地区和采取过的安全措施。
4. 不要重复提交大量申诉；保留提交日期和回复邮件。

## 英文申诉模板

Subject: Request for manual review of suspended Claude account

Hello Anthropic Safeguards Team,

My Claude account associated with ${cleanText(account.email_address)} was suspended. I believe this may have been an error and would appreciate a manual review. I primarily used Claude for legitimate work and personal productivity. Please let me know if you need any additional information to verify the account or clarify its usage.

Thank you.`;
}

function classify(text) {
  const haystack = oneLine(text).toLowerCase();
  const rules = [
    ["技术开发", ["python", "javascript", "typescript", "react", "api", "代码", "编程", "bug", "docker", "github"]],
    ["产品与设计", ["产品", "ux", "ui", "figma", "设计", "原型", "页面", "logo", "design"]],
    ["商业与运营", ["公司", "business", "商业", "市场", "营销", "客户", "销售", "合同", "增长"]],
    ["写作与内容", ["写作", "文案", "文章", "脚本", "内容", "视频", "copywriting"]],
    ["研究与分析", ["研究", "分析", "报告", "调研", "统计", "数据", "research", "analysis"]],
    ["翻译与语言", ["翻译", "translate", "translation", "英文", "中文", "日语"]],
    ["学习与知识", ["学习", "教程", "解释", "how to", "课程", "知识", "原理"]],
    ["个人事务", ["简历", "求职", "旅行", "生活", "个人", "家庭", "健康", "计划"]],
  ];
  let best = ["其他", 0];
  for (const [category, keywords] of rules) {
    const score = keywords.filter((keyword) => haystack.includes(keyword)).length;
    if (score > best[1]) best = [category, score];
  }
  return best[0];
}

function createZip(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const local = zipHeader(0x04034b50, [20, 0, 0, 0, 0, crc, data.length, data.length, nameBytes.length, 0]);
    chunks.push(local, nameBytes, data);
    central.push({ nameBytes, crc, size: data.length, offset });
    offset += local.length + nameBytes.length + data.length;
  }
  const centralStart = offset;
  for (const item of central) {
    const header = zipHeader(0x02014b50, [20, 20, 0, 0, 0, 0, item.crc, item.size, item.size, item.nameBytes.length, 0, 0, 0, 0, 0, item.offset]);
    chunks.push(header, item.nameBytes);
    offset += header.length + item.nameBytes.length;
  }
  const centralSize = offset - centralStart;
  chunks.push(zipHeader(0x06054b50, [0, 0, central.length, central.length, centralSize, centralStart, 0]));
  return new Blob(chunks, { type: "application/zip" });
}

function zipHeader(signature, values) {
  const sizes = signature === 0x02014b50
    ? [2, 2, 2, 2, 2, 2, 4, 4, 4, 2, 2, 2, 2, 2, 4, 4]
    : signature === 0x06054b50
      ? [2, 2, 2, 2, 4, 4, 2]
      : [2, 2, 2, 2, 2, 4, 4, 4, 2, 2];
  const length = 4 + sizes.reduce((sum, size) => sum + size, 0);
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  view.setUint32(0, signature, true);
  let pos = 4;
  values.forEach((value, index) => {
    if (sizes[index] === 2) view.setUint16(pos, value, true);
    else view.setUint32(pos, value >>> 0, true);
    pos += sizes[index];
  });
  return new Uint8Array(buffer);
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let c = index;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function countBy(items, key) {
  return items.reduce((result, item) => {
    const value = item[key] || "未知";
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

function recoveryPriority(messageCount, charCount, attachments, files) {
  if (attachments + files > 0 || charCount >= 30000 || messageCount >= 12) return "高";
  if (charCount >= 8000 || messageCount >= 5) return "中";
  return "普通";
}

function scalarToText(value) {
  if (value == null) return "";
  if (typeof value === "string") return cleanText(value);
  return JSON.stringify(value, null, 2);
}

function roleLabel(sender) {
  return { human: "我", user: "我", assistant: "Claude" }[sender] || sender || "未知";
}

function cleanText(value) {
  return value == null ? "" : String(value);
}

function oneLine(value, limit) {
  let text = cleanText(value).replace(/\s+/g, " ").trim();
  if (limit && text.length > limit) text = `${text.slice(0, limit - 1).trim()}…`;
  return text;
}

function isoDate(value) {
  return value ? cleanText(value).slice(0, 10) : "";
}

function monthOf(value) {
  return value ? cleanText(value).slice(0, 7) : "未知";
}

function slugify(value) {
  return cleanText(value).normalize("NFKC").replace(/[\\/:*?"<>|\x00-\x1f]/g, " ").replace(/\s+/g, "-").replace(/^[ ._-]+|[ ._-]+$/g, "").slice(0, 70) || "未命名对话";
}

function escapeHtml(value) {
  return cleanText(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function setStatus(message) {
  statusBox.textContent = message;
}
