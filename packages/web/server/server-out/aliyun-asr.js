/**
 * 🇨🇳 2026-08-31 by Hermes
 * 阿里云"录音文件识别"客户端(用官方 SDK)
 *
 * 流程(异步,两阶段):
 *   1. SubmitTask → 返回 task_id
 *   2. GetTaskResult 轮询 → status=20000000 时拿到文字
 *
 * 用 @alicloud/nls-filetrans-2018-08-17 SDK,省去手写签名
 */
import Core from '@alicloud/pop-core';
import { signOssGetUrl } from './oss-get.js';
/**
 * 创建阿里云 SDK 客户端
 */
function createClient(cfg) {
    return new Core({
        accessKeyId: cfg.accessKeyId,
        accessKeySecret: cfg.accessKeySecret,
        endpoint: `https://filetrans.${cfg.region}.aliyuncs.com`,
        apiVersion: '2018-08-17',
    });
}
/**
 * 第 1 步:提交录音文件识别任务
 *
 * SDK API: client.request('SubmitTask', params, options)
 * 业务参数:
 *   {
 *     "appkey": "your-appkey",
 *     "file_link": "https://...audio.mp3",
 *     "version": "4.0",
 *     "enable_words": false,
 *     "auto_split": false,
 *     "enable_sample_rate_adaptive": true,
 *     "language": "普通话"
 *   }
 *
 * Response: { TaskId, Status, Message }
 */
export async function submitAsrTask(cfg, audioUrl, format = 'mp3', options = {}) {
    const client = createClient(cfg);
    // 🇨🇳 2026-08-31:OSS 是私有 Bucket,需要生成 GET 签名 URL 给 ASR 下载
    const signedAudioUrl = signOssGetUrl(cfg.accessKeyId, cfg.accessKeySecret, process.env.ALIYUN_OSS_BUCKET || '', process.env.ALIYUN_OSS_ENDPOINT || '', audioUrl.startsWith('https://') ? audioUrl.split('.aliyuncs.com/')[1] : audioUrl, { expiresSec: 3600 });
    console.log('[ASR] using signed audio URL:', signedAudioUrl.slice(0, 100) + '...');
    const params = {
        Task: JSON.stringify({
            appkey: cfg.appKey,
            file_link: signedAudioUrl,
            version: '4.0',
            enable_words: options.enableWords ?? false,
            // 🇨🇳 9-3 R49.7:auto_split 改为 true,长音频会按静音自动分段
            // (160s 测试音频之前只识别出 1 句,设了 auto_split 后会按句法/静音分段,句子更细)
            auto_split: options.autoSplit ?? true,
            enable_sample_rate_adaptive: true,
            enable_callback: false,
            language: options.language || '普通话',
        }),
    };
    try {
        const result = await client.request('SubmitTask', params, { method: 'POST' });
        console.log('[ASR] submit response:', result);
        return {
            taskId: result.TaskId || result.task_id || '',
            status: result.StatusCode ?? result.Status ?? result.status_code ?? -1,
            message: result.StatusText || result.Message || result.message || '',
        };
    }
    catch (err) {
        console.error('[ASR] submit error:', err);
        throw new Error(`阿里云 ASR 提交失败: ${err.message || JSON.stringify(err)}`);
    }
}
/**
 * 第 2 步:轮询任务结果
 *
 * SDK API: client.request('GetTaskResult', { TaskId, AppKey })
 * Response:
 *   {
 *     TaskId, Status, Message,
 *     Result: '{"Sentences":[{Text,BeginTime,EndTime,ChannelId}]}'  // 4.0 版本
 *   }
 */
