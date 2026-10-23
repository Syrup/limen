import { DOMAIN, TZ, portHost } from "./config.ts";
import { translator, type Lang } from "./i18n/index.ts";

const STYLES = `
:root{
  color-scheme:dark;
  --bg:#0d0f0e;
  --surface:#141716;
  --surface-2:#181c1a;
  --border:#262b29;
  --border-strong:#333a37;
  --text:#e8eae8;
  --muted:#97a19c;
  --muted-2:#8b958f;
  --accent:#a7d8c0;
  --danger:#f0b3b3;
  --danger-bg:#241617;
  --danger-border:#3a2425;
}
*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0;padding:24px;background:var(--bg);color:var(--text);
  font-family:"Satoshi",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased;
  display:flex;align-items:center;justify-content:center;
}
main{
  width:100%;max-width:400px;padding:28px;background:var(--surface);
  border:1px solid var(--border);border-radius:10px;
}
.masthead{display:flex;align-items:center;gap:12px}
.brand{display:flex;align-items:center;gap:10px;min-width:0;color:var(--muted);font-size:13px}
.mark{
  width:26px;height:26px;flex:none;display:grid;place-items:center;
  border:1px solid var(--border-strong);border-radius:7px;color:var(--muted);
}
.mark svg{width:13px;height:13px;display:block}
.wordmark{font-size:13px;letter-spacing:.02em;color:var(--text)}
.brand-domain{font-size:11px;letter-spacing:.01em;color:var(--muted-2);margin-left:-6px}
h1{margin:22px 0 8px;font-size:21px;line-height:1.25;font-weight:600;letter-spacing:-.01em}
.lead{margin:0;max-width:38ch;color:var(--muted);font-size:14px;line-height:1.65}
.target{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  margin-top:18px;padding:10px 12px;background:var(--surface-2);
  border:1px solid var(--border);border-radius:8px;
}
.target span{font-size:12px;color:var(--muted)}
.target code,.mono{
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-size:12px;overflow-wrap:anywhere;
}
button,.button-link{
  display:flex;align-items:center;justify-content:center;
  width:100%;height:44px;margin-top:20px;border-radius:8px;
  font:inherit;font-size:14px;font-weight:600;
}
button{
  border:1px solid transparent;background:var(--text);color:var(--bg);
  cursor:pointer;transition:background-color .12s ease,opacity .12s ease;
}
button:hover{background:#fff}
button:active{transform:translateY(1px)}
button:disabled{opacity:.55;cursor:not-allowed;transform:none}
button:focus-visible,.button-link:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.button-link{
  margin-top:20px;border:1px solid var(--border-strong);
  color:var(--text);text-decoration:none;font-weight:500;
}
.button-link:hover{background:var(--surface-2)}
.status{margin-top:12px;min-height:20px;font-size:12.5px;line-height:1.5;color:var(--muted)}
.status:empty{min-height:0;margin-top:0}
.status.error{color:var(--danger)}
.status.ok{color:var(--accent)}
.foot{margin-top:22px;padding-top:16px;border-top:1px solid var(--border);font-size:12px;line-height:1.65;color:var(--muted-2)}
.foot p{margin:0}
.foot p+p{margin-top:6px}
a{color:var(--muted);text-decoration:underline;text-underline-offset:2px}
a:hover{color:var(--text)}
.scope-list{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.scope-list a{
  display:inline-flex;align-items:center;height:30px;padding:0 10px;
  border:1px solid var(--border);border-radius:7px;text-decoration:none;
  color:var(--text);font-size:12.5px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
}
.scope-list a:hover{background:var(--surface-2)}
@media (max-width:420px){
  body{padding:20px}
  main{padding:22px}
  h1{font-size:20px}
}
@media (prefers-reduced-motion:reduce){
  *{transition:none!important}
  button:active{transform:none}
}
`;

export const MARK = `<span class="mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span>`;

