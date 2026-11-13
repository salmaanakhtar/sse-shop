import { z } from "zod";

/**
 * Environment is validated once, at module load. A missing secret fails the
 * boot loudly instead of surfacing as a confusing runtime error mid-checkout.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_URL_TEST: z.string().min(1).optional(),

  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters; generate one with `openssl rand -base64 32`"),
  BETTER_AUTH_URL: z.string().min(1, "BETTER_AUTH_URL is required"),
  /** Extra origins allowed to call Better Auth, comma separated. */
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().optional(),

  NEXT_PUBLIC_STORE_URL: z.string().default("http://localhost:3000"),
  ADMIN_HOST: z.string().default("admin.localhost"),

  UPLOADS_DIR: z.string().default("./data/uploads"),
  MEDIA_BASE_URL: z.string().default("http://localhost:3000/media"),

  PAYMENT_PROVIDER: z.enum(["mock", "stripe"]).default("mock"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  MAIL_DRIVER: z.enum(["console", "smtp"]).default("console"),
  SMTP_URL: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

function parseEnv(source: NodeJS.ProcessEnv): Env {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) return parsed.data;

  const details = parsed.error.issues
    .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid environment:\n${details}\nCopy .env.example to .env.local and fill it in.`);
}

export const env = parseEnv(process.env);
