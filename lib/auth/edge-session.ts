export const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "awtmods-strict-3-admin-session-security-token-key-2026-super-secure";

export interface AdminSessionPayload {
  userId: string;
  email: string;
  role: "superadmin" | "admin";
  exp: number;
}

/**
 * Edge-Runtime session token verification using Web Crypto API.
 * Free of Node.js dependencies, runs seamlessly in Next.js Edge Middleware.
 */
export async function verifyAdminSessionTokenEdge(
  token: string | undefined | null
): Promise<AdminSessionPayload | null> {
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [payloadB64, signatureB64] = parts;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(SESSION_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Decode base64url signature to byte array
    const b64 = signatureB64.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
    const binary = atob(pad);
    const sigBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      sigBytes[i] = binary.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      enc.encode(payloadB64)
    );

    if (!isValid) return null;

    // Decode payload
    const payloadPad = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const payloadStr = atob(
      payloadPad.padEnd(payloadPad.length + ((4 - (payloadPad.length % 4)) % 4), "=")
    );
    const payload: AdminSessionPayload = JSON.parse(payloadStr);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

