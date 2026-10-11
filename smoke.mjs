import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const proc = spawn(process.execPath, [path.join(dir, "dist", "index.js")], { cwd: dir });
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
proc.stderr.on("data", (d) => process.stderr.write(d));

function send(o) {
  proc.stdin.write(JSON.stringify(o) + "\n");
}
const waitFor = async (id, ms = 8000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const r = responses.find((x) => x.id === id);
    if (r) return r;
    await new Promise((r2) => setTimeout(r2, 50));
  }
  throw new Error("timeout id=" + id);
};

send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke", version: "0.0.0" } } });
const init = await waitFor(1);
console.log("initialize:", init.result?.serverInfo);
send({ jsonrpc: "2.0", method: "notifications/initialized" });
send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
const list = await waitFor(2);
console.log("tools:", list.result?.tools?.map((t) => t.name).join(", "));
const names = (list.result?.tools ?? []).map((t) => t.name);
const expected = ["list_folders", "search_emails", "get_email", "send_email", "reply_email", "forward_email", "mark_email", "delete_email", "move_email"];
const missing = expected.filter((n) => !names.includes(n));
if (missing.length) {
  console.error("MISSING:", missing.join(", "));
  process.exit(1);
}
// Hatalı çağrı testi: get_email kimliksiz çalışmamalı ama düzgün JSON-RPC hatası dönmeli
send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_email", arguments: { uid: 1 } } });
const call = await waitFor(3);
console.log("call get_email (beklenen hata, kimlik yok):", JSON.stringify(call).slice(0, 300));
console.log("SMOKE OK");
proc.kill();
