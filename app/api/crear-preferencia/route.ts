import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { supabase } from "@/lib/supabase";

const FLOW_API_URL = "https://www.flow.cl/api";
const API_KEY = process.env.FLOW_API_KEY!;
const SECRET_KEY = process.env.FLOW_SECRET_KEY!;

function signParams(params: Record<string, string>): string {
  const keys = Object.keys(params).sort();
  const toSign = keys.map((k) => k + params[k]).join("");
  return createHmac("sha256", SECRET_KEY).update(toSign).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const { nombre, email, telefono, cantidad } = await req.json();

    const precio = cantidad === 1 ? 2000 : 5000;
    const commerceOrder = `rifa-${Date.now()}`;

    const params: Record<string, string> = {
      apiKey: API_KEY,
      commerceOrder,
      subject: `Rifa Consuelo - ${cantidad} numero${cantidad > 1 ? "s" : ""}`,
      amount: String(precio),
      email,
      urlConfirmation: `${process.env.NEXT_PUBLIC_URL}/api/webhook`,
      urlReturn: `${process.env.NEXT_PUBLIC_URL}/api/retorno`,
    };

    params.s = signParams(params);

    const body = new URLSearchParams(params);

    const res = await fetch(`${FLOW_API_URL}/payment/create`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const data = await res.json();

    console.log("Flow response:", JSON.stringify(data));

    if (!data.url || !data.token) {
      return NextResponse.json(
        { error: "Error al crear pago", detail: data },
        { status: 500 }
      );
    }

    // Guardar compra con el token de Flow
    await supabase.from("compras").insert({
      preference_id: commerceOrder,
      nombre,
      email,
      telefono,
      cantidad,
      estado: "pendiente",
      payment_id: data.token,
    });

    return NextResponse.json({ url: `${data.url}?token=${data.token}` });
  } catch (err) {
    console.error("Error crear-preferencia:", err);
    return NextResponse.json(
      { error: "Error interno", detail: String(err) },
      { status: 500 }
    );
  }
}