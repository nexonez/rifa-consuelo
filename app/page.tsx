export default function HomePage() {
  const numeros = Array.from({ length: 500 }, (_, i) => i + 1);

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-sky-50 text-slate-800">
      <section className="max-w-6xl mx-auto px-6 py-10 md:py-16">
        <div className="text-center max-w-3xl mx-auto">
          <span className="inline-block bg-rose-100 text-rose-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
            Rifa solidaria por Consuelo
          </span>

          <h1 className="text-4xl md:text-6xl font-bold leading-tight">
            Ayúdanos con los gastos de <span className="text-rose-600">Consuelo</span>
          </h1>

          <p className="mt-6 text-lg text-slate-600">
            Estamos realizando una rifa solidaria para apoyar los gastos médicos de nuestra hija.
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-10">
        <div className="bg-white rounded-3xl shadow p-6 text-center">
          <h2 className="text-3xl font-bold mb-6">Compra tu número</h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 border rounded-2xl">
              <div className="text-xl font-bold">1 número</div>
              <div className="text-2xl">$2.000</div>
            </div>

            <div className="p-6 border rounded-2xl bg-rose-50">
              <div className="text-xl font-bold text-rose-600">🔥 3 números</div>
              <div className="text-2xl">$5.000</div>
            </div>
          </div>

          <button className="mt-6 px-6 py-3 bg-rose-600 text-white rounded-xl">
            Pagar con MercadoPago
          </button>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-10">
        <h2 className="text-xl font-bold mb-4">Números disponibles</h2>
        <div className="grid grid-cols-5 gap-2">
          {numeros.map((n) => (
            <div key={n} className="bg-white p-3 text-center rounded shadow">
              {n}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}