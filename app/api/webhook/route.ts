import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { supabase } from "@/lib/supabase";
import { Resend } from "resend";

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.type !== "payment") {
    return NextResponse.json({ ok: true });
  }

  const paymentId = body.data?.id;
  if (!paymentId) return NextResponse.json({ ok: true });

  const payment = await new Payment(client).get({ id: paymentId });

  if (payment.status !== "approved") {
    return NextResponse.json({ ok: true });
  }

  const preferenceId = payment.preference_id;

  // Verificar que no fue procesado antes
  const { data: compraExistente } = await supabase
    .from("compras")
    .select("*")
    .eq("preference_id", preferenceId)
    .eq("estado", "completado")
    .single();

  if (compraExistente) return NextResponse.json({ ok: true });

  // Obtener datos de la compra
  const { data: compra } = await supabase
    .from("compras")
    .select("*")
    .eq("preference_id", preferenceId)
    .single();

  if (!compra) return NextResponse.json({ ok: true });

  // Obtener números disponibles
  const { data: numerosDisponibles } = await supabase
    .from("numeros")
    .select("id")
    .eq("vendido", false);

  if (!numerosDisponibles || numerosDisponibles.length < compra.cantidad) {
    return NextResponse.json({ error: "No hay números disponibles" }, { status: 400 });
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
      payment_id: String(paymentId),
      numeros_asignados: elegidos,
    })
    .eq("preference_id", preferenceId);

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

  return NextResponse.json({ ok: true });
}