# 🤖 Otomatik Kurulum Promptu

Aşağıdaki metni OpenCode'da çalışan herhangi bir modele yapıştır — gerisini o halleder
(klonlar, kurar, `opencode.jsonc`'ye ekler, test eder).

---

```
https://github.com/omerustundag58/email-mcp reposundaki e-posta MCP server'ı
bu makineye kur ve OpenCode'a bağla:

1. Repoyu C:/Projeler/email-mcp konumuna klonla (klasör yoksa oluştur).
2. İçine girip `npm install` + `npm run build` çalıştır (Windows'ta npm.cmd kullan).
3. Bana e-posta bilgilerimi sor: IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASS,
   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS. Gmail ise uygulama şifresi
   gerektiğini hatırlat. Vermediğim değerler için varsayılanları kullan
   (IMAP 993, SMTP 465, TLS açık).
4. Proje kökündeki opencode.jsonc dosyasına (yoksa oluştur) repodaki
   opencode.jsonc.example şablonunu uyarlayarak "email" MCP server'ını ekle.
   Şifreleri dosyaya GÖMME; {env:...} referansı kullan ve ilgili ortam
   değişkenlerini bu oturumda export et.
5. `npm run smoke` ile doğrula, sonra `opencode mcp list` ile
   "email connected" durumunu teyit et.
6. Bağlantı kurulunca `list_folders` tool'unu çağırarak uçtan uca test et.

Kurallara dikkat: AGENTS.md dosyasındaki talimatlara uy.
```

---
