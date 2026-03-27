"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function GraciasContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [numeros, setNumeros] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [rechazado, setRechazado] = useState(false);
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const buscar = async () => {
      // Esperar hasta 3 minutos consultando cada 5 segundos
      for (let i = 0; i < 36; i++) {
        const { data } = await supabase
          .from("compras")
          .select("numeros_asignados, estado")
          .eq("payment_id", token)
          .single();

        if (data?.estado === "completado" && data?.numeros_asignados?.length > 0) {
          setNumeros(data.numeros_asignados);
          setLoading(false);
          return;
        }

        if (data?.estado === "rechazado") {
          setRechazado(true);
          setLoading(false);
          return;
        }

        await new Promise((r) => setTimeout(r, 5000));
      }
      setLoading(false);
    };

    buscar();
  }, [token]);

  useEffect(() => {
    if (numeros.length > 0) {
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            window.location.href = "/";
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [numeros]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 max-w-md w-full text-center">
        {loading ? (
          <>
            <div className="text-4xl mb-4">⏳</div>
            <h1 className="text-2xl font-bold mb-2">Verificando tu pago...</h1>
            <p className="text-slate-500">Estamos confirmando tu pago con Flow. Esto puede tomar hasta 1 minuto.</p>
            <div className="mt-4 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600"></div>
            </div>
          </>
        ) : rechazado ? (
          <>
            <div className="text-4xl mb-4">😔</div>
            <h1 className="text-2xl font-bold mb-2 text-slate-600">Pago no procesado</h1>
            <p className="text-slate-500 mb-6">Tu pago no pudo ser confirmado. No se realizó ningún cobro y tus números han sido liberados.</p>
            <button
              onClick={() => window.location.href = "/"}
              className="w-full px-8 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold text-lg transition">
              Volver a intentar
            </button>
          </>
        ) : numeros.length > 0 ? (
          <>
            <div className="text-4xl mb-4">🎉</div>
            <h1 className="text-2xl font-bold mb-2 text-rose-600">¡Gracias por tu apoyo!</h1>
            <p className="text-slate-600 mb-6">Tus números de la rifa son:</p>
            <div className="flex flex-wrap gap-3 justify-center mb-6">
              {numeros.map((n) => (
                <span key={n} className="bg-rose-100 text-rose-700 font-bold text-xl px-5 py-3 rounded-2xl">
                  {String(n).padStart(3, "0")}
                </span>
              ))}
            </div>
            <p className="text-slate-500 text-sm mb-6">También te los enviamos a tu correo. ¡Mucha suerte! 🍀</p>
            <button
              onClick={() => window.location.href = "/"}
              className="w-full px-8 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold text-lg transition">
              Volver al inicio
            </button>
            <p className="text-slate-400 text-sm mt-3">
              Redirigiendo automáticamente en {countdown} segundos...
            </p>
          </>
        ) : (
          <>
            <div className="text-4xl mb-4">💕</div>
            <h1 className="text-2xl font-bold mb-2">¡Pago recibido!</h1>
            <p className="text-slate-500">Recibirás tus números por correo en unos minutos.</p>
          </>
        )}
      </div>
    </main>
  );
}

export default function GraciasPage() {
  return (
    <Suspense>
      <GraciasContent />
    </Suspense>
  );
}
