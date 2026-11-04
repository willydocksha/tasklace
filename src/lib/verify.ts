import { createHash } from "node:crypto";
import { sql } from "./db";
import { sendMail } from "./mail";

const HOURS = 24;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

// only same-site relative paths are allowed as a redirect target
export const safeNext = (next: unknown) => (typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/boards");

// public base url, e.g. https://tasklace.vercel.app
export const originOf = (req: Request) => process.env.APP_URL?.replace(/\/$/, "") || new URL(req.url).origin;

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// html paragraph back to plain text for the text/plain part
const toText = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

// one layout for every app email: brand header, paragraphs, optional button, no-reply footer
function composeEmail({ origin, paragraphs, button, note }: { origin?: string; paragraphs: string[]; button?: { label: string; href: string }; note?: string }) {
  // logo image only when we know the public url; the wordmark alone still reads fine
  const logo = origin ? `<td style="padding:0 8px 0 0"><img src="${origin}/logo-mark.png" width="28" height="28" alt="" style="display:block;border:0" /></td>` : "";
  const header = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse"><tr>${logo}<td style="padding:0;font-size:20px;font-weight:700;letter-spacing:-0.3px"><span style="color:#0f1c4d">Task</span><span style="color:#12a3c9">lace</span></td></tr></table>`;
  const p = (h: string) => `<p style="margin:0 0 14px">${h}</p>`;
  const cta = button
    ? `<p style="margin:20px 0"><a href="${button.href}" style="display:inline-block;background:#0c66e4;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:600">${button.label}</a></p>
      <p style="margin:0 0 14px;color:#64748b;font-size:13px">Tombol tidak berfungsi? Salin dan buka tautan berikut di browser:<br /><a href="${button.href}" style="color:#0c66e4;word-break:break-all">${button.href}</a></p>`
    : "";
  const footer = "Email ini dikirim otomatis oleh Tasklace. Mohon tidak membalas email ini.";
  const html = `<div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:auto;padding:28px 24px;color:#1e293b;font-size:15px;line-height:1.6">
      ${header}
      ${paragraphs.map(p).join("\n      ")}
      ${cta}
      ${note ? `<p style="margin:0 0 14px;color:#64748b;font-size:13px">${note}</p>` : ""}
      <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0 12px" />
      <p style="margin:0;color:#94a3b8;font-size:12px">${footer}</p>
    </div>`;
  // plain text mirrors the html, link spelled out
  const text = [...paragraphs.map(toText), ...(button ? [`${button.label}: ${button.href}`] : []), ...(note ? [toText(note)] : []), "—", footer].join("\n\n");
  return { text, html };
}

// email a fresh verification link; older links for this user stop working
export async function sendVerification(user: { id: string; name: string; email: string }, origin: string, next: string) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  await sql`delete from email_tokens where user_id = ${user.id} and purpose = 'verify'`;
  await sql`insert into email_tokens (token_hash, user_id, purpose, next, expires_at, created_at)
    values (${sha(token)}, ${user.id}, 'verify', ${safeNext(next)}, ${Date.now() + HOURS * 3600_000}, ${Date.now()})`;
  const link = `${origin}/api/auth/verify?token=${token}`;
  const mail = composeEmail({
    origin,
    paragraphs: [
      `Halo ${escape(user.name)},`,
      "Terima kasih telah mendaftar di Tasklace. Untuk mulai menggunakan akunmu, silakan verifikasi alamat email ini melalui tautan di bawah.",
    ],
    button: { label: "Verifikasi Email", href: link },
    note: `Tautan ini berlaku selama ${HOURS} jam. Jika kamu tidak merasa mendaftar di Tasklace, abaikan email ini. Akun tidak akan diaktifkan tanpa verifikasi.`,
  });
  await sendMail(user.email, "Verifikasi Akun Tasklace Kamu", mail.text, mail.html);
}

// consume a verification token; returns the user id and where to go next
export async function consumeVerification(token: string) {
  const [row] = await sql<{ user_id: string; next: string | null }[]>`
    delete from email_tokens where token_hash = ${sha(token)} and purpose = 'verify' and expires_at > ${Date.now()}
    returning user_id, next`;
  if (!row) return null;
  await sql`update users set email_verified_at = coalesce(email_verified_at, ${Date.now()}) where id = ${row.user_id}`;
  return { userId: row.user_id, next: safeNext(row.next) };
}

// seconds since the last verification email, to throttle resends
export async function lastSentAgo(userId: string) {
  const [r] = await sql<{ created_at: number }[]>`select created_at from email_tokens where user_id = ${userId} and purpose = 'verify' order by created_at desc limit 1`;
  return r ? (Date.now() - r.created_at) / 1000 : Infinity;
}

// email a confirm link to the new address; the change applies only after it is clicked
export async function sendEmailChange(user: { id: string; name: string }, newEmail: string, origin: string) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  await sql`delete from email_tokens where user_id = ${user.id} and purpose = 'email'`;
  await sql`insert into email_tokens (token_hash, user_id, purpose, data, expires_at, created_at)
    values (${sha(token)}, ${user.id}, 'email', ${newEmail}, ${Date.now() + HOURS * 3600_000}, ${Date.now()})`;
  const link = `${origin}/api/auth/email-change?token=${token}`;
  const mail = composeEmail({
    origin,
    paragraphs: [
      `Halo ${escape(user.name)},`,
      `Kami menerima permintaan untuk mengganti email akun Tasklace kamu menjadi <b>${escape(newEmail)}</b>. Konfirmasi perubahan ini melalui tautan di bawah.`,
    ],
    button: { label: "Konfirmasi Email Baru", href: link },
    note: `Tautan ini berlaku selama ${HOURS} jam. Jika kamu tidak meminta perubahan ini, abaikan email ini. Email akunmu tidak akan berubah.`,
  });
  await sendMail(newEmail, "Konfirmasi Perubahan Email Tasklace", mail.text, mail.html);
}

// apply a pending email change; null when the link is bad or the address got taken
export async function consumeEmailChange(token: string) {
  const [row] = await sql<{ user_id: string; data: string }[]>`
    delete from email_tokens where token_hash = ${sha(token)} and purpose = 'email' and expires_at > ${Date.now()}
    returning user_id, data`;
  if (!row?.data) return null;
  const [taken] = await sql`select 1 from users where email = ${row.data} and id <> ${row.user_id}`;
  if (taken) return null;
  const [old] = await sql<{ email: string; name: string }[]>`select email, name from users where id = ${row.user_id}`;
  await sql`update users set email = ${row.data}, email_verified_at = coalesce(email_verified_at, ${Date.now()}) where id = ${row.user_id}`;
  // let the old address know, in case this was not the owner
  const mail = composeEmail({
    origin: process.env.APP_URL?.replace(/\/$/, ""),
    paragraphs: [
      `Halo ${escape(old.name)},`,
      `Email akun Tasklace kamu telah diubah menjadi <b>${escape(row.data)}</b>. Mulai sekarang, gunakan email tersebut untuk masuk.`,
      "Jika kamu yang melakukan perubahan ini, tidak ada yang perlu dilakukan. Jika bukan, segera hubungi admin Tasklace untuk mengamankan akunmu.",
    ],
  });
  await sendMail(old.email, "Email Akun Tasklace Kamu Telah Diubah", mail.text, mail.html).catch(console.error);
  return row.user_id;
}
