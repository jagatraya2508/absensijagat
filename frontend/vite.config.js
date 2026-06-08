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
            'absenancol.tri.jagatrayasolusindo.com',
            'localhost',
            ...(process.env.FRONTEND_ALLOWED_HOSTS ? process.env.FRONTEND_ALLOWED_HOSTS.split(',').map(h => h.trim()) : [])
        ],

        proxy: {
            '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true,
                secure: false
            },
            '/uploads': {
                target: 'http://localhost:5000',
                changeOrigin: true,
                secure: false
            }
        }
    }
})
