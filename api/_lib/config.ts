import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

// One .env, at the repo root. Found by walking up from the working directory,
// because `npm run dev:api` starts at the root while tests and tooling start
// elsewhere. dotenv never overwrites, so real environment variables (Vercel,
// CI) win over the file, and hosts without a .env just skip this entirely.
//
// Deliberately no `import.meta.url` here: Vercel compiles this file to
// CommonJS, where that is a syntax error, and it took the whole API down.
function findEnvFile(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, ".env");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const envFile = findEnvFile();
if (envFile) dotenv.config({ path: envFile });

const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

/**
 * Read a value that must never silently fall back in production — an unset
 * JWT key would otherwise sign real sessions with a secret published in this
 * repo. Outside production the fallback keeps `npm run dev` zero-config.
 */
function required(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProduction) {
    throw new Error(`[config] ${name} is required in production. Set it in the host's environment.`);
  }
  return devFallback;
}

export const env = {
  PORT: parseInt(process.env.PORT || "4000", 10),
  MONGODB_URI: required("MONGODB_URI", "mongodb://localhost:27017/gridly"),
  JWT_SECRET: required("JWT_SECRET", "dev-jwt-secret"),
  JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET", "dev-refresh-secret"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "15m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
  NODE_ENV,
  IS_PRODUCTION: isProduction,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
  CLOUDINARY_FOLDER: process.env.CLOUDINARY_FOLDER || "gridly",
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB || "10", 10),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-3.5-flash",
};

// The two keys sign different token classes. Sharing one would let a refresh
// token pass as an access token.
if (isProduction && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
  throw new Error("[config] JWT_SECRET and JWT_REFRESH_SECRET must be different values.");
}
