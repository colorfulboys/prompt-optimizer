import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import path from 'path'
import fs from 'fs'
import type { Connect, Plugin } from 'vite'
// 🇨🇳 2026-08-31 M3.9 R33:不再 import DEFAULT_VITE_ENV(已被前端 import.meta.env 直接使用,前端代码需用 import.meta.env.NODE_ENV / import.meta.env.MODE)
// 这里不再定义 processEnv(防 VITE_ALIYUN_* 凭证进 bundle)

// 🇨🇳 whisper-web 的 wasm 主模块(`/assets/main-*.js`)在 ui/dist/assets/,
// vite dev 默认不挂载 ui/dist 作为 public,所以浏览器 fetch 时回退到 index.html
// 这里写个 pre middleware,优先从 ui/dist 找文件
// 找不到再走 vite 默认处理;同时关掉 SPA fallback,自己处理 index.html
// 2026-08-31 by Hermes
function serveUiDist(): Plugin {
  const uiDist = path.resolve(__dirname, '../ui/dist')
  const webIndex = path.resolve(__dirname, 'index.html')

  // 定义 middleware handler(后面手动插入到 stack 头部)
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const url = req.url || '/'
    // vite 内部路径 / API 代理不要碰
    if (
      url.startsWith('/@') ||
      url.startsWith('/node_modules/') ||
      url.startsWith('/api/') ||
      url.startsWith('/src/')
    ) {
      return next()
    }
    // 去掉 query string
    const cleanUrl = url.split('?')[0]
    // 1) 在 ui/dist 里找文件(优先)
    const candidate = path.join(uiDist, cleanUrl)
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        const ext = path.extname(candidate).toLowerCase()
        const mimeTypes: Record<string, string> = {
          '.js': 'application/javascript; charset=utf-8',
          '.mjs': 'application/javascript; charset=utf-8',
          '.cjs': 'application/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.wasm': 'application/wasm',
          '.json': 'application/json; charset=utf-8',
          '.map': 'application/json; charset=utf-8',
          '.html': 'text/html; charset=utf-8',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2',
        }
        const ct = mimeTypes[ext] || 'application/octet-stream'
        res.setHeader('Content-Type', ct)
        // 🇨🇳 2026-08-31:必须加 COOP/COEP,否则 wasm Worker 报错(shared memory 不可用)
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
        res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless')
        const stream = fs.createReadStream(candidate)
        stream.on('error', next)
        stream.pipe(res)
        return
      }
    } catch {}
    //    // 2) SPA fallback:appType=custom 关掉了 vite内置 history fallback
    //    // 没有扩展名的路径 → 返回 web/index.html
    //    if (!path.extname(cleanUrl) && req.method === 'GET') {
    //      if (fs.existsSync(webIndex)) {
    //        res.setHeader('Content-Type', 'text/html; charset=utf-8')
    //        fs.createReadStream(webIndex).pipe(res)
    //        return
    //      }
    //    }
    // 3) 其它的让 vite 内部处理(SPA fallback 会处理 / 和 /tools/*)
    next()
  }

  return {
    name: 'jianhebox-serve-ui-dist',
    configureServer(server) {
      // 先注册(会被加到末尾)
      server.middlewares.use(handler)
      // 然后把它移到 stack 最前面
      // @ts-ignore
      const stack: any[] = (server.middlewares as any).stack
      if (stack && Array.isArray(stack)) {
        // 找到刚加的 handler 索引
        const idx = stack.findIndex((layer: any) => layer.handle === handler)
        if (idx >= 0 && idx < stack.length - 1) {
          const layer = stack.splice(idx, 1)[0]
          stack.unshift(layer)
        }
      }
    },
  }
}

// 🇨🇳 2026-08-31 by Hermes
// 把 Hono 后端接入 vite dev —— /api/* 由 Hono 处理
// R52.22:直接 import .ts 文件,让 vite-node 转译,绕过 9-3 老编译产物 .js
//  说明:之前 require('./server/api') 会优先拿 .js,而 .js 是 9-3 的旧编译产物,
//       R52 全部修复(CORS 白名单 / 埋点 / 反馈路由)都不生效
import { honoBackend } from './server/hono-vite-plugin.ts'

