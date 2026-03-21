import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  if (req.method === "POST" && req.nextUrl.pathname === "/gracias") {
    const body = await req.formData();
    const token = body.get("token") as string;
    return NextResponse.redirect(
      new URL(`/gracias?token=${token}`, req.url)
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/gracias"],
};