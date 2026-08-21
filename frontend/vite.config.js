import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [
        react()
    ],
    server: {
        port: 3012,
        host: true, // Listen on all addresses
        allowedHosts: [
            'absensigudang.sahabatjayasukses.com',
            'absensi.jagatrayasolusindo.com',
            'localhost',
            ...(process.env.FRONTEND_ALLOWED_HOSTS ? process.env.FRONTEND_ALLOWED_HOSTS.split(',').map(h => h.trim()) : [])
        ],

        proxy: {
            '/api': {
                target: 'http://127.0.0.1:5000',
                changeOrigin: true,
                secure: false,
                timeout: 600000,
                proxyTimeout: 600000
            },
            '/uploads': {
                target: 'http://127.0.0.1:5000',
                changeOrigin: true,
                secure: false,
                timeout: 600000,
                proxyTimeout: 600000
            }
        }
    }
})
