#!/usr/bin/env node
// email-mcp — Generic IMAP/SMTP MCP server for OpenCode.
// Copyright (C) 2026 omerustundag58
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// Generic IMAP/SMTP MCP server — OpenCode'da e-posta okuma/gönderme/yönetme.
// Stdio transport ile çalışır, opencode.jsonc'de "local" server olarak tanımlanır.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { marked } from "marked";
import nodemailer from "nodemailer";
import z from "zod";

const DEFAULT_FOLDER = process.env.EMAIL_DEFAULT_FOLDER || "INBOX";
const BODY_LIMIT = 20_000;

function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

function imapConfig() {
  const host = env("IMAP_HOST");
  const user = env("IMAP_USER");
  const pass = env("IMAP_PASS");
  if (!host || !user || !pass) {
    throw new Error("IMAP yapılandırması eksik: IMAP_HOST, IMAP_USER, IMAP_PASS gerekli.");
  }
  return {
    host,
    port: Number(env("IMAP_PORT", "993")),
    secure: env("IMAP_TLS", "true") !== "false",
    auth: { user, pass },
    logger: false as const,
  };
}

function smtpTransporter() {
  const host = env("SMTP_HOST");
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASS");
  if (!host || !user || !pass) {
    throw new Error("SMTP yapılandırması eksik: SMTP_HOST, SMTP_USER, SMTP_PASS gerekli.");
  }
  return nodemailer.createTransport({
    host,
    port: Number(env("SMTP_PORT", "465")),
    secure: env("SMTP_SECURE", "true") !== "false",
    auth: { user, pass },
  });
}

async function withImap<T>(folder: string, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  const client = new ImapFlow(imapConfig());
  await client.connect();
  try {
    await client.mailboxOpen(folder || DEFAULT_FOLDER);
    return await fn(client);
  } finally {
    try {
      await client.logout();
    } catch {
      /* yoksay */
    }
  }
}

function addrList(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String);
  return [String(v)];
}

function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

// --- Şık HTML e-posta (markdown -> inline CSS) ---
// E-posta istemcileri <style> bloklarını çöpe atar (özellikle Outlook),
// bu yüzden tüm stiller inline yazılır.

function getSignatureMd(): string {
  // Proje default'u: asistan imzası. EMAIL_SIGNATURE ile ezilir, "off" ile kapatılır.
  const raw = process.env.EMAIL_SIGNATURE;
  if (raw !== undefined && raw.toLowerCase() === "off") return "";
  const val = (raw ?? "").replace(/\\n/g, "\n").trim();
  if (val) return val;
  return "Bu e-posta **OpenCode asistanı** tarafından gönderildi 🤖\n[email-mcp](https://github.com/omerustundag58/email-mcp)";
}

const EMAIL_TAG_STYLES: Record<string, string> = {
  h1: "font-size:24px;line-height:1.3;color:#111827;margin:0 0 16px 0;",
  h2: "font-size:20px;line-height:1.35;color:#111827;margin:24px 0 12px 0;",
  h3: "font-size:17px;line-height:1.4;color:#111827;margin:20px 0 10px 0;",
  p: "margin:0 0 14px 0;",
  blockquote:
    "margin:0 0 14px 0;padding:10px 14px;border-left:3px solid #3b82f6;background:#eff6ff;color:#1e40af;",
  pre: "margin:0 0 14px 0;padding:12px;background:#111827;color:#f9fafb;border-radius:6px;font-size:13px;overflow-x:auto;",
  code: "font-family:Consolas,Menlo,monospace;font-size:13px;background:#f3f4f6;padding:2px 5px;border-radius:4px;",
  table: "width:100%;border-collapse:collapse;margin:0 0 14px 0;font-size:14px;",
  th: "text-align:left;padding:8px 10px;background:#1f2937;color:#ffffff;border:1px solid #374151;",
  td: "padding:8px 10px;border:1px solid #d1d5db;",
  ul: "margin:0 0 14px 0;padding-left:22px;",
  ol: "margin:0 0 14px 0;padding-left:22px;",
  li: "margin-bottom:6px;",
  hr: "border:none;border-top:1px solid #e5e7eb;margin:20px 0;",
  img: "max-width:100%;height:auto;border-radius:6px;",
};

