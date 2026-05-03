// TODO: Conectar cliente HTTP a la API FastAPI del modelo ML
// En fase actual, todas las funciones son mock.

const BASE_URL = import.meta.env.VITE_ML_API_URL || 'http://localhost:8000/api/v1'

export const clienteML = {
  baseURL: BASE_URL,
}
