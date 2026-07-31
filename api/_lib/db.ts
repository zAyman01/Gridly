import mongoose from "mongoose";
import dns from "dns";
import { env } from "./config";

// ─── DNS fix for Atlas SRV ────────────────────────────────────
// `mongodb+srv://` resolves the host set via a DNS SRV record
// (`_mongodb._tcp.<cluster>`) plus a TXT record. Many local / ISP /
// Windows resolvers cannot answer SRV queries, which surfaces as
// `querySrv ENOTFOUND` / `ENODATA` and the connection never opens.
// Forcing Node's resolver to public DNS servers (which support SRV)
// and preferring IPv4 makes the lookup succeed.
//
// Development only. A managed host resolves SRV correctly through its own
// resolver, which is nearer and faster; pinning every lookup in a serverless
// function to a public resolver only adds latency and a dependency on an
// egress path that may not exist.
if (!env.IS_PRODUCTION) {
  dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
  if (typeof dns.setDefaultResultOrder === "function") {
    dns.setDefaultResultOrder("ipv4first");
  }
}

declare global {
  var mongooseCache: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
}
global.mongooseCache = global.mongooseCache || { conn: null, promise: null };

const options: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
};

export async function connectDB(): Promise<typeof mongoose> {
  if (global.mongooseCache.conn) return global.mongooseCache.conn;
  if (!global.mongooseCache.promise) {
    global.mongooseCache.promise = mongoose.connect(env.MONGODB_URI, options);
  }
  try {
    global.mongooseCache.conn = await global.mongooseCache.promise;
  } catch (err) {
    // Reset so the next request retries instead of reusing a rejected promise.
    global.mongooseCache.promise = null;
    throw err;
  }
  return global.mongooseCache.conn;
}

/** 1 = connected. Used by /api/health so a green check means the DB answered. */
export function isDBConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