function inlineEmailStyles(html: string): string {
  let out = html;
  for (const [tag, style] of Object.entries(EMAIL_TAG_STYLES)) {
    out = out.split(`<${tag}>`).join(`<${tag} style="${style}">`);
  }
  // nitelikli etiketler
  out = out.replace(/<a /g, '<a style="color:#2563eb;text-decoration:underline;" ');
  out = out.replace(/<pre><code( class="[^"]*")?>/g, '<pre style="' + EMAIL_TAG_STYLES.pre + '"><code style="background:transparent;padding:0;color:#f9fafb;"$1>');
  return out;
}

async function markdownToEmailHtml(md: string): Promise<string> {
  const raw = await marked.parse(md, { breaks: true });
  const body = inlineEmailStyles(raw);
  return (
    `<!doctype html><html><body style="margin:0;padding:24px 12px;background-color:#f3f4f6;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td align="center">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:600px;width:100%;background:#ffffff;border-radius:8px;">` +
    `<tr><td style="padding:32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;">${body}</td></tr>` +
    `</table></td></tr></table></body></html>`
  );
}

function withSignatureText(t: string | undefined): string | undefined {
  const sig = getSignatureMd();
  if (!sig) return t;
  return `${t ?? ""}\n\n--\n${sig}`;
}

async function withSignatureHtml(h: string | undefined): Promise<string | undefined> {
  const sig = getSignatureMd();
  if (!sig) return h;
  const sigHtml = inlineEmailStyles(await marked.parse(sig, { breaks: true }));
  return `${h ?? ""}<br><br><span style="color:#6b7280;">--<br>${sigHtml}</span>`;
}

function addrText(v: unknown): string {
  if (!v) return "";
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : (x as { text?: string }).text ?? "")).join(", ");
  if (typeof v === "string") return v;
  return (v as { text?: string }).text ?? "";
}

type Addr = { address?: string };

const server = new McpServer({ name: "email-mcp", version: "0.1.0" });

// 1. Klasörleri listele
server.registerTool(
  "list_folders",
  { description: "IMAP klasörlerini listeler (INBOX, Sent, Trash...)." },
  async () => {
    const client = new ImapFlow(imapConfig());
    await client.connect();
    try {
      const boxes = await client.list();
      return ok(boxes.map((b) => ({ path: b.path, name: b.name, delimiter: b.delimiter })));
    } finally {
      await client.logout().catch(() => {});
    }
  }
);

// 2. E-posta ara
server.registerTool(
  "search_emails",
  {
    description: "Klasörde e-posta arar. Özet liste döner; detay için get_email kullan.",
    inputSchema: {
      folder: z.string().optional().describe("Klasör (varsayılan INBOX)"),
      from: z.string().optional(),
      to: z.string().optional(),
      subject: z.string().optional(),
      body: z.string().optional(),
      text: z.string().optional().describe("Her yerde ara"),
      since: z.string().optional().describe("YYYY-MM-DD (bu tarihten sonra)"),
      before: z.string().optional().describe("YYYY-MM-DD (bu tarihten önce)"),
      seen: z.boolean().optional(),
      flagged: z.boolean().optional(),
      limit: z.number().min(1).max(100).optional().describe("Varsayılan 20"),
    },
  },
  async (args) => {
    const folder = args.folder || DEFAULT_FOLDER;
    const limit = args.limit ?? 20;
    return withImap(folder, async (client) => {
      const query: Record<string, unknown> = {};
      if (args.from) query.from = args.from;
      if (args.to) query.to = args.to;
      if (args.subject) query.subject = args.subject;
      if (args.body) query.body = args.body;
      if (args.text) query.text = args.text;
      if (args.since) {
        const d = new Date(args.since);
        if (Number.isNaN(d.getTime())) throw new Error(`Geçersiz since tarihi: ${args.since} (YYYY-MM-DD bekleniyor)`);
        query.since = d;
      }
      if (args.before) {
        const d = new Date(args.before);
        if (Number.isNaN(d.getTime())) throw new Error(`Geçersiz before tarihi: ${args.before} (YYYY-MM-DD bekleniyor)`);
        query.before = d;
      }
      if (args.seen !== undefined) query.seen = args.seen;
      if (args.flagged !== undefined) query.flagged = args.flagged;

      const found = await client.search(query, { uid: true });
      const uids: number[] = Array.isArray(found) ? found : [];
      const latest = uids.slice(-limit).reverse();
      const out: unknown[] = [];
      for (const uid of latest) {
        const msg = await client.fetchOne(String(uid), {
          envelope: true,
          internalDate: true,
          flags: true,
        }, { uid: true });
        if (!msg) continue;
        out.push({
          folder,
          uid,
          messageId: msg.envelope?.messageId,
          from: msg.envelope?.from?.map((a: Addr) => a.address),
          to: msg.envelope?.to?.map((a: Addr) => a.address),
          subject: msg.envelope?.subject,
          date: msg.envelope?.date ?? msg.internalDate,
          flags: [...(msg.flags ?? [])],
        });
      }
      return ok({ folder, total: uids.length, returned: out.length, emails: out });
    });
  }
);

