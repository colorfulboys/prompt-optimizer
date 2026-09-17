/**
 * 🇨🇳 2026-09-11:真发验证码层
 *
 * 封装两条真发路径 + 一条 bcrypt 密码哈希:
 *   - 邮件:SMTP (QQ/163/Gmail/nodemailer)  — 国内送达稳定、零额外依赖
 *   - 短信:阿里云 Dysmsapi (走 @alicloud/pop-core REST,不引大 SDK)
 *   - 密码:bcryptjs (纯 JS,避免 native 编译踩坑)
 *
 * 设计原则:
 *   - 任一 provider 凭证缺失 → console.warn + 走 mock,绝不 throw(开发体验优先)
 *   - 返回 { ok, provider, ... } 而不是 throw,让上层路由自己决定 HTTP 状态
 *   - 与现有 email.ts / kv.ts / api.ts 解耦,api.ts 只调用本文件
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
// ============================================================
// 邮件 — SMTP (nodemailer)
// ============================================================
const EMAIL_LOG = path.join(os.tmpdir(), 'jianhebox_emails.log');
function hasSmtpCreds() {
    return !!(process.env.VITE_SMTP_USER && process.env.VITE_SMTP_PASS);
}
export async function sendEmailCode(to, code, ttlMin = 10) {
    if (!hasSmtpCreds()) {
        console.warn(`[auth-real] SMTP 凭证未配 (VITE_SMTP_USER / VITE_SMTP_PASS),邮件走 mock。验证码=${code} → ${to}`);
        return mockEmail(to, code, ttlMin);
    }
    try {
        const nodemailer = (await import('nodemailer')).default;
        const host = process.env.VITE_SMTP_HOST || 'smtp.qq.com';
        const port = Number(process.env.VITE_SMTP_PORT || 465);
        const secure = process.env.VITE_SMTP_SECURE !== '0'; // 默认 SSL
        const user = process.env.VITE_SMTP_USER;
        const pass = process.env.VITE_SMTP_PASS;
        const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
        const tmpl = authCodeEmailTemplate(code, ttlMin);
        const info = await transporter.sendMail({
            from: `"简盒 JianHeBox" <${user}>`,
            to,
            subject: tmpl.subject,
            html: tmpl.html,
            text: tmpl.text,
        });
        console.log(`[auth-real] SMTP 发送成功 → ${to}, messageId=${info.messageId}`);
        return { ok: true, provider: 'smtp' };
    }
    catch (e) {
        console.error('[auth-real] SMTP 发送失败,降级 mock:', e?.message);
        return { ok: false, provider: 'smtp', error: e?.message };
    }
}
function mockEmail(to, code, ttlMin) {
    const stamp = new Date().toISOString();
    const entry = `\n═══════════════════════════════════════════\n📧 [${stamp}] mock\nTo: ${to}\n验证码: ${code} (${ttlMin} 分钟内有效)\n═══════════════════════════════════════════\n`;
    try {
        fs.appendFileSync(EMAIL_LOG, entry, 'utf-8');
    }
    catch { }
    console.log(entry);
    return { ok: true, provider: 'mock' };
}
function authCodeEmailTemplate(code, ttlMin) {
    return {
        subject: `[简盒] 您的登录验证码:${code}`,
        html: `<div style="max-width:600px;margin:0 auto;padding:24px;font-family:Arial,sans-serif;">
  <h2 style="color:#333;">简盒 · 登录验证码</h2>
  <p>您好,</p>
  <p>您的登录验证码是:</p>
  <div style="background:#f4f4f4;padding:16px 24px;border-radius:8px;text-align:center;margin:24px 0;">
    <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#0066cc;">${code}</span>
  </div>
  <p>验证码 <strong>${ttlMin} 分钟</strong> 内有效,请尽快使用。</p>
  <p>如果不是您本人操作,请忽略此邮件。</p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #eee;" />
  <p style="color:#999;font-size:12px;">—— 简盒团队</p>
</div>`,
        text: `简盒 · 登录验证码\n\n验证码:${code}\n\n${ttlMin} 分钟内有效,如非本人操作请忽略。\n\n—— 简盒团队`,
    };
}
// ============================================================
// 短信 — 阿里云 Dysmsapi (SendSmsVerifyCode — 登录专用,个人开发者免费)
// ============================================================
// 🇨🇳 R57 2026-09-11:改用 SendSmsVerifyCode + CheckSmsVerifyCode
//   - 验证码由阿里云生成(后端不需要维护验证码表)
//   - 个人开发者用「恒创联众」测试签名免费(沙箱)
//   - 流程:send → 用户收短信 → check → 通过则创建/登录用户
// 用 @alicloud/pop-core (已有) 直接打 REST,不引入 @alicloud/dysmsapi20170525 SDK
const SMS_LOG = path.join(os.tmpdir(), 'jianhebox_sms.log');
function hasSmsCreds() {
    return !!(process.env.ALIYUN_SMS_ACCESS_KEY_ID &&
        process.env.ALIYUN_SMS_ACCESS_KEY_SECRET &&
        process.env.ALIYUN_SMS_SIGN_NAME &&
        process.env.ALIYUN_SMS_TEMPLATE_CODE);
}
const PHONE_RE = /^1[3-9]\d{9}$/;
export function isValidPhone(phone) {
    return PHONE_RE.test(phone);
}
/** 🇨🇳 R57:发送登录短信验证码
 *  走 SendSmsVerifyCode — 验证码由阿里云生成,返回 VerifyCode(测试用)
 *  生产环境验证码不会返回,我们只用它做 KV 关联
 */
