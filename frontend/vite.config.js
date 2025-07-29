import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,    // Faz o Vite escutar em 0.0.0.0 (acessível na rede)
    port: 5173,    // Porta que você quiser (pode mudar, mas 3000 é comum)
  },
})
