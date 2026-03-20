"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function HomePage() {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [cantidad, setCantidad] = useState<1 | 3 | null>(null);
  const [loading, setLoading] = useState(false);

  
  const numeros = Array.from({ length: 500 }, (_, i) => i + 1);
  const [numerosVendidos, setNumerosVendidos] = useState<number[]>([]);

  // Cargar números vendidos
  useState(() => {
    supabase
      .from("numeros")
      .select("id, vendido")
      .eq("vendido", true)
      .then(({ data }) => {
        if (data) setNumerosVendidos(data.map((n) => n.id));
      });
  });

  const handleComprar = async () => {
    if (!nombre.trim()) { alert("Ingresa tu nombre."); return; }
    if (!telefono.trim()) { alert("Ingresa tu teléfono."); return; }
    if (!email.trim() || !email.includes("@")) { alert("Ingresa un correo válido."); return; }
    if (!cantidad) { alert("Selecciona una opción de compra."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/crear-preferencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, email, telefono, cantidad }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert("Error al procesar el pago. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-sky-50 text-slate-800">
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-14">
        <div className="text-center max-w-3xl mx-auto">
          <span className="inline-block bg-rose-100 text-rose-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
            Rifa solidaria por Consuelo
          </span>
          <h1 className="text-3xl md:text-6xl font-bold leading-tight">
            Ayúdanos con los gastos de <span className="text-rose-600">Consuelo</span>
          </h1>
          <p className="mt-5 text-base md:text-lg text-slate-600 leading-relaxed">
            Estamos realizando una rifa solidaria para apoyar los gastos médicos de nuestra hija.
            Cada aporte es una ayuda real para nuestra familia.
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">Compra tu número</h2>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nombre completo</label>
              <input type="text" placeholder="Tu nombre" value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-4 text-base outline-none focus:ring-2 focus:ring-rose-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Teléfono</label>
              <input type="tel" placeholder="+56 9 1234 5678" value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-4 text-base outline-none focus:ring-2 focus:ring-rose-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Correo electrónico</label>
              <input type="email" placeholder="tucorreo@ejemplo.com" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-4 text-base outline-none focus:ring-2 focus:ring-rose-300" />
            </div>
            <p className="text-sm text-slate-500">
              Después del pago te mostraremos tus números en pantalla y también te los enviaremos a tu correo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <button type="button" onClick={() => setCantidad(1)}
              className={`w-full rounded-3xl border-2 p-5 md:p-6 text-left transition-all ${
                cantidad === 1 ? "border-emerald-500 bg-emerald-50 shadow-md" : "border-slate-200 bg-white"}`}>
              <div className="text-xl font-bold">1 número</div>
              <div className="text-3xl font-bold mt-2">$2.000</div>
              <div className="text-sm text-slate-500 mt-2">Se asigna automáticamente 1 número disponible</div>
            </button>

            <button type="button" onClick={() => setCantidad(3)}
              className={`w-full rounded-3xl border-2 p-5 md:p-6 text-left transition-all ${
                cantidad === 3 ? "border-rose-500 bg-rose-50 shadow-md" : "border-slate-200 bg-white"}`}>
              <div className="text-xl font-bold text-rose-600">🔥 3 números</div>
              <div className="text-3xl font-bold mt-2">$5.000</div>
              <div className="text-sm text-rose-600 mt-2">Mejor oferta · se asignan 3 números automáticos</div>
            </button>
          </div>

          <div className="mb-6 text-center">
            <span className="inline-block rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
              {cantidad === 1 ? "Selección actual: 1 número por $2.000"
                : cantidad === 3 ? "Selección actual: 3 números por $5.000"
                : "Aún no has seleccionado una opción"}
            </span>
          </div>

          <button type="button" onClick={handleComprar} disabled={loading}
            className="w-full mt-2 px-8 py-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-2xl font-bold text-lg transition disabled:opacity-60">
            {loading ? "Procesando..." : cantidad === 1 ? "Pagar $2.000 con Flow"
  : cantidad === 3 ? "Pagar $5.000 con Flow" : "Pagar con Flow"}
          </button>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-2xl font-bold">Números de la rifa</h2>
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-400 inline-block"></span> Disponible</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-slate-300 inline-block"></span> Vendido</span>
          </div>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-10 gap-2">
          {numeros.map((n) => {
            const vendido = numerosVendidos.includes(n);
            return (
              <div key={n}
                className={`p-3 rounded-xl text-center text-sm font-medium border ${
                  vendido
                    ? "bg-slate-100 border-slate-200 text-slate-400 line-through"
                    : "bg-white border-slate-100 shadow-sm text-slate-700"}`}>
                {String(n).padStart(3, "0")}
              </div>
            );
          })}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="bg-slate-900 text-white p-6 rounded-3xl text-center">
          <p className="leading-relaxed">
            Esta rifa es de carácter solidario para apoyar los gastos médicos de Consuelo.
            Gracias por tu apoyo y por compartir esta ayuda.
          </p>
        </div>
      </section>
    </main>
  );
}