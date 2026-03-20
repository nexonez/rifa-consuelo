export default function ErrorPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 max-w-md w-full text-center">
        <div className="text-4xl mb-4">😔</div>
        <h1 className="text-2xl font-bold mb-2">El pago no se completó</h1>
        <p className="text-slate-500 mb-6">Hubo un problema con tu pago. No se realizó ningún cobro.</p>
        <a href="/" className="inline-block bg-rose-600 text-white px-6 py-3 rounded-2xl font-bold">
          Volver a intentar
        </a>
      </div>
    </main>
  );
}