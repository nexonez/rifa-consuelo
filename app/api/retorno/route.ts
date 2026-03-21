import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.formData();
  const token = body.get("token") as string;
  
  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_URL}/gracias?token=${token}`
  );
}