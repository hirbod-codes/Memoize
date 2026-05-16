import { defineConfig, loadEnv } from 'vite'
import fs from 'fs'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");

    return {
        server: {
            proxy: {
                '/api': {
                    target: env.VITE_API_URL ?? 'https://localhost:3000',
                    changeOrigin: true,
                    secure: false
                }
            },
            https: {
                key: fs.readFileSync('localhost+2-key.pem'),
                cert: fs.readFileSync('localhost+2.pem'),
            },
            host: '0.0.0.0',
            port: 5174
        },
        css: {
            postcss: './postcss.config.js', // Explicitly point to postcss config if needed
        },
        plugins: [
            babel({ presets: [reactCompilerPreset()] }),
            react(),
        ],
    }
})
