/**
 * 🇨🇳 2026-08-31 by Hermes
 * 把 Hono 后端接入 vite dev middleware
 *
 * 让 vite dev 把 /api/* 请求转给 Hono app 处理
 * 部署到 FC 时,这个文件不需要 —— FC 直接跑 Hono
 */

import type { Connect, Plugin } from 'vite'

export function honoBackend(getApp: () => any): Plugin {
  return {
    name: 'jianhebox-hono-backend',
    configureServer(server) {
      // 用 post hook 跑在 vite 内部中间件之后,但我们的中间件先 return 处理 /api/*
      const handler: Connect.NextHandleFunction = async (req, res, next) => {
        const url = req.url || '/'
        if (!url.startsWith('/api/')) {
          return next()
        }

        try {
          const app = getApp()
          // 把 Node.js IncomingMessage 转换成 Web Request
          const chunks: Buffer[] = []
          req.on('data', (chunk) => chunks.push(chunk))
          await new Promise<void>((resolve) => req.on('end', resolve))
          const body = chunks.length > 0 ? Buffer.concat(chunks).toString('utf-8') : undefined

          // 🇨🇳 R47.8 关键:不要 toString('utf-8')!会破坏 mp4 等二进制
          //    用 Buffer.toString('binary') 或者直接传 raw Buffer 给 Web Request
          //    multipart/form-data 需要作为 binary 保留
          const protocol = (req.headers['x-forwarded-proto'] as string) || 'http'
          const host = req.headers.host || 'localhost:18181'
          const fullUrl = `${protocol}://${host}${url}`

          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers)) {
            if (v !== undefined) {
              if (Array.isArray(v)) {
                headers.set(k, v.join(', '))
              } else {
                headers.set(k, String(v))
              }
            }
          }

          const webRequest = new Request(fullUrl, {
            method: req.method,
            headers,
            // 🇨🇳 R47.8:用 Uint8Array 包装 Buffer,让 Web Request 把 body 当二进制
            body: chunks.length > 0 ? new Uint8Array(Buffer.concat(chunks)) : undefined,
          })

          const webResponse = await app.fetch(webRequest)

          // 把 Web Response 写回 Node.js res
          res.statusCode = webResponse.status
          webResponse.headers.forEach((value, key) => {
            res.setHeader(key, value)
          })
          const respBody = await webResponse.arrayBuffer()
          res.end(Buffer.from(respBody))
        } catch (err: any) {
          console.error('[hono-backend] error:', err)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }))
        }
      }

      // 注册到 server middleware
      server.middlewares.use(handler)
    },
  }
}