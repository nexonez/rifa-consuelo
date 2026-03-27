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

async function consultarPagoPorToken(token: string) {
  const params: Record<string, string> = {
    apiKey: API_KEY,
    token,
  };

  params.s = signParams(params);

  const res = await fetch(`${FLOW_API_URL}/payment/getStatus`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });

  return res.json();
}

export async function GET(req: NextRequest) {
  const cronToken = req.nextUrl.searchParams.get("token");

  if (!cronToken || cronToken !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const hace30min = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data: compras, error: comprasError } = await supabase
      .from("compras")
      .select("*")
      .eq("estado", "procesando")
      .gte("created_at", hace30min);

    if (comprasError) {
      console.error("Error obteniendo compras:", comprasError);
      return NextResponse.json(
        { error: "Error obteniendo compras" },
        { status: 500 }
      );
    }

    if (!compras || compras.length === 0) {
      return NextResponse.json({ ok: true, procesadas: 0 });
    }

    console.log(`Cron: verificando ${compras.length} compras pendientes`);

    let procesadas = 0;

    for (const compra of compras) {
      try {
        if (!compra.payment_id) {
          console.warn(`Compra sin payment_id: ${compra.preference_id}`);
          continue;
        }

        const payment = await consultarPagoPorToken(compra.payment_id);

        console.log(
          `Cron status ${compra.preference_id}:`,
          JSON.stringify(payment)
        );

        if (payment.code && payment.code !== 0) {
          console.warn(
            `Flow devolvió error para ${compra.preference_id}:`,
            JSON.stringify(payment)
          );
          continue;
        }

        if (payment.status === 2) {
          const { data: numerosDisponibles, error: numerosError } = await supabase
            .from("numeros")
            .select("id")
            .eq("vendido", false);

          if (numerosError) {
            console.error("Error obteniendo números disponibles:", numerosError);
            continue;
          }

          if (!numerosDisponibles || numerosDisponibles.length < compra.cantidad) {
            console.warn(
              `No hay suficientes números disponibles para ${compra.preference_id}`
            );
            continue;
          }

          const shuffled = [...numerosDisponibles].sort(() => Math.random() - 0.5);
          const elegidos = shuffled.slice(0, compra.cantidad).map((n) => n.id);

          const { error: updateNumerosError } = await supabase
            .from("numeros")
            .update({
              vendido: true,
              comprador_nombre: compra.nombre,
              comprador_email: compra.email,
              comprador_telefono: compra.telefono,
              fecha_compra: new Date().toISOString(),
            })
            .in("id", elegidos);

          if (updateNumerosError) {
            console.error("Error actualizando números vendidos:", updateNumerosError);
            continue;
          }

          const { error: updateCompraError } = await supabase
            .from("compras")
            .update({
              estado: "completado",
              numeros_asignados: elegidos,
            })
            .eq("preference_id", compra.preference_id);

          if (updateCompraError) {
            console.error("Error actualizando compra completada:", updateCompraError);
            continue;
          }

          const numerosFormateados = elegidos
            .map((n: number) => String(n).padStart(3, "0"))
            .join(", ");

          try {
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
          } catch (emailError) {
            console.error("Error enviando correo:", emailError);
          }

          procesadas++;
        } else if (payment.status === 1) {
          console.log(`Pago aún pendiente para ${compra.preference_id}`);
        } else {
          if (compra.numeros_asignados?.length > 0) {
            const { error: liberarNumerosError } = await supabase
              .from("numeros")
              .update({
                vendido: false,
                comprador_nombre: null,
                comprador_email: null,
                comprador_telefono: null,
                fecha_compra: null,
              })
              .in("id", compra.numeros_asignados);

            if (liberarNumerosError) {
              console.error("Error liberando números:", liberarNumerosError);
            }
          }

          const { error: rechazarCompraError } = await supabase
            .from("compras")
            .update({ estado: "rechazado" })
            .eq("preference_id", compra.preference_id);

          if (rechazarCompraError) {
            console.error("Error marcando compra como rechazada:", rechazarCompraError);
            continue;
          }
        }
      } catch (error) {
        console.error(`Error procesando compra ${compra.preference_id}:`, error);
      }
    }

    return NextResponse.json({ ok: true, procesadas });
  } catch (error) {
    console.error("Error general del cron:", error);
    return NextResponse.json(
      { error: "Error interno del cron" },
      { status: 500 }
    );
  }
}