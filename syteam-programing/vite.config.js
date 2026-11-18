import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import {
  listProcesses,
  startProcess,
  stopProcess,
} from './src/services/processsservice.js'
import { getSystemInfo } from './src/services/systemservice.js'
import { getMemoryInfo } from './src/services/memoryservice.js'
import { getActiveThreads, startThread, stopThread } from './src/services/threadService.js'

function installProcessApi(server) {
  server.middlewares.use(async (request, response, next) => {
    let route
    try {
      route = new URL(request.url, 'http://127.0.0.1').pathname
    } catch {
      next()
      return
    }

    const isProcessRoute = route.startsWith('/api/processes/')
    const isSystemInfoRoute = route === '/api/system/info'
    const isMemoryRoute = route === '/api/memory/info'
    const isThreadRoute = route.startsWith('/api/threads/')
    if (!isProcessRoute && !isSystemInfoRoute && !isMemoryRoute && !isThreadRoute) {
      next()
      return
    }

    const address = server.httpServer?.address()
    if (!address || typeof address === 'string') {
      response.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify({ success: false, message: 'Local process service is not ready.' }))
      return
    }

    const expectedHost = `${address.address}:${address.port}`
    const expectedOrigin = `http://${expectedHost}`
    const originIsValid = request.headers.origin
      ? request.headers.origin === expectedOrigin
      : request.headers['sec-fetch-site'] === 'same-origin'

    if (request.headers.host !== expectedHost || !originIsValid) {
      response.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify({ success: false, message: 'Local process API access denied.' }))
      return
    }

    const send = (status, data) => {
      response.writeHead(status, {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      })
      response.end(JSON.stringify(data))
    }

    try {
      if (request.method === 'GET' && isSystemInfoRoute) {
        send(200, { success: true, system: await getSystemInfo() })
        return
      }

      if (request.method === 'GET' && isMemoryRoute) {
        send(200, { success: true, memory: getMemoryInfo() })
        return
      }

      if (request.method === 'GET' && isThreadRoute && route === '/api/threads/list') {
        send(200, { success: true, threads: getActiveThreads() })
        return
      }

      if (request.method === 'POST' && isThreadRoute && ['start', 'stop'].includes(route.split('/').at(-1))) {
        if (!request.headers['content-type']?.startsWith('application/json')) {
          send(415, { success: false, message: 'Expected a JSON request.' })
          return
        }

        let body = ''
        for await (const chunk of request) {
          body += chunk
          if (Buffer.byteLength(body) > 8192) {
            send(413, { success: false, message: 'Request body is too large.' })
            return
          }
        }

        const values = JSON.parse(body || '{}')
        const action = route.split('/').at(-1)
        const result = action === 'start'
          ? startThread(() => {})
          : await stopThread(values.threadId)
        send(result.success ? 200 : 400, result)
        return
      }

      if (isSystemInfoRoute || isMemoryRoute || isThreadRoute) {
        send(405, { success: false, message: 'Method not allowed.' })
        return
      }

      const action = route.slice('/api/processes/'.length)

      if (request.method === 'GET' && action === 'list') {
        send(200, { success: true, processes: await listProcesses() })
        return
      }

      if (request.method === 'POST' && ['start', 'stop'].includes(action)) {
        if (!request.headers['content-type']?.startsWith('application/json')) {
          send(415, { success: false, message: 'Expected a JSON request.' })
          return
        }

        let body = ''
        for await (const chunk of request) {
          body += chunk
          if (Buffer.byteLength(body) > 8192) {
            send(413, { success: false, message: 'Request body is too large.' })
            return
          }
        }

        const values = JSON.parse(body || '{}')
        const result = action === 'start'
          ? startProcess(values.application)
          : stopProcess(values.pid)
        send(result.success ? 200 : 400, result)
        return
      }

      send(404, { success: false, message: 'Process API route not found.' })
    } catch (error) {
      const status = request.method === 'GET' ? 500 : 400
      send(status, { success: false, message: error.message || 'Process operation failed.' })
    }
  })
}

const localProcessApi = {
  name: 'local-process-api',
  configureServer: installProcessApi,
}

// https://vite.dev/config/
export default defineConfig({
  root: 'src/renderer',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  plugins: [react(), localProcessApi],
})
