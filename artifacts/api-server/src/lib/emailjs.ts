import { logger } from "./logger";

const SERVICE_ID = process.env["EMAILJS_SERVICE_ID"] || "";
const TEMPLATE_ID = process.env["EMAILJS_TEMPLATE_ID"] || "";
const PUBLIC_KEY = process.env["EMAILJS_PUBLIC_KEY"] || "";

export async function sendEmailAlert(subject: string, body: string): Promise<void> {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) return;
  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: SERVICE_ID,
        template_id: TEMPLATE_ID,
        user_id: PUBLIC_KEY,
        template_params: {
          subject,
          message: body,
          to_name: "Admin",
          from_name: "Alpha Circle Bot",
        },
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "EmailJS send failed");
    }
  } catch (e) {
    logger.warn({ e }, "EmailJS request error — continuing");
  }
}

export function fmt(lines: string[]): string {
  return lines.join("\n");
}
