import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { clave, verificarClave, nombre, email, telefono, cantidad } = body;

  if (verificarClave) {
    return NextResponse.json({ ok: clave === process.env.ADMIN_PASSWORD });
  }

  if (clave !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: numerosDisponibles } = await supabase
    .from("numeros")
    .select("id")
    .eq("vendido", false);

  if (!numerosDisponibles || numerosDisponibles.length < cantidad) {
    return NextResponse.json({ error: "No hay números disponibles" }, { status: 400 });
  }

  const shuffled = numerosDisponibles.sort(() => Math.random() - 0.5);
  const elegidos = shuffled.slice(0, cantidad).map((n: { id: number }) => n.id);

  await supabase
    .from("numeros")
    .update({
      vendido: true,
      comprador_nombre: nombre,
      comprador_email: email,
      comprador_telefono: telefono,
      fecha_compra: new Date().toISOString(),
    })
    .in("id", elegidos);

  await supabase.from("compras").insert({
    preference_id: `efectivo-${Date.now()}`,
    nombre,
    email,
    telefono,
    cantidad,
    estado: "completado",
    numeros_asignados: elegidos,
    payment_id: `efectivo-${Date.now()}`,
  });

  const numerosFormateados = elegidos
    .map((n: number) => String(n).padStart(3, "0"))
    .join(", ");

  await resend.emails.send({
    from: "Rifa Consuelo <rifa@latidosparaconsuelo.cl>",
    to: email,
    subject: "¡Tus números de la rifa!",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #e11d48;">¡Gracias por tu apoyo, ${nombre}! 💕</h1>
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