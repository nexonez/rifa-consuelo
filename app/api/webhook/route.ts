import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

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

export async function POST(req: NextRequest) {
  const body = await req.formData();
  const token = body.get("token") as string;

  console.log("Webhook token recibido:", token);

  if (!token) return NextResponse.json({ ok: true });

  // Buscar compra por token guardado al crear
  const { data: compra } = await supabase
    .from("compras")
    .select("*")
    .eq("payment_id", token)
    .single();

  if (compra) {
    return await procesarCompra(compra, token);
  }

  // Si no encuentra por token, buscar la pendiente más reciente
  const { data: compraPendiente } = await supabase
    .from("compras")
    .select("*")
    .eq("estado", "pendiente")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!compraPendiente) return NextResponse.json({ ok: true });

  return await procesarCompra(compraPendiente, token);
}