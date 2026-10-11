# AGENTS.md — AI ajanları için talimatlar

Bu repo, OpenCode için jenerik IMAP/SMTP MCP server içerir (`src/index.ts`).

## Komutlar

- `npm install` — bağımlılıklar (Windows'ta `npm.cmd` kullan)
- `npm run build` — TypeScript derleme (`tsc`), hata vermemeli
- `npm run typecheck` — `tsc --noEmit`
- `npm run smoke` — MCP handshake + tool listesi testi, kimlik bilgisi gerektirmez

## Kurallar

- IMAP UID'leri her zaman `{ uid: true }` opsiyonuyla kullan (`fetchOne`, `messageFlagsAdd/Remove`, `messageDelete`, `messageMove`). Varsayılan sequence number'dır; karıştırmak yanlış e-postaya işlem yapar.
- `search()` her zaman `{ uid: true }` ile çağrılır — opsiyonsuz düz `SEARCH` yapar ve
  sequence number döner; UID için `UID SEARCH` şart. Dönen `number[] | false`;
  `false` ihtimaline karşı `Array.isArray` ile koru.
- `messageMove` sonucundaki `uidMap` bir `Map`'tir; JSON'a dizi olarak çevir.
- Yeni tool eklerken `smoke.mjs` içindeki `expected` listesini de güncelle.
- Şifre/token hiçbir dosyaya yazılmaz; yalnızca ortam değişkenleri (`IMAP_*`, `SMTP_*`).
- E-posta gövdelerini 20.000 karakterde kes (`BODY_LIMIT`); eklerin sadece metadata'sını döndür.
