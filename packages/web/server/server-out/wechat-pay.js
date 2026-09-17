/**
 * 🇨🇳 R57:微信支付 V3 API 封装(Native 扫码支付)
 *
 * 文档:https://pay.weixin.qq.com/wiki/doc/apiv3/wxpay/pay/combine/chapter3_1.shtml
 *
 * 流程:
 * 1. 商户后端调 /v3/pay/transactions/native(传 out_trade_no + amount)
 * 2. 微信返回 code_url(二维码内容)
 * 3. 商户生成二维码图给用户扫码
 * 4. 用户支付后,微信调 /v3/pay/transactions/out-trade-no/{out_trade_no} 异步通知(回调)
 * 5. 商户收到回调,验证签名 + 校验金额后标记订单已支付
 *
 * 生产环境需要:
 *   - WECHAT_PAY_MCH_ID(商户号)
 *   - WECHAT_PAY_API_KEY(API v3 密钥 32 位)
 *   - WECHAT_PAY_CERT_PATH(apiclient_cert.pem 路径,异步回调验签用)
 *   - WECHAT_PAY_KEY_PATH(apiclient_key.pem 路径)
 *   - WECHAT_PAY_NOTIFY_URL(回调 URL,如 https://jianhebox.com/api/pay/wechat-callback)
 */
import crypto from 'node:crypto';
import https from 'node:https';
import fs from 'node:fs';
const WECHAT_PAY_API_BASE = 'https://api.mch.weixin.qq.com';
// 检测是否 mock 模式
const isMock = !process.env.WECHAT_PAY_MCH_ID || process.env.VITE_PAY_MOCK === '1';
const config = {
    mchId: process.env.WECHAT_PAY_MCH_ID || 'mock-mch-id',
    apiKey: process.env.WECHAT_PAY_API_KEY || 'mock-api-key-32bytes-mock-mock-mock',
    certPath: process.env.WECHAT_PAY_CERT_PATH || '',
    keyPath: process.env.WECHAT_PAY_KEY_PATH || '',
    notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL || 'https://jianhebox.com/api/pay/wechat-callback',
    isMock,
};
/** 生成商户订单号(out_trade_no,32 字符内,纯数字) */
export function generateOutTradeNo(userId) {
    const ts = Date.now().toString().slice(-10); // 10 位时间戳
    const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const userHash = crypto.createHash('md5').update(userId).digest('hex').slice(0, 6); // 6 位
    return `${ts}${rand}${userHash}`; // 共 20 位
}
/** 生成签名 Authorization 头(API v3) */
function buildAuthHeader(method, urlPath, body) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;
    const signature = crypto
        .createHash('sha256')
        .update(message + config.apiKey)
        .digest('hex')
        .toUpperCase();
    return `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonce}",timestamp="${timestamp}",signature="${signature}",serial_no="mock-serial"`;
}
/** 调用微信 Native 下单(返回二维码 URL) */
export async function createNativeOrder(params) {
    if (config.isMock) {
        // Mock 模式:返回一个假二维码 URL(让前端能展示扫码图)
        // 生产环境会拿到真实的 weixin://wxpay/bizpayurl?pr=xxxxx
        return {
            codeUrl: `weixin://wxpay/bizpayurl?pr=mock_${params.outTradeNo}`,
            mock: true,
        };
    }
    // 真模式:调微信 API
    const urlPath = '/v3/pay/transactions/native';
    const body = JSON.stringify({
        out_trade_no: params.outTradeNo,
        description: params.description,
        notify_url: config.notifyUrl,
        amount: {
            total: params.amountCents,
            currency: 'CNY',
        },
        attach: params.attach || '',
    });
    return new Promise((resolve, reject) => {
        const req = https.request(`${WECHAT_PAY_API_BASE}${urlPath}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': buildAuthHeader('POST', urlPath, body),
                'User-Agent': 'jianhebox-pay/1.0',
            },
        }, (res) => {
            let chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const data = Buffer.concat(chunks).toString('utf-8');
                if (res.statusCode === 200) {
                    try {
                        const parsed = JSON.parse(data);
                        resolve({ codeUrl: parsed.code_url });
                    }
                    catch (e) {
                        reject(new Error(`微信响应 JSON 解析失败: ${data}`));
                    }
                }
                else {
                    reject(new Error(`微信 API 失败 [${res.statusCode}]: ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}
/** 查询订单状态(主动查,不用等回调) */
export async function queryOrder(outTradeNo) {
    if (config.isMock) {
        // Mock 模式:无法查,前端靠轮询模拟
        return { status: 'pending' };
    }
    const urlPath = `/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${config.mchId}`;
    return new Promise((resolve, reject) => {
        const req = https.request(`${WECHAT_PAY_API_BASE}${urlPath}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': buildAuthHeader('GET', urlPath, ''),
                'User-Agent': 'jianhebox-pay/1.0',
            },
        }, (res) => {
            let chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const data = Buffer.concat(chunks).toString('utf-8');
                if (res.statusCode === 200) {
                    const parsed = JSON.parse(data);
                    resolve({
                        status: parsed.trade_state === 'SUCCESS' ? 'paid' : 'pending',
                        transactionId: parsed.transaction_id,
                        paidAt: parsed.success_time,
                    });
                }
                else {
                    reject(new Error(`微信查询失败 [${res.statusCode}]: ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}
/** 验证微信回调签名(防止伪造回调) */
export function verifyCallbackSignature(timestamp, nonce, body, signature) {
    if (config.isMock)
        return true; // Mock 模式跳过验签
    const message = `${timestamp}\n${nonce}\n${body}\n`;
    const certPem = fs.readFileSync(config.certPath, 'utf-8');
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(message);
    return verifier.verify(certPem, Buffer.from(signature, 'base64'));
}
/** 解密微信回调的 resource.ciphertext(AES-256-GCM) */
export function decryptCallbackResource(ciphertext, associatedData, nonce) {
    if (config.isMock) {
        // Mock 模式直接返回(假定 ciphertext 已是明文 JSON)
        try {
            return Buffer.from(ciphertext, 'base64').toString('utf-8');
        }
        catch {
            return ciphertext;
        }
    }
    const key = Buffer.from(config.apiKey, 'utf-8');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(nonce, 'utf-8'));
    decipher.setAuthTag(Buffer.from(ciphertext.slice(-32), 'base64'));
    decipher.setAAD(Buffer.from(associatedData, 'utf-8'));
    // Node crypto 返回 Buffer,转字符串
    let decrypted = decipher.update(Buffer.from(ciphertext.slice(0, -32), 'base64'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf-8');
}
