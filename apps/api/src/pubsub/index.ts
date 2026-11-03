/**
 * In-process pub/sub via PostgreSQL LISTEN/NOTIFY.
 * Handles PostgreSQL 63-byte channel name limit safely.
 */
import postgres from "postgres";
import crypto from "node:crypto";
import { env } from "../env.js";

type Listener = (payload: unknown) => void;

function toPgChannel(name: string): string {
  if (name.length <= 60 && /^[a-zA-Z0-9_]+$/.test(name)) return name;
  return "cs_" + crypto.createHash("md5").update(name).digest("hex");
}

class PubSub {
  private sql: ReturnType<typeof postgres> | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private pgToLogical = new Map<string, Set<string>>();

  async connect(): Promise<void> {
    this.sql = postgres(env.DATABASE_URL, {
      max: 1,
      idle_timeout: 0,
      connect_timeout: 10,
    });

    for (const channel of this.listeners.keys()) {
      const pgCh = toPgChannel(channel);
      await this.sql.listen(pgCh, (payload) => {
        this.dispatch(channel, payload);
      });
    }
  }

  async publish(channel: string, payload: unknown): Promise<void> {
    const pgCh = toPgChannel(channel);
    try {
      const sql = postgres(env.DATABASE_URL, { max: 1 });
      await sql.notify(pgCh, JSON.stringify(payload));
      await sql.end();
    } catch {
      // In-process fallback if PG notify is unavailable
    }
    this.dispatch(channel, JSON.stringify(payload));
  }

  async subscribe(channel: string, listener: Listener): Promise<() => void> {
    const pgCh = toPgChannel(channel);
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
      if (this.sql) {
        await this.sql.listen(pgCh, (payload) => {
          this.dispatch(channel, payload);
        });
      }
    }
    const set = this.listeners.get(channel);
    if (set) {
      set.add(listener);
    }

    return () => {
      this.listeners.get(channel)?.delete(listener);
    };
  }

  private dispatch(channel: string, raw: string | undefined): void {
    if (!raw) return;
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    this.listeners.get(channel)?.forEach((fn) => {
      fn(payload);
    });
  }

  async close(): Promise<void> {
    await this.sql?.end();
    this.sql = null;
  }
}

export const pubsub = new PubSub();
