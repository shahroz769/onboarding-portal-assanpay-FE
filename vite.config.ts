import { defineConfig } from 'vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tanstackStart({
      spa: { enabled: true },
      router: {
        codeSplittingOptions: {
          // Split only route components. Error and not-found UIs stay in the
          // route file: split, they render through the router's lazy wrapper,
          // which is only preloaded for loader/beforeLoad failures. An error
          // thrown while rendering (a query rethrown by a layout) then suspends
          // on it once and React warns about the wrapper's conditional use().
          defaultBehavior: [['component']],
        },
      },
    }),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  build: {
    target: 'esnext',
  },
  ssr: {
    optimizeDeps: {
      exclude: [
        '@tanstack/react-devtools',
        '@tanstack/react-query-devtools',
        '@tanstack/react-router-devtools',
        '@tanstack/devtools',
        '@tanstack/devtools-ui',
      ],
    },
  },
})
