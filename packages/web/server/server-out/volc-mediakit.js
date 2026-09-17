/**
 * 🇨🇳 2026-09-03 R48:火山引擎 AI MediaKit — 人声背景音分离封装
 *
 * 纯音频原生支持(腾讯云 CI 强制 mp4 视频,这是双引擎的核心价值)
 *
 * 参考文档:
 *  - 提交任务:https://www.volcengine.com/docs/6448/2386113
 *  - 查询任务:https://www.volcengine.com/docs/6448/2278532
 *
 * 鉴权:Bearer Token (比腾讯云 V5 签名简单)
 * 异步模型:task_id 轮询(类似腾讯 JobId)
 * 输出:voice_audio_url + background_audio_url(24h 临时 HTTPS)
 *
 * ⚠️ 凭证铁律:API Key 只进 process.env(VOLC_MEDIAKIT_API_KEY),前端永远拿不到
 *    vite.config.ts 已经把它同步进 process.env
 */
const API_KEY = process.env.VOLC_MEDIAKIT_API_KEY || '';
const BASE_URL = 'https://mediakit.cn-beijing.volces.com/api/v1';
export const VOLC_CONFIG = {
    Enabled: !!API_KEY,
    ApiKey: API_KEY,
};
if (!VOLC_CONFIG.Enabled) {
    console.warn('[volc-mediakit] VOLC_MEDIAKIT_API_KEY 未配置,纯音频人声分离不可用');
}
/**
 * 提交人声背景音分离任务
 * @returns task_id(用于轮询)
 */
export async function submitVolcSeparate(input) {
    if (!VOLC_CONFIG.Enabled)
        throw new Error('火山引擎未配置(VOLC_MEDIAKIT_API_KEY)');
    const url = input.videoUrl || input.audioUrl;
    if (!url)
        throw new Error('audioUrl 或 videoUrl 必须传一个');
    const body = {};
    if (input.videoUrl)
        body.video_url = input.videoUrl;
    else
        body.audio_url = input.audioUrl;
    if (input.outputFormat && input.outputFormat !== 'aac') {
        // aac 是默认值,显式传节省字节
        body.output_format = input.outputFormat;
    }
    const res = await fetch(`${BASE_URL}/tools/separate-voice`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`火山提交失败: HTTP ${res.status} ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    if (!data.success) {
        const err = data.error || {};
        throw new Error(`火山提交失败: [${err.code}] ${err.message || '未知'}`);
    }
    if (!data.task_id)
        throw new Error('火山响应缺少 task_id');
    return { taskId: data.task_id };
}
/**
 * 查询任务状态
 *
 * 🇨🇳 2026-09-03 R48 修:真实端点是 GET /api/v1/tasks/{task_id}
 * 来源:https://github.com/volcengine/mediakit-cli/blob/main/internal/cloud/client.go
 *   path = "/api/v1/tasks/{task_id}"
 * 之前写 /api/v1/tools/tasks/{task_id} 是错的,导致 404
 */
export async function getVolcJobStatus(taskId) {
    if (!VOLC_CONFIG.Enabled)
        throw new Error('火山引擎未配置');
    const res = await fetch(`${BASE_URL}/tasks/${encodeURIComponent(taskId)}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
        },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`火山查询失败: HTTP ${res.status} ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    if (!data.success) {
        const err = data.error || {};
        throw new Error(`火山查询失败: [${err.code}] ${err.message || '未知'}`);
    }
    // 文档里状态枚举:queued / running / succeeded / failed
    // 我们内部用 completed 统一
    const rawStatus = data.status || '';
    let normalizedStatus = 'running';
    if (rawStatus === 'succeeded' || rawStatus === 'completed')
        normalizedStatus = 'completed';
    else if (rawStatus === 'failed')
        normalizedStatus = 'failed';
    else if (rawStatus === 'queued')
        normalizedStatus = 'queued';
    else
        normalizedStatus = 'running';
    return {
        status: normalizedStatus,
        result: data.result,
        error: data.error,
    };
}
/**
 * 轮询直到完成(默认 3 分钟超时,跟腾讯对齐)
 */
export async function waitForVolcJob(taskId, maxMs = 180000) {
    const start = Date.now();
    let lastStatus = null;
    while (Date.now() - start < maxMs) {
        const job = await getVolcJobStatus(taskId);
        lastStatus = job;
        if (job.status === 'completed')
            return job;
        if (job.status === 'failed') {
            throw new Error(`火山任务失败: [${job.error?.code}] ${job.error?.message || '未知'}`);
        }
        // 2 秒轮询一次,比腾讯云的 4 秒激进(火山一般 4 秒就返回)
        await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error(`火山任务超时(>${maxMs / 1000}s), last status: ${lastStatus?.status}`);
}