export async function sendSmsCode(phone, ttlMin = 5) {
    if (!isValidPhone(phone)) {
        return { ok: false, provider: 'mock', error: '手机号格式不对' };
    }
    if (!hasSmsCreds()) {
        console.warn(`[auth-real] 阿里云短信凭证未配,短信走 mock`);
        return mockSms(phone, ttlMin);
    }
    try {
        const { default: Core } = await import('@alicloud/pop-core');
        // 🇨🇳 R57:SendSmsVerifyCode 属于「号码认证服务」(dypnsapi),不是「短信服务」(dysmsapi)
        const client = new Core({
            accessKeyId: process.env.ALIYUN_SMS_ACCESS_KEY_ID,
            accessKeySecret: process.env.ALIYUN_SMS_ACCESS_KEY_SECRET,
            endpoint: 'https://dypnsapi.aliyuncs.com',
            apiVersion: '2017-05-25',
        });
        const params = {
            RegionId: 'cn-hangzhou',
            // 🇨🇳 R57:号码认证服务要求 PhoneNumber(单数),不是 PhoneNumbers
            PhoneNumber: phone,
            SignName: process.env.ALIYUN_SMS_SIGN_NAME,
            TemplateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE,
            // 🇨🇳 R57:模板用 ##code## 占位符,阿里云自己替换;min 同样
            TemplateParam: JSON.stringify({ code: '##code##', min: '5' }),
            OutId: 'jianhebox',
        };
        const result = await client.request('SendSmsVerifyCode', params);
        if (result?.Code === 'OK') {
            console.log(`[auth-real] SendSmsVerifyCode OK → ${phone}, bizId=${result.BizId}`);
            // 沙箱模式:VerifyCode 字段(测试期有),生产期无,需要靠 checkVerifyCode 校验
            return {
                ok: true,
                provider: 'aliyun',
                bizId: result.BizId,
                code: result.VerifyCode, // 沙箱会返回真实验证码(测试用),生产期 undefined
                requestId: result.RequestId,
            };
        }
        console.error(`[auth-real] SendSmsVerifyCode 失败: ${result?.Code} - ${result?.Message}`);
        return { ok: false, provider: 'aliyun', error: result?.Message || result?.Code };
    }
    catch (e) {
        console.error('[auth-real] SendSmsVerifyCode 异常,降级 mock:', e?.message);
        return { ok: false, provider: 'aliyun', error: e?.message };
    }
}
/** 🇨🇳 R57:校验短信验证码 */
export async function checkSmsCode(phone, code) {
    if (!isValidPhone(phone)) {
        return { ok: false, provider: 'mock', error: '手机号格式不对' };
    }
    if (!hasSmsCreds()) {
        return mockCheckSms(phone, code);
    }
    try {
        const { default: Core } = await import('@alicloud/pop-core');
        // 🇨🇳 R57:CheckSmsVerifyCode 也属于「号码认证服务」
        const client = new Core({
            accessKeyId: process.env.ALIYUN_SMS_ACCESS_KEY_ID,
            accessKeySecret: process.env.ALIYUN_SMS_ACCESS_KEY_SECRET,
            endpoint: 'https://dypnsapi.aliyuncs.com',
            apiVersion: '2017-05-25',
        });
        const params = {
            RegionId: 'cn-hangzhou',
            // 🇨🇳 R57:号码认证服务要求 PhoneNumber(单数)
            PhoneNumber: phone,
            SignName: process.env.ALIYUN_SMS_SIGN_NAME,
            TemplateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE,
            VerifyCode: code,
            OutId: 'jianhebox',
        };
        const result = await client.request('CheckSmsVerifyCode', params);
        if (result?.Code === 'OK') {
            console.log(`[auth-real] CheckSmsVerifyCode OK → ${phone}`);
            return { ok: true, provider: 'aliyun', requestId: result.RequestId };
        }
        console.error(`[auth-real] CheckSmsVerifyCode 失败: ${result?.Code} - ${result?.Message}`);
        return { ok: false, provider: 'aliyun', error: result?.Message || result?.Code };
    }
    catch (e) {
        console.error('[auth-real] CheckSmsVerifyCode 异常:', e?.message);
        return { ok: false, provider: 'aliyun', error: e?.message };
    }
}
function mockSms(phone, ttlMin) {
    // mock 模式:本地生成 6 位验证码
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const stamp = new Date().toISOString();
    const entry = `\n═══════════════════════════════════════════\n📱 [${stamp}] mock\nTo: ${phone}\n验证码: ${code} (${ttlMin} 分钟内有效)\n═══════════════════════════════════════════\n`;
    try {
        fs.appendFileSync(SMS_LOG, entry, 'utf-8');
    }
    catch { }
    console.log(entry);
    return { ok: true, provider: 'mock', code };
}
function mockCheckSms(phone, code) {
    // mock 模式:任意 6 位都通过(方便本地开发)
    if (!/^\d{6}$/.test(code)) {
        return { ok: false, provider: 'mock', error: '验证码必须是 6 位数字' };
    }
    return { ok: true, provider: 'mock' };
}
// ============================================================
// 密码 — bcryptjs (10 rounds,够用且对登录路径 < 200ms)
// ============================================================
export async function hashPassword(plain) {
    const bcrypt = (await import('bcryptjs')).default;
    return bcrypt.hash(plain, 10);
}
export async function verifyPassword(plain, hash) {
    if (!hash)
        return false;
    const bcrypt = (await import('bcryptjs')).default;
    return bcrypt.compare(plain, hash);
}
