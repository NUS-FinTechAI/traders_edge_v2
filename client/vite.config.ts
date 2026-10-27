import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  // Vercel's build commit names the Sentry release when VITE_SENTRY_RELEASE is unset.
  envPrefix: ['VITE_', 'VERCEL_GIT_COMMIT_SHA'],
  build: { license: { fileName: 'THIRD_PARTY_LICENSES.md' } },
})
