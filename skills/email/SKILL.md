---
name: email
description: iCloud e-postasını oku, ara, gönder, yanıtla ve yönet (email MCP server üzerinden). E-posta ile ilgili her istekte kullan.
---

# E-posta Skilli

`email` MCP server'ının tool'larını kullan. Asla IMAP/SMTP scripti yazma,
kütüphane çağırma veya `dist/index.js`'i elle çalıştırma — her işlem için
aşağıdaki tool'ları çağır.

## Tool'lar

- `email_list_folders` — klasörleri listele
- `email_search_emails` — ara (`from/to/subject/body/since/before/seen/flagged/limit`)
- `email_get_email` — UID ile tam gövde + ek metadata'sı
- `email_send_email` — yeni gönderi
- `email_reply_email` — yanıtla (thread korunur, `replyAll` opsiyonel)
- `email_forward_email` — ilet
- `email_mark_email` — okundu/okunmadı (`seen`), yıldız (`flagged`)
- `email_delete_email` — sil
- `email_move_email` — klasöre taşı

## Kurallar

- Varsayılan klasör INBOX'tur; kullanıcı başka klasör demedikçe belirtme.
- `search_emails` özet döner; gövde lazımsa `get_email` çağır.
- Göndermeden önce alıcıyı kullanıcıya teyit ettir.
- Silme ve taşıma işlemini kullanıcı açıkça onaylamadan yapma.
- UID'ler `search_emails` çıktısından gelir; tahmin etme, uydurma.
