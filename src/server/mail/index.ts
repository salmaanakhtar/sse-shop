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

export const mailer: Mailer = new ConsoleMailer();
