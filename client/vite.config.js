import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/ws': {
                target: 'http://localhost:9090',
                ws: true
            },
            '/api': 'http://localhost:9090'
        }
    }
})
