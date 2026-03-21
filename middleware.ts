import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  if (req.method === "POST" && req.nextUrl.pathname === "/gracias") {
    try {
      const body = await req.formData();
      const token = body.get("token") as string;
      if (token) {
        return NextResponse.redirect(
          new URL(`/gracias?token=${token}`, req.url),
          { status: 303 }
        );
      }
    } catch {
      // si falla, continuar normal
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/gracias"],
};