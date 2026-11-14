import { env } from "@/lib/env";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
};

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/**
 * Development mailer: prints the message, including any order link, to the
 * server log. Replaced by an SMTP or API driver when real email is wired.
 */
class ConsoleMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    console.info(
      `\n──── mail ────\nto: ${message.to}\nsubject: ${message.subject}\n\n${message.text}\n──────────────\n`,
    );
  }
}

if (env.MAIL_DRIVER !== "console") {
  throw new Error(
    "MAIL_DRIVER is set to SMTP, but real email delivery is not implemented yet. Keep the console driver until the deploy-ready phase.",
  );
}

export const mailer: Mailer = new ConsoleMailer();
