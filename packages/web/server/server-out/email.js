/**
 * 🇨🇳 2026-08-31:邮箱发送(本地 Mock + SMTP)
 *
 * M2 本地测试:用 console + 写本地 log 文件,模拟发送邮件
 * 生产部署:用 SMTP (QQ/163/Gmail) - 走 nodemailer
 *
 * 凭证(生产):
 *   - VITE_SMTP_HOST (e.g. smtp.qq.com)
 *   - VITE_SMTP_PORT (e.g. 465)
 *   - VITE_SMTP_SECURE (1=SSL, 0=STARTTLS)
 *   - VITE_SMTP_USER (发件邮箱)
 *   - VITE_SMTP_PASS (授权码,不是登录密码)
 *
 * 启用 mock:设置 VITE_AUTH_MOCK_EMAIL=1(默认本地就是 mock)
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const EMAIL_LOG = path.join(os.tmpdir(), 'jianhebox_emails.log');
const USE_MOCK = process.env.VITE_AUTH_MOCK_EMAIL === '1' || process.env.VITE_AUTH_MOCK_EMAIL === 'true';
/**
 * 发送邮件(根据环境自动选 mock 或 SMTP)
 */
export async function sendEmail(opts) {
    if (USE_MOCK) {
        return sendEmailMock(opts);
    }
    return sendEmailSMTP(opts);
}
// ========== Mock:写到 /tmp/jianhebox_emails.log + console ==========
function sendEmailMock(opts) {
    const stamp = new Date().toISOString();
    const msgId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry = `
═══════════════════════════════════════════
📧 [${stamp}] ${msgId}
To: ${opts.to}
Subject: ${opts.subject}
───────────────────────────────────────────
${opts.text || opts.html}
═══════════════════════════════════════════
`;
    try {
        fs.appendFileSync(EMAIL_LOG, entry, 'utf-8');
    }
    catch (e) {
        console.error('[email-mock] 写 log 失败:', e.message);
    }
    console.log(entry);
    return { ok: true, provider: 'mock', messageId: msgId };
}
// ========== SMTP:QQ / 163 / Gmail ==========
async function sendEmailSMTP(opts) {
    // 动态 import 避免 nodemailer 没装时 mock 仍可用
    let nodemailer;
    try {
        nodemailer = (await import('nodemailer')).default;
    }
    catch (e) {
        console.error('[email-smtp] nodemailer 未安装,降级 mock:', e.message);
        return sendEmailMock(opts);
    }
    const host = process.env.VITE_SMTP_HOST || 'smtp.qq.com';
    const port = Number(process.env.VITE_SMTP_PORT || 465);
    const secure = process.env.VITE_SMTP_SECURE !== '0'; // 默认 SSL
    const user = process.env.VITE_SMTP_USER;
    const pass = process.env.VITE_SMTP_PASS;
    if (!user || !pass) {
        console.error('[email-smtp] VITE_SMTP_USER / VITE_SMTP_PASS 未配置,降级 mock');
        return sendEmailMock(opts);
    }
    try {
        const transporter = nodemailer.createTransport({
            host, port, secure,
            auth: { user, pass },
        });
        const info = await transporter.sendMail({
            from: `"简盒 JianHeBox" <${user}>`,
            to: opts.to,
            subject: opts.subject,
            text: opts.text,
            html: opts.html,
        });
        console.log(`[email-smtp] sent to ${opts.to}, messageId=${info.messageId}`);
        return { ok: true, provider: 'smtp', messageId: info.messageId };
    }
    catch (e) {
        console.error('[email-smtp] 发送失败:', e.message);
        return { ok: false, provider: 'smtp', error: e.message };
    }
}
/**
 * 🇨🇳 R55 2026-09-11:欢迎注册邮件(注册成功触发)
 * - 模板告知用户:邮箱 / 密码 / 忘记密码入口
 * - 走和验证码邮件相同的 sendEmail()(自动 mock/SMTP 切换)
 */
export async function sendWelcomeEmail(to) {
    const subject = '[简盒] 欢迎注册简盒,您的账号已开通';
    const text = `欢迎注册简盒!您的账号已开通。\n\n` +
        `登录邮箱:${to}\n` +
        `密码:您在注册时设置的密码(请妥善保管)\n\n` +
        `如果忘记密码,可在登录页点击「忘记密码」通过邮箱验证码重置。\n` +
        `登录后 7 天内无需再次输入密码。\n\n` +
        `—— 简盒团队`;
    const html = `
<div style="max-width:600px;margin:0 auto;padding:24px;font-family:Arial,sans-serif;">
  <h2 style="color:#333;">欢迎注册简盒 🎉</h2>
  <p>您好,</p>
  <p>您的简盒账号已开通,现在可以用邮箱 + 密码登录。</p>
  <div style="background:#f4f4f4;padding:16px 24px;border-radius:8px;margin:20px 0;">
    <div style="margin:6px 0;"><strong>登录邮箱:</strong> ${to}</div>
    <div style="margin:6px 0;"><strong>登录密码:</strong> 您在注册时设置的密码(请妥善保管)</div>
  </div>
  <p>忘记密码时,可在登录页点击「忘记密码」通过邮箱验证码重置。</p>
  <p>登录后保持 7 天,期间不用重复输入密码。</p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #eee;" />
  <p style="color:#999;font-size:12px;">—— 简盒团队</p>
</div>`.trim();
    return sendEmail({ to, subject, text, html });
}
/** 验证码邮件模板 */
export function authCodeEmail(code, ttlMin = 10) {
    return {
        subject: `[简盒] 您的登录验证码:${code}`,
        html: `
<div style="max-width:600px;margin:0 auto;padding:24px;font-family:Arial,sans-serif;">
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
</div>
`.trim(),
        text: `简盒 · 登录验证码\n\n验证码:${code}\n\n${ttlMin} 分钟内有效,如非本人操作请忽略。\n\n—— 简盒团队`,
    };
}
