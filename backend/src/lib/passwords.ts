import { hash, verify } from "@node-rs/argon2";

type HashOptions = NonNullable<Parameters<typeof hash>[1]>;

/** OWASP-recommended argon2id parameters (19 MiB, t=2, p=1). */
const OPTIONS = {
  algorithm: 2, // Algorithm.Argon2id (ambient const enum, avoided under verbatimModuleSyntax)
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as unknown as HashOptions;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(
  storedHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, password, OPTIONS);
  } catch {
    return false;
  }
}