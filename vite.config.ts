import { defineConfig, type Plugin, type ViteDevServer } from 'vite'
import fs from 'fs'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// The handlers in api/ are Vercel serverless functions, which the Vite dev
// server knows nothing about – every /api/* call would 404. This runs them
// in-process instead, so `npm run dev` serves the frontend and the API
// together without needing the Vercel CLI.
function vercelApiDevPlugin(): Plugin {
  return {
    name: 'vercel-api-dev',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost')

        if (!url.pathname.startsWith('/api/')) {
          return next()
        }

        const route = url.pathname.slice('/api/'.length).replace(/\/$/, '')
        const segments = route.split('/')

        // api/_lib holds shared helpers, not routes – never serve them.
        if (!route || segments.some((segment) => !segment || segment.startsWith('_') || segment === '..')) {
          return next()
        }

        const modulePath = path.resolve(__dirname, 'api', `${route}.ts`)

        if (!fs.existsSync(modulePath)) {
          return next()
        }

        // Vercel hands the handler a parsed query and an Express-style
        // response; a bare Node response has neither.
        ;(req as any).query = Object.fromEntries(url.searchParams)
        ;(res as any).status = (statusCode: number) => {
          res.statusCode = statusCode
          return res
        }
        ;(res as any).send = (body: string) => res.end(body)

        try {
          const module = await server.ssrLoadModule(modulePath)
          await module.default(req, res)
        } catch (error) {
          server.ssrFixStacktrace(error as Error)
          console.error(`[api] ${req.method} ${url.pathname}`, error)

          if (!res.writableEnded) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: (error as Error).message }))
          }
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    vercelApiDevPlugin(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
