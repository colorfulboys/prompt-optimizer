export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (url.pathname === "/api/google-indexing/health") {
    return new Response(
      JSON.stringify({ ok: true, service: "jianhebox-google-indexing", ts: new Date().toISOString() }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  if (url.pathname === "/api/google-indexing/publish" && request.method === "POST") {
    try {
      const body = await request.json();
      const urls = body.urls || [];
      if (!Array.isArray(urls) || urls.length === 0) {
        return new Response(JSON.stringify({ ok: false, error: "urls 不能为空" }), {
          status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const SA_JSON = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
      const token = await getAccessToken(SA_JSON);

      const results = [];
      for (const u of urls.slice(0, 200)) {
        try {
          const r = await publishUrl(token, u);
          results.push(r);
        } catch (e) {
          results.push({ url: u, status: 0, ok: false, error: e.message });
        }
      }

      const success = results.filter((r) => r.ok).length;
      const failed = results.length - success;

      return new Response(JSON.stringify({ ok: true, success, failed, results }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: e.message }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }

  // 🚨 2026-11-20 新增: GSC (Search Console) 查询代理
  // 背景: 本机和 ECS 都不通 Google (需翻墙), 但 Cloudflare 出站没问题
  //       -> 走这里查 searchAnalytics / urlInspection, 本机不翻墙也能拿 SEO 数据
  if (url.pathname === "/api/google-indexing/gsc/searchanalytics" && request.method === "POST") {
    try {
      const body = await request.json();
      const SA_JSON = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
      // searchAnalytics 需要 webmasters.readonly scope
      const token = await getAccessToken(SA_JSON, "https://www.googleapis.com/auth/webmasters.readonly");
      const site = body.site;
      if (!site) throw new Error("site 必填");
      const siteEnc = encodeURIComponent(site);
      const r = await fetch(
        `https://searchconsole.googleapis.com/webmasters/v3/sites/${siteEnc}/searchAnalytics/query`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            startDate: body.startDate,
            endDate: body.endDate,
            dimensions: body.dimensions || [],
            dimensionFilterGroups: body.dimensionFilterGroups || [],
            rowLimit: body.rowLimit || 100,
          }),
        }
      );
      const txt = await r.text();
      return new Response(txt, {
        status: r.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: e.message }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }

  if (url.pathname === "/api/google-indexing/gsc/inspect" && request.method === "POST") {
    try {
      const body = await request.json();
      const SA_JSON = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
      const token = await getAccessToken(SA_JSON, "https://www.googleapis.com/auth/webmasters.readonly");
      const site = body.site;
      if (!site) throw new Error("site 必填");
      const siteEnc = encodeURIComponent(site);
      const results = [];
      for (const u of (body.urls || []).slice(0, 50)) {
        try {
          const r = await fetch(
            "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
            {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ siteUrl: site, inspectionUrl: u, languageCode: body.languageCode || "en-US" }),
            }
          );
          results.push({ url: u, status: r.status, data: await r.json() });
        } catch (e) {
          results.push({ url: u, status: 0, error: e.message });
        }
      }
      return new Response(JSON.stringify({ ok: true, results }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: e.message }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }

  return new Response(JSON.stringify({ ok: false, error: "Not Found" }), {
    status: 404, headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function getAccessToken(sa, scope) {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    scope: scope || "https://www.googleapis.com/auth/indexing",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  };

  const enc = new TextEncoder();
  const headerB64 = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;

  const pemContents = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(data));
  const sigB64 = b64urlBytes(new Uint8Array(sig));
  const jwt = `${data}.${sigB64}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  return (await res.json()).access_token;
}

function b64url(s) {
  return btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlBytes(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function publishUrl(token, url) {
  const r = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url, type: "URL_UPDATED" }),
  });
  return { url, status: r.status, ok: r.ok, data: r.ok ? await r.json() : await r.text() };
}
