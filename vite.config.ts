import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react({
      jsxImportSource: '@emotion/react',
      babel: {
        plugins: ['@emotion/babel-plugin'],
      },
    }),
  ],
  resolve: {
    alias: {
      '~helpers': path.resolve(__dirname, './src/helpers'),
      '~assets': path.resolve(__dirname, './src/assets'),
      '~common': path.resolve(__dirname, './src/common'),
      '~themes': path.resolve(__dirname, './src/themes'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
})
