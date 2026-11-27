import { Link } from 'react-router-dom'

export default function PaginaNoEncontrada() {
  return (
    <main className="grid min-h-screen place-items-center bg-fondo p-6">
      <div className="w-full max-w-md border-l-4 border-marca-principal pl-5 sm:pl-8">
        <p className="mb-2 font-mono text-sm font-semibold text-secundario">Error 404</p>
        <h1 className="text-2xl font-bold text-principal sm:text-3xl">Página no encontrada</h1>
        <p className="mb-6 mt-3 text-secundario">
          La dirección no existe o cambió. Puedes revisar el enlace o volver al inicio.
        </p>
        <Link
          to="/"
          replace
          className="inline-flex rounded-lg bg-marca-principal px-5 py-2.5 font-medium text-white hover:bg-marca-oscuro focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marca-principal"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  )
}
