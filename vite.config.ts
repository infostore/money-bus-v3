import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const clientPort = Number(env['VITE_PORT'] ?? 5173)
  const serverPort = Number(env['PORT'] ?? 3001)

  return {
    root: 'src/client',
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/client/src'),
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: clientPort,
      proxy: {
        '/api': {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: resolve(__dirname, 'dist/client'),
      emptyOutDir: true,
    },
  }
})
