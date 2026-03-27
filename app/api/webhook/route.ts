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

async function getPaymentStatus(token: string) {
  const params: Record<string, string> = { apiKey: API_KEY, token };
  params.s = signParams(params);

  const res = await fetch(`${FLOW_API_URL}/payment/getStatus`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });

  return await res.json();
}

async function procesarCompra(compra: any, token: string) {
  if (compra.estado === "completado") return NextResponse.json({ ok: true });

  const { data: numerosDisponibles } = await supabase
    .from("numeros")
    .select("id")
    .eq("vendido", false);

  if (!numerosDisponibles || numerosDisponibles.length < compra.cantidad) {
    return NextResponse.json({ error: "No hay números disponibles" }, { status: 400 });
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
      payment_id: token,
      numeros_asignados: elegidos,
    })
    .eq("preference_id", compra.preference_id);

  const numerosFormateados = elegidos
    .map((n: number) => String(n).padStart(3, "0"))
    .join(", ");

  await resend.emails.send({
    from: "Rifa Consuelo <rifa@latidosparaconsuelo.cl>",
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

  return NextResponse.json({ ok: true });
}

async function rechazarCompra(compra: any) {
  if (compra.estado === "rechazado") return NextResponse.json({ ok: true });

  if (compra.numeros_asignados?.length > 0) {
    await supabase
      .from("numeros")
      .update({
        vendido: false,
        comprador_nombre: null,
        comprador_email: null,
        comprador_telefono: null,
        fecha_compra: null,
      })
      .in("id", compra.numeros_asignados);
  }

  await supabase
    .from("compras")
    .update({ estado: "rechazado" })
    .eq("preference_id", compra.preference_id);

  await resend.emails.send({
    from: "Rifa Consuelo <rifa@latidosparaconsuelo.cl>",
    to: compra.email,
    subject: "Tu pago no fue procesado",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #64748b;">Hola ${compra.nombre}</h1>
        <p>Lamentablemente tu pago no fue procesado correctamente y tus números han sido liberados.</p>
        <p>Si deseas participar puedes intentarlo nuevamente en <a href="https://rifa.latidosparaconsuelo.cl">rifa.latidosparaconsuelo.cl</a></p>
        <p style="color: #64748b; font-size: 14px;">Si tienes dudas contáctanos respondiendo este correo.</p>
      </div>
    `,
  });

  console.log("Compra rechazada y números liberados:", compra.preference_id);
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const body = await req.formData();
  const token = body.get("token") as string;

  console.log("Webhook token recibido:", token);

  if (!token) return NextResponse.json({ ok: true });

  // Consultar estado real del pago en Flow
  const payment = await getPaymentStatus(token);
  console.log("Flow payment status:", JSON.stringify(payment));

  // Buscar compra por token o por commerceOrder
  let compra = null;

  const { data: compraPorToken } = await supabase
    .from("compras")
    .select("*")
    .eq("payment_id", token)
    .single();

  if (compraPorToken) {
    compra = compraPorToken;
  } else if (payment.commerceOrder) {
    const { data: compraPorOrder } = await supabase
      .from("compras")
      .select("*")
      .eq("preference_id", payment.commerceOrder)
      .single();
    compra = compraPorOrder;
  }

  if (!compra) {
    // Último fallback: compra pendiente más reciente
    const { data: compraPendiente } = await supabase
      .from("compras")
      .select("*")
      .eq("estado", "pendiente")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    compra = compraPendiente;
  }

  if (!compra) return NextResponse.json({ ok: true });

  // Si getStatus funcionó, usar el status real
  if (payment.status !== undefined && payment.code !== 105) {
    if (payment.status === 2) {
      return await procesarCompra(compra, token);
    } else {
      return await rechazarCompra(compra);
    }
  }

  // Si getStatus falló (105), procesar igual como antes
  if (compra.estado === "completado" || compra.estado === "rechazado") {
    return NextResponse.json({ ok: true });
  }

  return await procesarCompra(compra, token);
}