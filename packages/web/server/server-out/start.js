// 🇨🇳 2026-09-01 M3.9 R38:生产模式独立启动 Hono API
// 用法: node --experimental-strip-types server/start.ts
//      或: tsx server/start.ts
//      或: bun server/start.ts
// 🇨🇳 2026-09-01 R39:启动时加载 .env(用 dotenv)
import { config as dotenvConfig } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 服务器部署时 .env 在 /jianhebox/api/.env(父目录),本地开发在 packages/web/.env
dotenvConfig({ path: path.resolve(__dirname, '..', '.env') });
dotenvConfig({ path: path.resolve(__dirname, '..', '..', '.env') });
// 🇨🇳 R57 部署版本:用编译后的 ./api.js(服务器无 strip-types flag)
const app = (await import('./api.js')).default;
const PORT = Number(process.env.PORT || 18182);
console.log(`[jianhebox-api prod] starting on port ${PORT}`);
// 🇨🇳 2026-09-01 R38 修:用 typeof 全局检查 Bun
const BunAny = globalThis.Bun;
if (BunAny && typeof BunAny.serve === 'function') {
    BunAny.serve({ port: PORT, fetch: app.fetch });
    console.log(`[jianhebox-api prod] using Bun on port ${PORT}`);
}
else {
    // node + @hono/node-server(用 createRequire 兼容 ESM)
    const { createRequire } = await import('module');
    const nodeRequire = createRequire(import.meta.url);
    const { serve } = nodeRequire('@hono/node-server');
    serve({ fetch: app.fetch, port: PORT });
    console.log(`[jianhebox-api prod] node fallback on port ${PORT}`);
}