// 3. E-posta detayı
server.registerTool(
  "get_email",
  {
    description: "UID ile e-postanın gövdesini ve ek bilgilerini getirir.",
    inputSchema: {
      folder: z.string().optional(),
      uid: z.number().describe("search_emails çıktısındaki uid"),
      includeHtml: z.boolean().optional().describe("HTML gövdeyi de döndür (varsayılan false)"),
    },
  },
  async (args) => {
    const folder = args.folder || DEFAULT_FOLDER;
    return withImap(folder, async (client) => {
      const msg = await client.fetchOne(String(args.uid), {
        source: true,
        envelope: true,
        flags: true,
        internalDate: true,
      }, { uid: true });
      if (!msg || !msg.source) throw new Error(`UID ${args.uid} bulunamadı.`);
      const parsed = await simpleParser(msg.source);
      const html = parsed.html === false || parsed.html == null ? "" : parsed.html.toString();
      return ok({
        folder,
        uid: args.uid,
        messageId: parsed.messageId ?? msg.envelope?.messageId,
        inReplyTo: parsed.inReplyTo,
        references: parsed.references,
        from: addrText(parsed.from),
        to: addrText(parsed.to),
        cc: addrText(parsed.cc),
        bcc: addrText(parsed.bcc),
        subject: parsed.subject,
        date: parsed.date ?? msg.internalDate,
        flags: [...(msg.flags ?? [])],
        text: (parsed.text ?? "").slice(0, BODY_LIMIT),
        textTruncated: (parsed.text ?? "").length > BODY_LIMIT,
        html: args.includeHtml ? html.slice(0, BODY_LIMIT) : undefined,
        attachments: (parsed.attachments ?? []).map((a) => ({
          filename: a.filename,
          contentType: a.contentType,
          size: a.size,
        })),
      });
    });
  }
);

// 4. E-posta gönder
server.registerTool(
  "send_email",
  {
    description: "Yeni e-posta gönderir (SMTP). markdown verilirse şık HTML'e çevrilir; EMAIL_SIGNATURE varsa imzalanır.",
    inputSchema: {
      to: z.union([z.string(), z.array(z.string())]),
      subject: z.string(),
      text: z.string().optional(),
      html: z.string().optional(),
      markdown: z.string().optional().describe("Markdown gövde — şık HTML'e çevrilir"),
      cc: z.union([z.string(), z.array(z.string())]).optional(),
      bcc: z.union([z.string(), z.array(z.string())]).optional(),
    },
  },
  async (args) => {
    if (!args.text && !args.html && !args.markdown) throw new Error("text, html veya markdown gerekli.");
    const sig = getSignatureMd();
    let text = withSignatureText(args.text);
    let html = await withSignatureHtml(args.html);
    if (args.markdown) {
      const fullMd = sig ? `${args.markdown}\n\n---\n${sig}` : args.markdown;
      html = await markdownToEmailHtml(fullMd);
      text = text ?? args.markdown;
    }
    const tx = smtpTransporter();
    const info = await tx.sendMail({
      from: env("SMTP_USER"),
      to: addrList(args.to).join(", "),
      cc: args.cc ? addrList(args.cc).join(", ") : undefined,
      bcc: args.bcc ? addrList(args.bcc).join(", ") : undefined,
      subject: args.subject,
      text,
      html,
    });
    return ok({ messageId: info.messageId, accepted: info.accepted, rejected: info.rejected });
  }
);

// Yardımcı: orijinali çek
async function fetchOriginal(folder: string, uid: number) {
  return withImap(folder, async (client) => {
    const msg = await client.fetchOne(String(uid), { source: true, envelope: true }, { uid: true });
    if (!msg || !msg.source) throw new Error(`UID ${uid} bulunamadı.`);
    const parsed = await simpleParser(msg.source);
    return { envelope: msg.envelope, parsed };
  });
}

// 5. Yanıtla
server.registerTool(
  "reply_email",
  {
    description: "Mevcut e-postaya yanıt verir (In-Reply-To/References korunur).",
    inputSchema: {
      folder: z.string().optional(),
      uid: z.number(),
      text: z.string().optional(),
      html: z.string().optional(),
      replyAll: z.boolean().optional(),
    },
  },
  async (args) => {
    if (!args.text && !args.html) throw new Error("text veya html gerekli.");
    const folder = args.folder || DEFAULT_FOLDER;
    const { envelope, parsed } = await fetchOriginal(folder, args.uid);
    const messageId = parsed.messageId ?? envelope?.messageId;
    if (!messageId) throw new Error("Orijinal Message-ID bulunamadı.");
    const to = addrText(parsed.replyTo) || addrText(parsed.from) || "";
    if (!to) throw new Error("Yanıtlanacak adres bulunamadı.");
    const cc = args.replyAll ? addrText(parsed.cc) || undefined : undefined;
    const refs = Array.isArray(parsed.references)
      ? parsed.references.join(" ")
      : (parsed.references ?? "");
    const tx = smtpTransporter();
    const info = await tx.sendMail({
      from: env("SMTP_USER"),
      to,
      cc,
      subject: parsed.subject?.startsWith("Re:") ? parsed.subject : `Re: ${parsed.subject ?? ""}`,
      text: withSignatureText(args.text),
      html: await withSignatureHtml(args.html),
      inReplyTo: messageId,
      references: [refs, messageId].filter(Boolean).join(" "),
    });
    return ok({ messageId: info.messageId, accepted: info.accepted });
  }
);

