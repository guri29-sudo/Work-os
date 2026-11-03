/**
 * Generates and holds the RSA key pair for signing JWTs.
 * Dev-only mock. Never use in production.
 *
 * Uses jose v6 which uses the Web Crypto API under Node 22.
 */
import { generateKeyPair, exportJWK } from "jose";

// jose v6 key types are opaque � use unknown for storage, cast at call sites
export interface KeyPairEntry {
  kid: string;

  privateKey: unknown;

  publicKey: unknown;
  publicJwk: Record<string, unknown>;
  createdAt: Date;
}

class KeyStore {
  private keys: KeyPairEntry[] = [];

  async generateKey(): Promise<KeyPairEntry> {
    const { privateKey, publicKey } = await generateKeyPair("RS256", {
      modulusLength: 2048,
    });

    const kid = `mock-${Date.now().toString()}-${Math.random().toString(36).slice(2, 8)}`;
    // exportJWK accepts CryptoKey from Web Crypto � cast is safe here
    const publicJwk = await exportJWK(publicKey);

    const entry: KeyPairEntry = {
      kid,
      privateKey,
      publicKey,
      publicJwk: { ...publicJwk, kid, use: "sig", alg: "RS256" },
      createdAt: new Date(),
    };

    this.keys.push(entry);
    return entry;
  }

  getPublicKeys(): Record<string, unknown>[] {
    return this.keys.map((k) => k.publicJwk);
  }

  getCurrentKey(): KeyPairEntry {
    const key = this.keys.at(-1);
    if (key === undefined) throw new Error("No keys available");
    return key;
  }

  async rotate(): Promise<KeyPairEntry> {
    const newKey = await this.generateKey();
    if (this.keys.length > 2) this.keys.shift();
    return newKey;
  }
}

export const keyStore = new KeyStore();

export async function initKeyStore(): Promise<void> {
  await keyStore.generateKey();
  console.error(`[mock-idp] Key store initialized with kid: ${keyStore.getCurrentKey().kid}`);
}
