import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Define a proxy to bypass CORS issues during development
  server: {
    proxy: {
      '/huggingface-hub': {
        target: 'https://huggingface.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/huggingface-hub/, ''),
      },
    },
  },
  // Define environment variables for the application
  define: {
    // Set the custom Hugging Face Hub URL for Transformers.js
    'process.env.HUGGING_FACE_HUB_URL': JSON.stringify('/huggingface-hub'),
  },
  optimizeDeps: {
    exclude: ['@electric-sql/pglite'],
  },
})
