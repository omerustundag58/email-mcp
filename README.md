# 📧 email-mcp

OpenCode için jenerik **e-posta MCP server**. IMAP ile okur/arar, SMTP ile gönderir.
Gmail, Outlook/Office 365, Yandex ve standart IMAP/SMTP sunan her sağlayıcıyla çalışır.

![Node](https://img.shields.io/badge/node-%3E%3D18-green)
![MCP](https://img.shields.io/badge/MCP-stdio-blue)
![License](https://img.shields.io/badge/license-GPL--3.0-blue)

## ✨ Özellikler

| Araç | Açıklama |
|---|---|
| `list_folders` | IMAP klasörlerini listeler |
| `search_emails` | from/to/subject/body/since/before/seen ile arama |
| `get_email` | UID ile tam gövde + ek listesi |
| `send_email` | Yeni e-posta gönderir (SMTP) |
| `reply_email` | Yanıtlar (thread: In-Reply-To/References korunur) |
| `forward_email` | Başka alıcılara iletir |
| `mark_email` | Okundu/okunmadı + yıldız |
| `delete_email` | Siler |
| `move_email` | Klasörler arası taşır |

## 🚀 Kurulum

```sh
npm install
npm run build
```

## ⚙️ Yapılandırma

`.env.example` dosyasını `.env` olarak kopyalayıp doldur:

```sh
copy .env.example .env
```

| Değişken | Açıklama | Varsayılan |
|---|---|---|
| `IMAP_HOST` / `IMAP_PORT` | IMAP sunucusu | 993 |
| `IMAP_USER` / `IMAP_PASS` | IMAP kimliği | — |
| `IMAP_TLS` | TLS açık mı | true |
| `SMTP_HOST` / `SMTP_PORT` | SMTP sunucusu | 465 |
| `SMTP_USER` / `SMTP_PASS` | SMTP kimliği | — |
| `SMTP_SECURE` | SSL açık mı | true |
| `EMAIL_DEFAULT_FOLDER` | Varsayılan klasör | INBOX |

Hazır ayarlar:

| Sağlayıcı | IMAP_HOST | SMTP_HOST | Not |
|---|---|---|---|
| Gmail | imap.gmail.com | smtp.gmail.com | **Uygulama Şifresi** gerekli (Google Hesap → Güvenlik → 2 Adımlı Doğrulama → Uygulama Şifresi) |
| Outlook | outlook.office365.com | smtp.office365.com | — |
| Yandex | imap.yandex.com | smtp.yandex.com | — |

> 🔑 Gmail'de normal hesap şifresi çalışmaz. Mutlaka uygulama şifresi üret.

## 🔌 OpenCode'a bağlama

`opencode.jsonc` dosyasına (proje kökü veya global `~/.config/opencode/opencode.jsonc`) — hazır şablon için [`opencode.jsonc.example`](opencode.jsonc.example) dosyasına bak:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "email": {
        "type": "local",
        "command": ["node", "C:/Projeler/email-mcp/dist/index.js"],
        "environment": {
          "IMAP_HOST": "{env:IMAP_HOST}",
          "IMAP_PORT": "{env:IMAP_PORT}",
          "IMAP_USER": "{env:IMAP_USER}",
          "IMAP_PASS": "{env:IMAP_PASS}",
          "SMTP_HOST": "{env:SMTP_HOST}",
          "SMTP_PORT": "{env:SMTP_PORT}",
          "SMTP_USER": "{env:SMTP_USER}",
          "SMTP_PASS": "{env:SMTP_PASS}"
        }
      }
    }
  }
}
```

Sonra:

```sh
opencode mcp list   # email connected görmelisin
```

## ✍️ Şık e-posta (markdown + imza)

`send_email`'e düz `text` yerine `markdown` ver — server şık, responsive,
inline-CSS'li HTML'e çevirir (Outlook dahil her istemcide düzgün görünür):

- `markdown`: `# başlık`, tablo, alıntı, kod bloğu, link destekler
- İmza gömülü default'tur (asistan imzası); `EMAIL_SIGNATURE` ile değiştirilir, `off` ile kapatılır

## 🔔 PROMT trigger

Konusu `PROMT` olan okunmamış mail = asistana talimat. `email_check_promt`
tool'u bunları getirir ve okundu işaretler (tekrar tetiklenmez).
Sürekli izleme için: `node watch.mjs 60` (60sn aralıkla kontrol eder).

## ✅ Doğrulama

```sh
npm run build   # tsc, temiz
npm run smoke   # MCP handshake + 9 tool listelenir
```

## 🛡️ Notlar

- Şifreler hiçbir dosyaya yazılmaz; yalnızca ortam değişkenlerinden okunur.
- Her tool çağrısı kendi IMAP bağlantısını açıp kapatır — kalıcı state tutulmaz.
- UID'ler her çağrıda `{ uid: true }` ile kullanılır; sequence/UID karışması yoktur.
- `get_email` gövdeyi 20.000 karakterde keser (bağlamı şişirmemek için); eklerin yalnızca metadata'sı döner.

## 📄 Lisans

GPL-3.0-or-later — bkz. [LICENSE](LICENSE).