export function page(lang: Lang, title: string, main: string, script = ""): string {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#0d0f0e">
<link rel="preload" href="/assets/fonts/satoshi-variable.woff2?v=2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/fonts.css?v=2">
<title>${title}</title>
<style>${STYLES}</style>
</head>
<body>
<main>
<header class="masthead">
  <div class="brand">${MARK}<span class="wordmark">Limen</span><span class="brand-domain">· ${DOMAIN}</span></div>
</header>
${main}
</main>
${script ? `<script type="module">${script}</script>` : ""}
</body>
</html>`;
}

function clientStrings(lang: Lang) {
  const t = translator(lang);
  return {
    preparing: t("client.preparing"),
    waiting: t("client.waiting"),
    verifying: t("client.verifying"),
    success: t("client.success"),
    registered: t("client.registered"),
    unsupported: t("client.unsupported"),
    lib: t("client.lib"),
    canceled: t("client.canceled"),
    security: t("client.security"),
    already: t("client.already"),
    network: t("client.network"),
    generic: t("client.generic"),
    rejected: t("client.rejected"),
    invalidLink: t("client.invalidLink"),
    verifyFailed: t("client.verifyFailed"),
  };
}

function loginScript(lang: Lang): string {
  return `
const T = ${JSON.stringify(clientStrings(lang))};
const btn = document.getElementById("btn");
const status = document.getElementById("status");
const target = document.getElementById("target");
const next = new URLSearchParams(location.search).get("next") || "/";

try { target.textContent = new URL(next, location.origin).host; } catch {}

function setStatus(text, kind) {
  status.textContent = text;
  status.className = "status" + (kind ? " " + kind : "");
}

async function loadWebauthn() {
  try {
    return await import("/assets/webauthn.js");
  } catch {
    throw new Error(T.lib);
  }
}

function pesan(e) {
  const n = e && e.name;
  if (n === "NotAllowedError") return T.canceled;
  if (n === "SecurityError") return T.security;
  if (n === "TypeError") return T.network;
  return (e && e.message) ? e.message : T.generic;
}

if (!window.PublicKeyCredential) {
  btn.disabled = true;
  setStatus(T.unsupported, "error");
} else {
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    setStatus(T.preparing);
    try {
      const { startAuthentication } = await loadWebauthn();
      const optRes = await fetch("/api/webauthn/login/options", { method: "POST" });
      if (!optRes.ok) {
        const d = await optRes.json().catch(() => null);
        throw new Error(d && d.error ? d.error : T.rejected);
      }
      const { options, challengeId } = await optRes.json();
      setStatus(T.waiting);
      const assertion = await startAuthentication({ optionsJSON: options });
      setStatus(T.verifying);
      const verRes = await fetch("/api/webauthn/login/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId, response: assertion, next }),
      });
      const data = await verRes.json().catch(() => ({}));
      if (!verRes.ok) throw new Error(data.error || T.verifyFailed);
      setStatus(T.success, "ok");
      location.href = data.redirect || next;
    } catch (e) {
      setStatus(pesan(e), "error");
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
    }
  });
}
`;
}

function registerScript(lang: Lang): string {
  return `
const T = ${JSON.stringify(clientStrings(lang))};
const btn = document.getElementById("btn");
const status = document.getElementById("status");
const token = new URLSearchParams(location.search).get("token") || "";

function setStatus(text, kind) {
  status.textContent = text;
  status.className = "status" + (kind ? " " + kind : "");
}

async function loadWebauthn() {
  try {
    return await import("/assets/webauthn.js");
  } catch {
    throw new Error(T.lib);
  }
}

function pesan(e) {
  const n = e && e.name;
  if (n === "NotAllowedError") return T.canceled;
  if (n === "InvalidStateError") return T.already;
  if (n === "SecurityError") return T.security;
  if (n === "TypeError") return T.network;
  return (e && e.message) ? e.message : T.generic;
}

