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
  // Verificar que es llamado por Vercel Cron
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Obtener compras en estado "procesando" de los últimos 30 minutos
  const hace30min = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: compras } = await supabase
    .from("compras")
    .select("*")
    .eq("estado", "procesando")
    .gte("created_at", hace30min);

  if (!compras || compras.length === 0) {
    return NextResponse.json({ ok: true, procesadas: 0 });
  }

  console.log(`Cron: verificando ${compras.length} compras pendientes`);

  for (const compra of compras) {
    const params: Record<string, string> = {
      apiKey: API_KEY,
      commerceId: compra.preference_id,
    };
    params.s = signParams(params);

    const res = await fetch(`${FLOW_API_URL}/payment/getStatusByCommerceId`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });

    const payment = await res.json();
    console.log(`Cron status ${compra.preference_id}:`, JSON.stringify(payment));

    if (payment.code === 105) {
      console.log("getStatusByCommerceId también da 105, saltando...");
      continue;
    }

    if (payment.status === 2) {
      // Pago aprobado — asignar números
      const { data: numerosDisponibles } = await supabase
        .from("numeros")
        .select("id")
        .eq("vendido", false);

      if (!numerosDisponibles || numerosDisponibles.length < compra.cantidad) continue;

      const shuffled = numerosDisponibles.sort(() => Math.random() - 0.5);
      const elegidos = shuffled.slice(0, compra.cantidad).map((n) => n.id);

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
          numeros_asignados: elegidos,
        })
        .eq("preference_id", compra.preference_id);

      const numerosFormateados = elegidos
        .map((n) => String(n).padStart(3, "0"))
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

    } else {
      // Pago rechazado — liberar números si los tiene
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
            <p>Lamentablemente tu pago no fue procesado y tus números han sido liberados.</p>
            <p>Puedes intentarlo nuevamente en <a href="https://rifa.latidosparaconsuelo.cl">rifa.latidosparaconsuelo.cl</a></p>
          </div>
        `,
      });
    }
  }

  return NextResponse.json({ ok: true, procesadas: compras.length });
}