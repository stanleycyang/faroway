import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { DeletionError } from "./account-deletion";
import type { AppleRevocationToken } from "./apple-revocation";

export function recoveryHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function appleDeletionConfiguration() {
  const clientId = process.env.APPLE_DELETION_CLIENT_ID;
  const clientSecret = process.env.APPLE_DELETION_CLIENT_SECRET;
  const encodedKey = process.env.ACCOUNT_DELETION_ENCRYPTION_KEY;
  if (
    !clientId ||
    !clientSecret ||
    !encodedKey ||
    !/^[A-Za-z0-9+/]{43}=$/.test(encodedKey)
  )
    return null;
  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32) return null;
  return { clientId, clientSecret, key };
}
export function sealRevocationToken(
  token: AppleRevocationToken,
  userId: string,
  key: Buffer,
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(userId));
  const payload = Buffer.concat([
    cipher.update(JSON.stringify(token), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), payload]
    .map((b) => b.toString("base64"))
    .join(".");
}
export function openRevocationToken(
  value: string,
  userId: string,
  key: Buffer,
): AppleRevocationToken {
  try {
    const parts = value.split(".").map((s) => Buffer.from(s, "base64"));
    if (parts.length !== 3) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", key, parts[0]);
    decipher.setAAD(Buffer.from(userId));
    decipher.setAuthTag(parts[1]);
    const token = JSON.parse(
      Buffer.concat([decipher.update(parts[2]), decipher.final()]).toString(
        "utf8",
      ),
    );
    if (
      typeof token.token !== "string" ||
      typeof token.clientId !== "string" ||
      !["refresh_token", "access_token"].includes(token.tokenType)
    )
      throw new Error();
    return token;
  } catch {
    throw new DeletionError("recovery_material_unavailable");
  }
}
