/**
 * 🇨🇳 2026-08-31 by Hermes
 * 阿里云 OSS 签名 URL 工具(GET 用)
 *
 * 给阿里云 ASR 一个能下载私有文件的签名 URL
 * 签名方式:OSS v1,query string 形式
 */

import crypto from 'crypto'

export interface OssGetUrlOptions {
  /** 过期时间(秒) */
  expiresSec?: number
  /** 文件下载后的名字(可选) */
  responseContentDisposition?: string
}

/**
 * 生成 OSS GET 签名 URL(给阿里云 ASR 下载用)
 *
 * URL 形式:
 *   https://<bucket>.<endpoint>/<object>?OSSAccessKeyId=...&Expires=...&Signature=...
 *
 * StringToSign(GET):
 *   GET\n
 *   <Content-MD5 或空>\n
 *   <Content-Type 或空>\n
 *   <Expires>\n
 *   /<bucket>/<object>
 */
export function signOssGetUrl(
  accessKeyId: string,
  accessKeySecret: string,
  bucket: string,
  endpoint: string,
  objectKey: string,
  opts: OssGetUrlOptions = {}
): string {
  const expires = Math.floor(Date.now() / 1000) + (opts.expiresSec || 600)
  const host = `${bucket}.${endpoint}`

  const stringToSign = [
    'GET',
    '', // Content-MD5
    '', // Content-Type
    String(expires),
    `/${bucket}/${objectKey}`,
  ].join('\n')

  const signature = crypto
    .createHmac('sha1', accessKeySecret)
    .update(stringToSign)
    .digest('base64')

  const url = `https://${host}/${objectKey}`
    + `?OSSAccessKeyId=${encodeURIComponent(accessKeyId)}`
    + `&Expires=${expires}`
    + `&Signature=${encodeURIComponent(signature)}`

  return url
}