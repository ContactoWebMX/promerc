import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decryptSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

const publicPrefixes = ["/login", "/reset-password"];

// Chequeo optimista por presencia/validez de cookie — nunca toca la BD.
// La autorización real vive en src/lib/auth/dal.ts (verifySession()).
export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublicRoute = publicPrefixes.some((prefix) =>
    path.startsWith(prefix),
  );

  const cookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = await decryptSession(cookie);

  if (!isPublicRoute && !session?.userId) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (isPublicRoute && session?.userId) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};
