"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createHmac } from "crypto";

function GraciasContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [numeros, setNumeros] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const buscar = async () => {
      // Consultar estado del pago a Flow y asignar números
      const res = await fetch(`/api/verificar-pago?token=${token}`);
      const data = await res.json();

      if (data.numeros?.length > 0) {
        setNumeros(data.numeros);
      }
      setLoading(false);
    };

    buscar();
  }, [token]);

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