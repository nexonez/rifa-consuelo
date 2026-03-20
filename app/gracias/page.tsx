"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function GraciasContent() {
  const searchParams = useSearchParams();
  const preferenceId = searchParams.get("preference_id");
  const [numeros, setNumeros] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!preferenceId) {
      setLoading(false);
      return;
    }

    const buscar = async () => {
      for (let i = 0; i < 10; i++) {
        const { data } = await supabase
          .from("compras")
          .select("numeros_asignados, estado")
          .eq("preference_id", preferenceId)
          .single();

        if (data?.estado === "completado" && data?.numeros_asignados?.length > 0) {
          setNumeros(data.numeros_asignados);
          setLoading(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      setLoading(false);
    };

    buscar();
  }, [preferenceId]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 max-w-md w-full text-center">
        {loading ? (
          <>
            <div className="text-4xl mb-4">⏳</div>
            <h1 className="text-2xl font-bold mb-2">Confirmando tu pago...</h1>
            <p className="text-slate-500">Estamos asignando tus números, espera un momento.</p>
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
            <p className="text-slate-500 text-sm">También te los enviamos a tu correo. ¡Mucha suerte! 🍀</p>
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