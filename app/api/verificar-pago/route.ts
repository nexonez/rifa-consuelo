import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { supabase } from "@/lib/supabase";
import { Resend } from "resend";

const FLOW_API_URL = "https://www.flow.cl/api";
const API_KEY = process.env.FLOW_API_KEY!;
const SECRET_KEY = process.env.FLOW_SECRET_KEY!;
const resend = new Resend(process.env.RESEND_API_KEY!);

function signParams(params: Record<string, string>): string {
  const keys = Object.keys(params).sort();
  const toSign = keys.map((k) => k + params[k]).join("");
  return createHmac("sha256", SECRET_KEY).update(toSign).digest("hex");
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "No token" }, { status: 400 });

  // Primero intentar con token
  const params: Record<string, string> = { apiKey: API_KEY, token };
  params.s = signParams(params);

  const res = await fetch(`${FLOW_API_URL}/payment/getStatus`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });

  const payment = await res.json();
  console.log("Payment status by token:", JSON.stringify(payment));

  // Si falla, buscar por commerceOrder en Supabase y usar getStatusByCommerceId
  if (payment.code === 105 || payment.status === undefined) {
    // Buscar la compra más reciente pendiente
    const { data: compra } = await supabase
      .from("compras")
      .select("*")
      .eq("estado", "pendiente")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!compra) return NextResponse.json({ numeros: [] });

    const params2: Record<string, string> = {
      apiKey: API_KEY,
      commerceId: compra.preference_id,
    };
    params2.s = signParams(params2);

    const res2 = await fetch(`${FLOW_API_URL}/payment/getStatusByCommerceId`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params2).toString(),
    });

    const payment2 = await res2.json();
    console.log("Payment status by commerceId:", JSON.stringify(payment2));

    if (payment2.status !== 2) return NextResponse.json({ numeros: [] });

    return await procesarPago(payment2, compra);
  }

  if (payment.status !== 2) return NextResponse.json({ numeros: [] });

  const { data: compra } = await supabase
    .from("compras")
    .select("*")
    .eq("preference_id", payment.commerceOrder)
    .single();

  if (!compra) return NextResponse.json({ numeros: [] });

  return await procesarPago(payment, compra);
}

async function procesarPago(payment: any, compra: any) {
  // Verificar si ya fue procesado
  const { data: compraExistente } = await supabase
    .from("compras")
    .select("*")
    .eq("preference_id", compra.preference_id)
    .eq("estado", "completado")
    .single();

  if (compraExistente?.numeros_asignados) {
    return NextResponse.json({ numeros: compraExistente.numeros_asignados });
  }

  const { data: numerosDisponibles } = await supabase
    .from("numeros")
    .select("id")
    .eq("vendido", false);

  if (!numerosDisponibles || numerosDisponibles.length < compra.cantidad) {
    return NextResponse.json({ numeros: [] });
  }

  const shuffled = numerosDisponibles.sort(() => Math.random() - 0.5);
  const elegidos = shuffled.slice(0, compra.cantidad).map((n: any) => n.id);

  await supabase
    .from("numeros")
    .update({
      vendido: true,
      comprador_nombre: compra.nombre,
      comprador_email: compra.email,
      comprador_telefono: compra.telefono,
      fecha_compra: new Date().toISOString(),
    })
    .in("id", elegidos);

  await supabase
    .from("compras")
    .update({
      estado: "completado",
      payment_id: String(payment.flowOrder),
      numeros_asignados: elegidos,
    })
    .eq("preference_id", compra.preference_id);

  const numerosFormateados = elegidos
    .map((n: number) => String(n).padStart(3, "0"))
    .join(", ");

  await resend.emails.send({
    from: "Rifa Consuelo <onboarding@resend.dev>",
    to: compra.email,
    subject: "¡Tus números de la rifa!",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #e11d48;">¡Gracias por tu apoyo, ${compra.nombre}! 💕</h1>
        <p>Tu pago fue confirmado. Estos son tus números de la rifa:</p>
        <div style="background: #fff1f2; border: 2px solid #e11d48; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
          <p style="font-size: 32px; font-weight: bold; color: #e11d48; margin: 0;">${numerosFormateados}</p>
        </div>
        <p>Guarda este correo como comprobante. ¡Mucha suerte!</p>
        <p style="color: #64748b; font-size: 14px;">Esta rifa es solidaria para apoyar los gastos médicos de Consuelo. Gracias por tu generosidad.</p>
      </div>
    `,
  });

  return NextResponse.json({ numeros: elegidos });
}