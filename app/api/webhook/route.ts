import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const body = await req.formData();
  const token = body.get("token") as string;

  console.log("Webhook token recibido:", token);

  if (!token) return NextResponse.json({ ok: true });

  // Buscar compra por token
  const { data: compra } = await supabase
    .from("compras")
    .select("*")
    .eq("payment_id", token)
    .single();

  if (compra) {
    if (compra.estado !== "pendiente") return NextResponse.json({ ok: true });

    // Marcar como procesando — el cron verificará en ~1 minuto
    await supabase
      .from("compras")
      .update({ estado: "procesando" })
      .eq("preference_id", compra.preference_id);

    return NextResponse.json({ ok: true });
  }

  // Fallback: compra pendiente más reciente
  const { data: compraPendiente } = await supabase
    .from("compras")
    .select("*")
    .eq("estado", "pendiente")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!compraPendiente) return NextResponse.json({ ok: true });

  await supabase
    .from("compras")
    .update({ estado: "procesando" })
    .eq("preference_id", compraPendiente.preference_id);

  return NextResponse.json({ ok: true });
}