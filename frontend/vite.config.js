import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_');
  if (command === 'build' && mode === 'production') {
    let url;
    try { url = new URL(env.VITE_API_URL); } catch { throw new Error('Configure VITE_API_URL em .env.production.local com a URL HTTPS do Render incluindo /api.'); }
    if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname.replace(/\/$/, '') !== '/api') {
      throw new Error('VITE_API_URL de produção deve ser HTTPS e terminar em /api.');
    }
  }
  return {
  base: '/tecti/2026/gpec10/',
  plugins: [
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  };
})
