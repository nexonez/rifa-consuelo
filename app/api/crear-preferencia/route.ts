import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { supabase } from "@/lib/supabase";

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

export async function POST(req: NextRequest) {
  const { nombre, email, telefono, cantidad } = await req.json();

  const precio = cantidad === 1 ? 2000 : 5000;

  const preference = await new Preference(client).create({
    body: {
      items: [
        {
          id: "rifa-consuelo",
          title: `Rifa Consuelo - ${cantidad} número${cantidad > 1 ? "s" : ""}`,
          quantity: 1,
          unit_price: precio,
          currency_id: "CLP",
        },
      ],
      payer: {
        name: nombre,
        email: email,
        phone: { number: telefono },
      },
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_URL}/gracias`,
        failure: `${process.env.NEXT_PUBLIC_URL}/error`,
        pending: `${process.env.NEXT_PUBLIC_URL}/pendiente`,
      },
      auto_return: "approved",
      notification_url: `${process.env.NEXT_PUBLIC_URL}/api/webhook`,
      metadata: { nombre, email, telefono, cantidad },
    },
  });

  // Guardar compra pendiente
  await supabase.from("compras").insert({
    preference_id: preference.id,
    nombre,
    email,
    telefono,
    cantidad,
    estado: "pendiente",
  });

  return NextResponse.json({ url: preference.init_point });
}