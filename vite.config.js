import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH permite publicar num subcaminho (ex.: GitHub Pages em /mesa-de-jogo/).
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      pwaAssets: { config: true, overrideManifestIcons: true },
      manifest: {
        name: 'Mesa de Jogo',
        short_name: 'Mesa de Jogo',
        description: 'Estatísticas de jogo e treino de basket.',
        lang: 'pt-PT',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0F1216',
        theme_color: '#0F1216',
        start_url: base,
        scope: base
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // partes do jsPDF que o relatório não usa (exportação de HTML)
        globIgnores: ['**/html2canvas-*.js', '**/purify.es-*.js', '**/index.es-*.js']
      }
    })
  ]
});
