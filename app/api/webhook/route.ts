import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.formData();
    const token = body.get("token") as string | null;

    console.log("Webhook token recibido:", token);

    if (!token) {
      return NextResponse.json({ ok: true });
    }

    const { data: compra, error } = await supabase
      .from("compras")
      .select("*")
      .eq("payment_id", token)
      .single();

    if (error) {
      console.error("Error buscando compra por token:", error);
      return NextResponse.json({ ok: true });
    }

    if (!compra) {
      console.warn("No se encontró compra para token:", token);
      return NextResponse.json({ ok: true });
    }

    if (compra.estado === "procesando" || compra.estado === "completado") {
      return NextResponse.json({ ok: true });
    }

    const { error: updateError } = await supabase
      .from("compras")
      .update({ estado: "procesando" })
      .eq("preference_id", compra.preference_id);

    if (updateError) {
      console.error("Error actualizando compra a procesando:", updateError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error en webhook:", error);
    return NextResponse.json({ ok: true });
  }
}