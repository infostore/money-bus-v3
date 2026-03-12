import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    projects: [
      {
        test: {
          name: 'server',
          globals: true,
          environment: 'node',
          include: ['tests/**/*.test.ts'],
          testTimeout: 10000,
          fileParallelism: false,
          pool: 'forks',
          poolOptions: {
            forks: { singleFork: true },
          },
        },
        resolve: {
          alias: {
            '@shared': resolve(__dirname, 'src/shared'),
          },
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'client',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['src/client/test-setup.ts'],
          include: [
            'src/client/src/**/__tests__/**/*.test.tsx',
            'src/client/src/**/__tests__/**/*.test.ts',
          ],
        },
        resolve: {
          alias: {
            '@shared': resolve(__dirname, 'src/shared'),
            '@': resolve(__dirname, 'src/client/src'),
          },
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/server/**', 'src/shared/**'],
      exclude: ['src/server/index.ts', 'src/shared/types/**', 'src/shared/types.ts'],
    },
  },
})
