const envKeys = [
  "TG_ANALYTICS_BOT_GROUP_ID",
  "TG_ANALYTICS_BOT_TOKEN",
  "S3_SECRET_ACCESS_KEY",
  "S3_ACCESS_KEY_ID",
  "S3_BUCKET",
  "S3_ENDPOINT",
  "EVM_PRIVATE_KEY_SYNAPSE",
] as const;

type ENV = Record<(typeof envKeys)[number], string>;

let env: ENV = {} as any;

export function ensureEnv() {
  for (const key of envKeys) {
    if (!Bun.env[key]) {
      throw new Error(`Environment variable ${key} is not set`);
    }
  }

  env = Object.fromEntries(envKeys.map((key) => [key, Bun.env[key]])) as ENV;
}
const isProd =
  process.env["NODE_ENV"] === "production" ||
  process.env["NODE_ENV"] === "prod";
if (!isProd) ensureEnv();

export default env;
