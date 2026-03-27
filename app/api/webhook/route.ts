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
        <p>Si deseas participar en la rifa puedes intentarlo nuevamente en <a href="https://rifa.latidosparaconsuelo.cl">rifa.latidosparaconsuelo.cl</a></p>
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
  console.log("Webhook body completo:", Object.fromEntries(body));

  if (!token) return NextResponse.json({ ok: true });

  // Buscar compra por token
  const { data: compra } = await supabase
    .from("compras")
    .select("*")
    .eq("payment_id", token)
    .single();

  if (compra) {
    const status = body.get("status");
    console.log("Status recibido:", status);

    if (status === "3") {
      return await rechazarCompra(compra);
    }

    if (compra.estado === "completado") return NextResponse.json({ ok: true });
    return await procesarCompra(compra, token);
  }

  // Buscar compra pendiente más reciente
  const { data: compraPendiente } = await supabase
    .from("compras")
    .select("*")
    .eq("estado", "pendiente")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!compraPendiente) return NextResponse.json({ ok: true });

  const status = body.get("status");
  console.log("Status recibido (pendiente):", status);

  if (status === "3") {
    return await rechazarCompra(compraPendiente);
  }

  return await procesarCompra(compraPendiente, token);
}