// Sürekli trigger izleyici: PROMT konulu okunmamış mail gelince yazdırır.
// Kullanım: node watch.mjs [saniye]  (varsayılan 60sn)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const dir = path.dirname(fileURLToPath(import.meta.url));
const env = { ...process.env };
fs.readFileSync(path.join(dir, ".env"), "utf8").split("\n")
  .map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
  .forEach((l) => { const i = l.indexOf("="); env[l.slice(0, i)] = l.slice(i + 1); });

const interval = Number(process.argv[2] || 60) * 1000;
const seen = new Set();

function call(tool, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [path.join(dir, "dist", "index.js")], { cwd: dir, env });
    const responses = [];
    let buf = "";
    proc.stdout.on("data", (d) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (line) responses.push(JSON.parse(line));
      }
    });
    proc.stderr.on("data", () => {});
    const send = (o) => proc.stdin.write(JSON.stringify(o) + "\n");
    const waitFor = async (id, ms = 30000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        const r = responses.find((x) => x.id === id);
        if (r) return r;
        await new Promise((r2) => setTimeout(r2, 100));
      }
      throw new Error("timeout");
    };
    (async () => {
      try {
        send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "w", version: "0" } } });
        await waitFor(1);
        send({ jsonrpc: "2.0", method: "notifications/initialized" });
        send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: tool, arguments: args } });
        const r = await waitFor(2);
        proc.kill();
        resolve(JSON.parse(r.result.content[0].text));
      } catch (e) { proc.kill(); reject(e); }
    })();
  });
}

console.log(`PROMT izleyici başladı (${interval / 1000}sn aralık). Durdurmak için Ctrl+C.`);
for (;;) {
  try {
    // markRead:false — okundu işaretlemeyi asistana bırak
    const res = await call("check_promt", { markRead: false, limit: 5 });
    for (const m of res.promt || []) {
      if (seen.has(m.uid)) continue;
      seen.add(m.uid);
      console.log(`\n🔔 PROMT [uid ${m.uid}] ${m.date} | ${m.from} | ${m.subject}\n${(m.text || "").slice(0, 1000)}\n`);
    }
  } catch (e) {
    console.error("izleme hatası:", e.message);
  }
  await new Promise((r) => setTimeout(r, interval));
}
