import nodemailer from "nodemailer";
import { logger } from "@/lib/logger";

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** 寄送服務之冪等鍵（Resend 支援），避免重試時重複寄出 */
  idempotencyKey?: string;
}

export interface MailResult {
  id?: string;
}

export interface Mailer {
  readonly name: string;
  send(msg: MailMessage): Promise<MailResult>;
}

class ResendMailer implements Mailer {
  readonly name = "resend";
  constructor(private apiKey: string, private from: string) {}
  async send(msg: MailMessage): Promise<MailResult> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(msg.idempotencyKey ? { "Idempotency-Key": msg.idempotencyKey } : {}),
      },
      body: JSON.stringify({ from: this.from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend 寄送失敗（HTTP ${res.status}）：${body.slice(0, 300)}`);
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { id: data.id };
  }
}

class SmtpMailer implements Mailer {
  readonly name = "smtp";
  private transport;
  constructor(opts: { host: string; port: number; secure: boolean; user?: string; pass?: string }, private from: string) {
    this.transport = nodemailer.createTransport({
      host: opts.host,
      port: opts.port,
      secure: opts.secure,
      auth: opts.user ? { user: opts.user, pass: opts.pass } : undefined,
    });
  }
  async send(msg: MailMessage): Promise<MailResult> {
    const info = await this.transport.sendMail({
      from: this.from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      headers: msg.idempotencyKey ? { "X-Idempotency-Key": msg.idempotencyKey } : undefined,
    });
    return { id: info.messageId };
  }
}

/** 開發／未設定寄信服務時使用：僅寫入日誌，不實際寄出 */
class ConsoleMailer implements Mailer {
  readonly name = "console";
  async send(msg: MailMessage): Promise<MailResult> {
    logger.info("［Console Mailer］模擬寄送 Email", { to: msg.to, subject: msg.subject });
    return { id: `console-${Date.now()}` };
  }
}

export function createMailer(): Mailer {
  const provider = process.env.EMAIL_PROVIDER ?? "console";
  const from = process.env.EMAIL_FROM ?? "通學區案件系統 <no-reply@example.com>";
  if (provider === "resend") {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("EMAIL_PROVIDER=resend 但未設定 RESEND_API_KEY");
    return new ResendMailer(key, from);
  }
  if (provider === "smtp") {
    const host = process.env.SMTP_HOST;
    if (!host) throw new Error("EMAIL_PROVIDER=smtp 但未設定 SMTP_HOST");
    return new SmtpMailer(
      {
        host,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === "true",
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      from,
    );
  }
  return new ConsoleMailer();
}