export async function pollAsrTask(cfg, taskId) {
    const client = createClient(cfg);
    try {
        const result = await client.request('GetTaskResult', {
            TaskId: taskId,
        }, { method: 'GET' });
        console.log('[ASR] poll response (raw):', JSON.stringify(result).slice(0, 500));
        let sentences;
        let resultText;
        let durationSec;
        if (result.Result) {
            // Result 是 JSON 字符串,需要解析
            try {
                const parsed = typeof result.Result === 'string'
                    ? JSON.parse(result.Result)
                    : result.Result;
                // 4.0 版本用驼峰,2.0 用下划线
                const rawSentences = parsed.Sentences || parsed.sentences;
                if (rawSentences && rawSentences.length > 0) {
                    // 🇨🇳 9-3 R49.3:统一字段名为下划线(便于前端按一致 schema 读)
                    sentences = rawSentences.map((s) => ({
                        text: s.Text || s.text || '',
                        begin_time: s.BeginTime ?? s.begin_time ?? 0,
                        end_time: s.EndTime ?? s.end_time ?? 0,
                        channel_id: s.ChannelId ?? s.channel_id ?? 0,
                        speaker_id: s.SpeakerId ?? s.speaker_id,
                    }));
                    resultText = sentences.map((s) => s.text).join('');
                }
            }
            catch (e) {
                console.warn('[ASR] Result 解析失败:', e);
                resultText = typeof result.Result === 'string' ? result.Result : JSON.stringify(result.Result);
            }
        }
        // 🇨🇳 9-3 R49.3:从轮询响应里抽 BizDuration(毫秒),转成秒
        const bizDurationMs = result.BizDuration ?? result.biz_duration;
        if (typeof bizDurationMs === 'number' && bizDurationMs > 0) {
            durationSec = Math.ceil(bizDurationMs / 1000);
        }
        return {
            taskId: result.TaskId || result.task_id || taskId,
            status: result.StatusCode ?? result.Status ?? result.status_code ?? -1,
            message: result.StatusText || result.Message || result.message || '',
            result: resultText,
            sentences,
            durationSec,
        };
    }
    catch (err) {
        console.error('[ASR] poll error:', err);
        throw new Error(`阿里云 ASR 轮询失败: ${err.message || JSON.stringify(err)}`);
    }
}
/**
 * 完整流程:提交 + 轮询 + 返回结果
 *
 * 默认超时 5 分钟(长音频需要时间)
 * 每 3 秒轮询一次
 */
export async function transcribeByUrl(cfg, audioUrl, format = 'mp3', onProgress) {
    // 1. 提交任务
    const submitResult = await submitAsrTask(cfg, audioUrl, format);
    // 提交成功的状态码:21050000 (阿里云 SubmitTask 成功)
    // 转写成功的状态码:20000000
    if (submitResult.status !== 21050000 && submitResult.status !== 20000000) {
        throw new Error(`ASR 提交失败: ${submitResult.message} (status=${submitResult.status})`);
    }
    onProgress?.('submitted', submitResult.taskId);
    // 2. 轮询结果
    const startTime = Date.now();
    const maxWaitMs = 5 * 60 * 1000; // 5 分钟超时
    const pollInterval = 3000;
    // 阿里云状态码(根据实际日志修正:21050000 + StatusText:"SUCCESS" + Sentences 非空
    //                    = 转写完成状态,阿里云官方把 21050000 也用于成功):
    //   20000000 = 转写成功(有内容,部分接口返回)
    //   21050003 = 转写成功(无有效片段,如静音)
    //   21050000 = SubmitTask 成功 / GetTaskResult 成功(带 Result.Sentences)
    //   40000000+ = 错误
    // 🇨🇳 9-3 R49.2:必须把 21050000 当成功,否则永远轮询
    const ASR_SUCCESS_CODES = new Set([20000000, 21050003, 21050000]);
    const ASR_ERROR_CODES_START = 40000000;
    const ASR_RUNNING_CODES = new Set([20000001, 20000002, 20000003]);
    while (Date.now() - startTime < maxWaitMs) {
        await new Promise((r) => setTimeout(r, pollInterval));
        const result = await pollAsrTask(cfg, submitResult.taskId);
        // 🇨🇳 9-3 R49.2:核心修复 - 只要 Sentences 有内容,即使 StatusCode 是 21050000,
        //                 也直接当完成处理(阿里云把 21050000 当成"成功")
        if (result.sentences && result.sentences.length > 0) {
            onProgress?.('success', submitResult.taskId);
            return result;
        }
        if (ASR_SUCCESS_CODES.has(result.status) && result.result) {
            onProgress?.('success', submitResult.taskId);
            return result;
        }
        if (result.status >= ASR_ERROR_CODES_START && !ASR_RUNNING_CODES.has(result.status)) {
            onProgress?.('failed', submitResult.taskId);
            throw new Error(`ASR 转写失败: ${result.message} (status=${result.status})`);
        }
        // 20000001 (等待中) 或 20000002 (运行中) → 继续轮询
        onProgress?.('running', submitResult.taskId);
    }
    throw new Error('ASR 转写超时(超过5分钟)');
}
