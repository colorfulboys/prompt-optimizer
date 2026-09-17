/**
 * 🇨🇳 2026-08-31 by Hermes
 * 阿里云 OSS STS 临时签名工具
 *
 * 用云账号 AccessKey 签一个 5 分钟过期的 STS token
 * 给前端用这个 token 直接 PUT 到 OSS(不走 server 中转)
 *
 * ⚠️ 生产环境必须改用 RAM 用户 + STS 服务(AssumeRole API)
 *    本地开发先用云账号简化
 */

import crypto from 'crypto'

interface StsCred {
  AccessKeyId: string
  AccessKeySecret: string
  SecurityToken: string
  Expiration: string
}

/**
 * 直接用云账号 AccessKey 签一个简化版 STS token
 * 本地开发够用,生产要换 AssumeRole
 *
 * OSS PutObject 的 policy 格式:
 * {
 *   "Statement": [{
 *     "Action": ["oss:PutObject"],
 *     "Effect": "Allow",
 *     "Resource": ["acs:oss:*:bucket/object-prefix/*"]
 *   }],
 *   "Version": "1"
 * }
 */

export interface OssStsConfig {
  accessKeyId: string
  accessKeySecret: string
  bucket: string
  region: string
  endpoint: string
}

export interface OssSignedUrl {
  /** 临时签名 URL(5 分钟过期,前端用它直接 PUT 上传) */
  uploadUrl: string
  /** 上传后的对象 key(用于后续 ASR 调用) */
  objectKey: string
  /** 这个 URL 的过期时间戳(ms) */
  expiresAt: number
}

/**
 * 生成 OSS PutObject 签名 URL(简化版,本地开发用)
 *
 * 注意:阿里云官方推荐用 STS AssumeRole + 临时 token
 * 但本地开发阶段,我们用云账号 AccessKey 直接签 URL 也行
 * (URL 形式:`?OSSAccessKeyId=...&Signature=...&Expires=...`)
 */
export interface OssSignedUrlOptions {
  /** 文件 Content-Type,默认 application/octet-stream */
  contentType?: string
}

/**
 * 生成 OSS PutObject 签名 URL(简化版,本地开发用)
 *
 * 注意:阿里云官方推荐用 STS AssumeRole + 临时 token
 * 但本地开发阶段,我们用云账号 AccessKey 直接签 URL 也行
 * (URL 形式:`?OSSAccessKeyId=...&Signature=...&Expires=...`)
 *
 * OSS v1 签名规则:
 *   PUT\n
 *   <Content-MD5 或空>\n
 *   <Content-Type>\n
 *   <Expires>\n
 *   /<bucket>/<object>
 */
export function signOssPutUrl(
  cfg: OssStsConfig,
  objectKey: string,
  expiresSec = 300,
  opts: OssSignedUrlOptions = {}
): OssSignedUrl {
  const expires = Math.floor(Date.now() / 1000) + expiresSec
  const host = `${cfg.bucket}.${cfg.endpoint}`
  const contentType = opts.contentType || 'application/octet-stream'

  // OSS v1 签名 5 行:Method / MD5 / Content-Type / Expires / CanonicalizedResource
  const stringToSign = [
    'PUT',
    '', // Content-MD5(空)
    contentType,
    String(expires),
    `/${cfg.bucket}/${objectKey}`,
  ].join('\n')

  const signature = crypto
    .createHmac('sha1', cfg.accessKeySecret)
    .update(stringToSign)
    .digest('base64')

  const uploadUrl =
    `https://${host}/${objectKey}` +
    `?OSSAccessKeyId=${encodeURIComponent(cfg.accessKeyId)}` +
    `&Expires=${expires}` +
    `&Signature=${encodeURIComponent(signature)}`

  return {
    uploadUrl,
    objectKey,
    expiresAt: expires * 1000,
  }
}

/**
 * 生成 OSS DeleteObject 签名 URL(cron 清理过期文件用)
 *
 * 与 PUT 签名类似,只是 Method 换成 DELETE
 * OSS v1 签名规则:
 *   DELETE\n
 *   <Content-MD5 或空>\n
 *   <Content-Type 或空>\n
 *   <Expires>\n
 *   /<bucket>/<object>
 */
export function signOssDeleteUrl(
  cfg: OssStsConfig,
  objectKey: string,
  expiresSec = 60
): string {
  const expires = Math.floor(Date.now() / 1000) + expiresSec
  const host = `${cfg.bucket}.${cfg.endpoint}`
  // DELETE 签名 5 行(Content-MD5 空 + Content-Type 空)
  const stringToSign = [
    'DELETE',
    '', // Content-MD5 空
    '', // Content-Type 空
    String(expires),
    `/${cfg.bucket}/${objectKey}`,
  ].join('\n')
  const signature = crypto
    .createHmac('sha1', cfg.accessKeySecret)
    .update(stringToSign)
    .digest('base64')
  return (
    `https://${host}/${objectKey}` +
    `?OSSAccessKeyId=${encodeURIComponent(cfg.accessKeyId)}` +
    `&Expires=${expires}` +
    `&Signature=${encodeURIComponent(signature)}`
  )
}

/**
 * 生成用于 OSS 访问的 STS 凭证(生产级方案)
 *
 * 需要先在 RAM 控制台给 AccessKey 授权:
 *   - AliyunOSSFullAccess 或自定义策略
 *   - 创建 AssumeRole 角色,授权策略
 *
 * 本地开发阶段先不实现,生产时补
 */
export async function assumeRoleForOss(
  cfg: OssStsConfig,
  roleArn: string,
  expiresSec = 3600
): Promise<StsCred> {
  // 调用 https://sts.aliyuncs.com/?Action=AssumeRole
  // 这里留 TODO,生产时实现
  throw new Error('AssumeRole not implemented for local; use signOssPutUrl instead')
}

/**
 * 给前端返回一个上传签名
 *
 * API:
 *   GET /api/audio/upload-url?filename=xxx.mp3
 *   → { uploadUrl, objectKey, expiresAt }
 */
export function createUploadUrlHandler(cfg: OssStsConfig) {
  return async (c: any) => {
    const filename = c.req.query('filename') || `audio-${Date.now()}.mp3`
    // 安全:objectKey 加日期前缀,避免单目录文件过多
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '/')
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const objectKey = `audio/${today}/${Date.now()}-${safeFilename}`

    const signed = signOssPutUrl(cfg, objectKey, 300)

    return c.json({
      uploadUrl: signed.uploadUrl,
      objectKey: signed.objectKey,
      bucket: cfg.bucket,
      region: cfg.region,
      endpoint: cfg.endpoint,
      // 给前端直接拼 URL(用 objectKey)
      publicUrl: `https://${cfg.bucket}.${cfg.endpoint}/${signed.objectKey}`,
      expiresAt: signed.expiresAt,
    })
  }
}