// 6. İlet
server.registerTool(
  "forward_email",
  {
    description: "E-postayı başka alıcılara iletir.",
    inputSchema: {
      folder: z.string().optional(),
      uid: z.number(),
      to: z.union([z.string(), z.array(z.string())]),
      text: z.string().optional().describe("İletinin üstüne eklenecek not"),
    },
  },
  async (args) => {
    const folder = args.folder || DEFAULT_FOLDER;
    const { parsed } = await fetchOriginal(folder, args.uid);
    const quoted =
      `\n\n---------- İletilen ileti ----------\n` +
      `Kimden: ${addrText(parsed.from)}\nTarih: ${parsed.date}\nKonu: ${parsed.subject}\n` +
      `Kime: ${addrText(parsed.to)}\n\n${parsed.text ?? ""}`;
    const tx = smtpTransporter();
    const info = await tx.sendMail({
      from: env("SMTP_USER"),
      to: addrList(args.to).join(", "),
      subject: parsed.subject?.startsWith("Fwd:") ? parsed.subject : `Fwd: ${parsed.subject ?? ""}`,
      text: withSignatureText(`${args.text ?? ""}${quoted}`),
    });
    return ok({ messageId: info.messageId, accepted: info.accepted });
  }
);

// 7. Okundu/işaret
server.registerTool(
  "mark_email",
  {
    description: "Okundu/okunmadı ve yıldız durumunu değiştirir.",
    inputSchema: {
      folder: z.string().optional(),
      uid: z.union([z.number(), z.array(z.number())]),
      seen: z.boolean().optional(),
      flagged: z.boolean().optional(),
    },
  },
  async (args) => {
    const folder = args.folder || DEFAULT_FOLDER;
    if (args.seen === undefined && args.flagged === undefined) {
      throw new Error("seen veya flagged parametrelerinden en az biri gerekli.");
    }
    const range = Array.isArray(args.uid) ? args.uid : [args.uid];
    return withImap(folder, async (client) => {
      if (args.seen === true) await client.messageFlagsAdd(range, ["\\Seen"], { uid: true });
      if (args.seen === false) await client.messageFlagsRemove(range, ["\\Seen"], { uid: true });
      if (args.flagged === true) await client.messageFlagsAdd(range, ["\\Flagged"], { uid: true });
      if (args.flagged === false) await client.messageFlagsRemove(range, ["\\Flagged"], { uid: true });
      return ok({ folder, uid: args.uid, seen: args.seen, flagged: args.flagged });
    });
  }
);

// 8. Sil
server.registerTool(
  "delete_email",
  {
    description: "E-postayı siler (Deleted + expunge).",
    inputSchema: {
      folder: z.string().optional(),
      uid: z.union([z.number(), z.array(z.number())]),
    },
  },
  async (args) => {
    const folder = args.folder || DEFAULT_FOLDER;
    const range = Array.isArray(args.uid) ? args.uid : [args.uid];
    return withImap(folder, async (client) => {
      await client.messageDelete(range, { uid: true });
      return ok({ folder, uid: args.uid, deleted: true });
    });
  }
);

// 9. Taşı
server.registerTool(
  "move_email",
  {
    description: "E-postayı başka klasöre taşır.",
    inputSchema: {
      folder: z.string().optional(),
      uid: z.union([z.number(), z.array(z.number())]),
      destFolder: z.string(),
    },
  },
  async (args) => {
    const folder = args.folder || DEFAULT_FOLDER;
    const range = Array.isArray(args.uid) ? args.uid : [args.uid];
    return withImap(folder, async (client) => {
      const result = await client.messageMove(range, args.destFolder, { uid: true });
      // uidMap bir Map'tir, JSON'a düşmez — diziye çevir
      const uidMap = result && typeof result === "object" && result.uidMap instanceof Map
        ? [...result.uidMap.entries()].map(([from, to]) => ({ from, to }))
        : undefined;
      return ok({ folder, uid: args.uid, destFolder: args.destFolder, uidMap });
    });
  }
);

async function main() {
  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
