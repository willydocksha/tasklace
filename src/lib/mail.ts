import nodemailer, { type Transporter } from "nodemailer";

// "smtp" sends real mail; "log" (dev without smtp) prints links to the server console;
// "off" (production without smtp) skips email verification entirely
export const mailMode = process.env.SMTP_HOST ? "smtp" : process.env.NODE_ENV === "production" ? "off" : "log";

let transport: Transporter | null = null;

// one smtp connection pool per server instance
function getTransport() {
  if (!transport)
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  return transport;
}

export async function sendMail(to: string, subject: string, text: string, html: string) {
  if (mailMode === "log") {
    console.log(`\n[mail] to ${to}: ${subject}\n${text}\n`);
    return;
  }
  await getTransport().sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text, html });
}
