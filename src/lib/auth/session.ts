import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { RoleUsuario } from "@/generated/prisma/enums";

const secretKey = process.env.SESSION_SECRET;
if (!secretKey) {
  throw new Error("Falta la variable de entorno SESSION_SECRET");
}
const encodedKey = new TextEncoder().encode(secretKey);

export const SESSION_COOKIE_NAME = "promerc_session";
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 horas (turno de trabajo)

export type SessionPayload = {
  userId: number;
  role: RoleUsuario;
  ubicacionId: number | null;
};

export async function encryptSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(new Date(Date.now() + SESSION_DURATION_MS))
    .sign(encodedKey);
}

export async function decryptSession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload) {
  const token = await encryptSession(payload);
  const expires = new Date(Date.now() + SESSION_DURATION_MS);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires,
    path: "/",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}
