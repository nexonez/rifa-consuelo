"use client";

import { useState } from "react";

export default function AdminPage() {
  const [clave, setClave] = useState("");
  const [autenticado, setAutenticado] = useState(false);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [cantidad, setCantidad] = useState<1 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<number[]>([]);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin-asignar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave, verificarClave: true }),
      });
      const data = await res.json();
      if (data.ok) {
        setAutenticado(true);
      } else {
        setError("Clave incorrecta");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleAsignar = async () => {
    if (!nombre.trim() || !email.trim() || !telefono.trim()) {
      setError("Completa todos los campos");
      return;
    }

    setLoading(true);
    setError("");
    setResultado([]);
    try {
      const res = await fetch("/api/admin-asignar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, email, telefono, cantidad, clave }),
      });
      const data = await res.json();
      if (data.numeros) {
        setResultado(data.numeros);
        setNombre("");
        setEmail("");
        setTelefono("");
      } else {
        setError(data.error || "Error al asignar");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  if (!autenticado) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-6">Panel Admin</h1>
          <input
            type="password"
            placeholder="Clave de acceso"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full rounded-2xl border border-slate-300 px-4 py-4 text-base outline-none focus:ring-2 focus:ring-rose-300 mb-4"
          />
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full px-8 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold text-lg transition disabled:opacity-60">
            {loading ? "Verificando..." : "Entrar"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 to-white px-4 py-10">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
          <h1 className="text-2xl font-bold mb-6 text-center">Asignar números (efectivo)</h1>

          {resultado.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 text-center">
              <p className="font-bold text-emerald-700 mb-2">¡Números asignados!</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {resultado.map((n) => (
                  <span key={n} className="bg-emerald-100 text-emerald-700 font-bold px-4 py-2 rounded-xl">
                    {String(n).padStart(3, "0")}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nombre completo</label>
              <input type="text" placeholder="Nombre" value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-4 text-base outline-none focus:ring-2 focus:ring-rose-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Correo electrónico</label>
              <input type="email" placeholder="correo@ejemplo.com" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-4 text-base outline-none focus:ring-2 focus:ring-rose-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Teléfono</label>
              <input type="tel" placeholder="+56 9 1234 5678" value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-4 text-base outline-none focus:ring-2 focus:ring-rose-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Cantidad</label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setCantidad(1)}
                  className={`rounded-2xl border-2 p-4 text-center transition-all ${
                    cantidad === 1 ? "border-emerald-500 bg-emerald-50" : "border-slate-200"}`}>
                  <div className="font-bold">1 número</div>
                  <div className="text-rose-600 font-bold">$2.000</div>
                </button>
                <button type="button" onClick={() => setCantidad(3)}
                  className={`rounded-2xl border-2 p-4 text-center transition-all ${
                    cantidad === 3 ? "border-rose-500 bg-rose-50" : "border-slate-200"}`}>
                  <div className="font-bold">3 números</div>
                  <div className="text-rose-600 font-bold">$5.000</div>
                </button>
              </div>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

          <button
            onClick={handleAsignar}
            disabled={loading}
            className="w-full mt-6 px-8 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold text-lg transition disabled:opacity-60">
            {loading ? "Asignando..." : "Asignar números y enviar correo"}
          </button>
        </div>
      </div>
    </main>
  );
}