// 同步返回 Hono app(Vite 6+ 默认会把 .ts 转译)
let _app: any = null
const getApp = () => {
  if (!_app) {
    // 用 require + .ts 后缀,vite-node 会拦截并转译
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _app = require('./server/api.ts').default
  }
  return _app
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const monorepoRoot = resolve(__dirname, '../..')
  // 🇨🇳 R47.8:手动解析 .env(避免 dotenv require 在 vite 临时文件中路径问题)
  // loadEnv(mode, root) 默认只返回 VITE_* 前缀,所以非 VITE_ 凭证(JIANHEBOX_API_KEY / TENCENT_*)读不到
  try {
    const fs = require('node:fs') as typeof import('node:fs')
    const envPath = resolve(monorepoRoot, '.env')
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8')
      for (const line of content.split('\n')) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i)
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
      }
    }
  } catch (e) {
    console.warn('[vite.config] .env parse failed:', (e as Error).message)
  }
  // 🇨🇳 9-3 R49.9:loadEnv 只读 VITE_*,但 ALIYUN_*(无 VITE_ 前缀)也得同步进 process.env
  //   因为安全原因 VITE_ALIYUN_* 已重命名为 ALIYUN_*(vite 默认不注入,防密钥进 bundle)
  const envVite = loadEnv(mode, monorepoRoot)
  // 读所有 .env 变量(包括不带 VITE_ 前缀的),给后端用
  const envAll: Record<string, string> = {}
  try {
    const fs = require('node:fs') as typeof import('node:fs')
    const envPath = resolve(monorepoRoot, '.env')
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8')
      for (const line of content.split('\n')) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i)
        if (m && m[1]) envAll[m[1]] = m[2]
      }
    }
  } catch {}

  // 🇨🇳 2026-08-31:把 .env 凭证同步到 process.env(让 vite proxy server / Hono 后端能读到)
  // 🇨🇳 9-3 R49.9:防密钥进 bundle,只把 ALIYUN_*/JIANHEBOX_*/TENCENT_*/VOLC_*/VITE_API_SERVER_KEY
  //   同步进 process.env(给后端用),绝不让 VITE_* 自动 inject 到前端 import.meta.env
  //   (因为 LLM 凭证类不会被前端代码引用,放 process.env 安全)
  for (const [k, v] of Object.entries({ ...envVite, ...envAll })) {
    // 🇨🇳 R49.9:server-only 凭证同步进 process.env,前端 bundle 永远拿不到
    // 🇨🇳 R52(9-4):再加 DB 路径白名单(本机 dev override)
    // 🇨🇳 R52.19:加 AUTH_JWT_SECRET / GITHUB_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_CLIENT_SECRET
    //   (替代原 VITE_AUTH_JWT_SECRET / VITE_GITHUB_OAUTH_CLIENT_SECRET / VITE_GOOGLE_OAUTH_CLIENT_SECRET,
    //    原命名带 VITE_ 前缀会被 inject 到前端 bundle 公开,改名后只走 process.env)
    if (
      k === 'JIANHEBOX_API_KEY' ||
      k === 'JIANHEBOX_ADMIN_KEY' ||
      k === 'VITE_TRACKING_DB_PATH' ||
      k === 'VITE_AUTH_KV_PATH' ||
      k === 'VITE_QR_KV_PATH' ||
      k.startsWith('ALIYUN_') ||
      k.startsWith('TENCENT_') ||
      k.startsWith('VOLC_') ||
      k === 'VITE_API_SERVER_KEY' ||
      k === 'JIANHEBOX_DEBUG_KEY' ||
      k === 'AUTH_JWT_SECRET' ||
      k === 'GITHUB_OAUTH_CLIENT_SECRET' ||
      k === 'GOOGLE_OAUTH_CLIENT_SECRET' ||
      k === 'ALLOWED_ORIGINS'
    ) {
      process.env[k] = v
    }
  }

  return {
    envDir: monorepoRoot,
    appType: 'spa', // 用 vite 内置 SPA fallback
    plugins: [
      vue(),
      serveUiDist(),
      // 🇨🇳 2026-08-31:挂 Hono 后端,接管 /api/audio/* 和 /api/health
      honoBackend(getApp),
      // 🇨🇳 R57.8:closeBundle hook 必须放在 plugins 里,vite build.closeBundle 不被识别
      // closeBundle 手动拷贝 @ffmpeg/ffmpeg 的 worker.js + 依赖 + 改 const.js 的 CORE_URL
      {
        name: 'jianhebox-fix-ffmpeg-worker',
        apply: 'build',
        closeBundle: async () => {
          console.log('[jianhebox-fix-ffmpeg-worker] closeBundle START')
          const fs = await import('node:fs')
          const path = await import('node:path')
          // 找 @ffmpeg/ffmpeg 的 worker.js(支持 monorepo 不同位置)
          const pathMod = await import('node:path')
          const fsMod = await import('node:fs')
          // 从当前文件向上找 monorepo root(有 pnpm-workspace.yaml 的目录)
          let searchDir = __dirname
          let monorepoRoot = null
          for (let i = 0; i < 6; i++) {
            if (fsMod.existsSync(pathMod.join(searchDir, 'pnpm-workspace.yaml'))) {
              monorepoRoot = searchDir
              break
            }
            searchDir = pathMod.dirname(searchDir)
          }
          const candidates = monorepoRoot ? [
            pathMod.join(monorepoRoot, 'node_modules/.pnpm/@ffmpeg+ffmpeg@0.12.15/node_modules/@ffmpeg/ffmpeg/dist/esm/worker.js'),
            pathMod.join(monorepoRoot, 'packages/web/node_modules/@ffmpeg/ffmpeg/dist/esm/worker.js'),
          ] : []
          let workerSrc = null
          for (const p of candidates) {
            const abs = path.resolve(__dirname, p)
            if (fs.existsSync(abs)) {
              workerSrc = abs
              console.log('[jianhebox-fix-ffmpeg-worker] found worker at', abs)
              break
            }
          }
          if (!workerSrc) {
            console.log('[jianhebox-fix-ffmpeg-worker] NO worker.js found')
            return
          }
          const assetsDir = path.resolve(__dirname, 'dist/assets')
          console.log('[jianhebox-fix-ffmpeg-worker] assetsDir:', assetsDir)
          const srcDir = path.dirname(workerSrc)
          // 1. 拷贝 worker.js + 依赖(const.js / errors.js)
          for (const f of ['worker.js', 'const.js', 'errors.js', 'classes.js', 'types.js', 'utils.js', 'index.js']) {
            const src = path.join(srcDir, f)
            if (fs.existsSync(src)) {
              const dst = path.join(assetsDir, f)
              if (!fs.existsSync(dst)) {
                fs.copyFileSync(src, dst)
                console.log(`[jianhebox-fix-ffmpeg-worker] copied ${f}`)
              }
            }
          }
          // 2. 把 const.js 里的 CORE_URL 改成本地 vendor 路径
          const constDst = path.join(assetsDir, 'const.js')
          if (fs.existsSync(constDst)) {
            let content = fs.readFileSync(constDst, 'utf-8')
            content = content.replace(
              /CORE_URL = `https:\/\/unpkg\.com\/@ffmpeg\/core@[^/]+\/dist\/umd\/ffmpeg-core\.js`/,
              "CORE_URL = `/vendor/ffmpeg/ffmpeg-core.js`"
            )
            fs.writeFileSync(constDst, content)
            console.log('[jianhebox-fix-ffmpeg-worker] patched const.js CORE_URL → /vendor/ffmpeg/')
          }
          // 3. 找引用 worker 的 bundle,提取 worker hash,复制 worker 副本
          const files = fs.readdirSync(assetsDir)
          let workerCopied = false
          for (const f of files) {
            if (!f.endsWith('.js')) continue
            const fp = path.join(assetsDir, f)
            const c = fs.readFileSync(fp, 'utf-8')
            const m = c.match(/worker-([A-Za-z0-9_-]+)\.js/)
            if (!m) continue
            const workerHash = m[1]
            const targetName = `worker-${workerHash}.js`
            const targetPath = path.join(assetsDir, targetName)
            fs.copyFileSync(workerSrc, targetPath)
            console.log(`[jianhebox-fix-ffmpeg-worker] copied ffmpeg worker → ${targetName}`)
            workerCopied = true
            break
          }
          if (!workerCopied) {
            console.log('[jianhebox-fix-ffmpeg-worker] WARNING: no bundle referenced worker-*.js')
          }
          console.log('[jianhebox-fix-ffmpeg-worker] closeBundle END')
        },
      },
    ],
    server: {
      port: 18181,
      host: true,
      fs: {
        // 允许为工作区依赖提供服务
        allow: [
          path.resolve(__dirname, '..'),
          path.resolve(__dirname, '../ui/src'),
          path.resolve(__dirname, '../ui/dist'),  // 🇨🇳 2026-09-11 R55:让 vite dev serve 编译后的 ui dist
          path.resolve(__dirname, '../core/src'),
          path.resolve(__dirname, '../extension/src'),
        ]
      },
      hmr: true,
      watch: {
        // 确保监视monorepo中其他包的变化
        ignored: ['!**/node_modules/@prompt-optimizer/**']
      },
      headers: {
        // 启用 crossOriginIsolated,让 @remotion/whisper-web 能用 SharedArrayBuffer
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless'
      },
      // 🇨🇳 阿里云 ASR 代理(兼容旧路由,/api/audio/* 由 Hono 处理)
      proxy: {
        '/api/whisper': {
          target: 'https://hf-mirror.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/whisper/, '/ggerganov/whisper.cpp/resolve/main'),
          headers: {
            'Referer': 'https://hf-mirror.com/',
            'Origin': 'https://hf-mirror.com',
          },
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              delete proxyRes.headers['content-encoding']
            })
          }
        },
      }
    },
    preview: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless'
      }
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html')
        }
        // 🇨🇳 R57.8 修复:vite v8 (rolldown) 不支持 output.worker 配置,closeBundle hook 在 plugins 里
      }
    },
    publicDir: 'public',
    resolve: {
      preserveSymlinks: true,
      alias: {
        '@': resolve(__dirname, 'src'),
        '@prompt-optimizer/core': path.resolve(__dirname, '../core'),
        '@prompt-optimizer/ui': path.resolve(__dirname, '../ui'),
        '@prompt-optimizer/web': path.resolve(__dirname, '../web'),
        '@prompt-optimizer/extension': path.resolve(__dirname, '../extension')
      }
    },
    define: {
      // 🇨🇳 2026-08-31 M3.9 R33:只注入 NODE_ENV 到前端,绝不允许 VITE_ALIYUN_* 凭证进 bundle
      'process.env': {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
      // R57.9: 构建时默认语言
      JIANHEBOX_DEFAULT_LOCALE: JSON.stringify(process.env.JIANHEBOX_DEFAULT_LOCALE || 'zh-CN'),
      }
    }
  }
})