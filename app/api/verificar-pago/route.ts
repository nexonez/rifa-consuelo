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

  const params: Record<string, string> = { apiKey: API_KEY, token };
  params.s = signParams(params);

  const res = await fetch(`${FLOW_API_URL}/payment/getStatus`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });

  const payment = await res.json();
  console.log("Payment status:", JSON.stringify(payment));

  if (payment.status !== 2) {
    return NextResponse.json({ numeros: [] });
  }

  const commerceOrder = payment.commerceOrder;

  // Verificar si ya fue procesado
  const { data: compraExistente } = await supabase
    .from("compras")
    .select("*")
    .eq("preference_id", commerceOrder)
    .eq("estado", "completado")
    .single();

  if (compraExistente?.numeros_asignados) {
    return NextResponse.json({ numeros: compraExistente.numeros_asignados });
  }

  // Obtener compra pendiente
  const { data: compra } = await supabase
    .from("compras")
    .select("*")
    .eq("preference_id", commerceOrder)
    .single();

  if (!compra) return NextResponse.json({ numeros: [] });

  // Obtener números disponibles
  const { data: numerosDisponibles } = await supabase
    .from("numeros")
    .select("id")
    .eq("vendido", false);

  if (!numerosDisponibles || numerosDisponibles.length < compra.cantidad) {
    return NextResponse.json({ numeros: [] });
  }

  // Elegir números aleatorios
  const shuffled = numerosDisponibles.sort(() => Math.random() - 0.5);
  const elegidos = shuffled.slice(0, compra.cantidad).map((n) => n.id);

  // Marcar como vendidos
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

  // Actualizar compra
  await supabase
    .from("compras")
    .update({
      estado: "completado",
      payment_id: String(payment.flowOrder),
      numeros_asignados: elegidos,
    })
    .eq("preference_id", commerceOrder);

  // Enviar correo
  const numerosFormateados = elegidos
    .map((n) => String(n).padStart(3, "0"))
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