if (!window.PublicKeyCredential) {
  btn.disabled = true;
  setStatus(T.unsupported, "error");
} else {
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    setStatus(T.preparing);
    try {
      const { startRegistration } = await loadWebauthn();
      const optRes = await fetch("/api/webauthn/register/options?token=" + encodeURIComponent(token), { method: "POST" });
      if (!optRes.ok) {
        const d = await optRes.json().catch(() => null);
        throw new Error(d && d.error ? d.error : T.invalidLink);
      }
      const { options, challengeId } = await optRes.json();
      setStatus(T.waiting);
      const att = await startRegistration({ optionsJSON: options });
      setStatus(T.verifying);
      const verRes = await fetch("/api/webauthn/register/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId, token, response: att }),
      });
      const data = await verRes.json().catch(() => ({}));
      if (!verRes.ok) throw new Error(data.error || T.verifyFailed);
      setStatus(T.registered, "ok");
      setTimeout(() => { location.href = "/login"; }, 1500);
    } catch (e) {
      setStatus(pesan(e), "error");
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
    }
  });
}
`;
}

export function renderLogin(lang: Lang): string {
  const t = translator(lang);
  return page(lang, t("titles.login"), `
<h1>${t("login.heading")}</h1>
<p class="lead">${t("login.lead")}</p>
<div class="target"><span>${t("login.target")}</span><code id="target">${DOMAIN}</code></div>
<button id="btn" type="button">${t("login.button")}</button>
<div class="status" id="status" role="status"></div>
<footer class="foot">
  <p>${t("login.note1")}</p>
  <p>${t("login.note2")}</p>
</footer>
`, loginScript(lang));
}

export function renderRegister(lang: Lang): string {
  const t = translator(lang);
  return page(lang, t("titles.register"), `
<h1>${t("register.heading")}</h1>
<p class="lead">${t("register.lead")}</p>
<button id="btn" type="button">${t("register.button")}</button>
<div class="status" id="status" role="status"></div>
<footer class="foot">
  <p>${t("register.note1")}</p>
  <p><a href="/login">${t("register.back")}</a></p>
</footer>
`, registerScript(lang));
}

export function renderSignedIn(lang: Lang): string {
  const t = translator(lang);
  return page(lang, t("titles.signedIn"), `
<h1>${t("signedIn.heading")}</h1>
<p class="lead">${t("signedIn.lead")}</p>
<a class="button-link" href="/logout">${t("signedIn.button")}</a>
`);
}

export function renderInviteInvalid(lang: Lang): string {
  const t = translator(lang);
  return page(lang, t("titles.invalidInvite"), `
<h1>${t("invalidInvite.heading")}</h1>
<p class="lead">${t("invalidInvite.lead")}</p>
<footer class="foot"><p><a href="/login">${t("invalidInvite.back")}</a></p></footer>
`);
}

export function renderAccessGranted(lang: Lang, scope: "all" | number[], expiresAt: string): string {
  const t = translator(lang);
  const until = new Date(expiresAt).toLocaleString(lang, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TZ,
  });
  const ports = scope === "all"
    ? `<p class="lead">${t("granted.scopeAll")}</p>`
    : `<div class="scope-list">${scope.map(p => `<a href="https://${portHost(p)}/">p${p}</a>`).join("")}</div>`;
  return page(lang, t("titles.granted"), `
<h1>${t("granted.heading")}</h1>
<p class="lead">${t("granted.lead")}</p>
<div class="target"><span>${t("granted.until")}</span><code>${until}</code></div>
${ports}
<a class="button-link" href="/logout">${t("granted.button")}</a>
`);
}

export function renderPortBlocked(lang: Lang, port: number): string {
  const t = translator(lang);
  return page(lang, t("titles.blocked"), `
<h1>${t("blocked.heading")}</h1>
<p class="lead">${t("blocked.lead")}</p>
<div class="target"><span>Port</span><code>${port}</code></div>
`);
}

export function renderPortDenied(lang: Lang, port: number, scope: number[]): string {
  const t = translator(lang);
  const list = scope.map(p => `<a href="https://${portHost(p)}/">p${p}</a>`).join("");
  return page(lang, t("titles.denied"), `
<h1>${t("denied.heading")}</h1>
<p class="lead">${t("denied.lead")}</p>
<div class="target"><span>Port</span><code>${port}</code></div>
${list ? `<div class="scope-list">${list}</div>` : ""}
<a class="button-link" href="/logout">${t("denied.button")}</a>
`);
}

