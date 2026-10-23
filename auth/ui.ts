import { DOMAIN, TZ, portHost } from "./config.ts";

export type Lang = "id" | "en";
export const UI = {
  id: {
    htmlLang: "id",
    titles: {
      login: "Masuk - Limen",
      register: "Daftarkan passkey - Limen",
      signedIn: "Sudah masuk - Limen",
      invalidInvite: "Tautan undangan tidak valid - Limen",
      granted: "Akses aktif - Limen",
      blocked: "Port tidak tersedia - Limen",
      denied: "Port di luar akses - Limen",
      admin: "Dashboard - Limen",
    },
    login: {
      heading: "Masuk",
      lead: "Gunakan passkey di perangkat ini untuk melanjutkan. Tidak ada kata sandi yang perlu diisi.",
      target: "Tujuan",
      button: "Masuk dengan passkey",
      note1: "Sesi berlaku 24 jam sejak login.",
      note2: "Belum punya passkey? Minta tautan undangan ke pemilik server.",
    },
    register: {
      heading: "Daftarkan passkey",
      lead: "Tautan ini hanya bisa dipakai sekali. Setelah passkey terdaftar, tautan langsung tidak berlaku.",
      button: "Daftarkan passkey",
      note1: "Gunakan perangkat yang ingin kamu beri akses. Passkey disimpan di perangkat, bukan di server.",
      back: "Kembali ke halaman masuk",
    },
    signedIn: {
      heading: "Sudah masuk",
      lead: "Sesi aktif di browser ini. Kamu bisa menutup tab atau keluar sekarang.",
      button: "Keluar",
    },
    invalidInvite: {
      heading: "Tautan undangan tidak valid",
      lead: "Tautan sudah dipakai, dicabut, atau kedaluwarsa. Minta tautan baru ke pemilik server.",
      back: "Kembali ke halaman masuk",
    },
    granted: {
      heading: "Akses aktif",
      lead: "Sesi tamu sudah dibuat di browser ini. Kamu bisa membuka port yang tercantum sampai masa akses berakhir.",
      until: "Berlaku sampai",
      scopeAll: "Semua port",
      scopeSome: "Port yang bisa dibuka",
      button: "Keluar",
    },
    blocked: {
      heading: "Port ini tidak tersedia",
      lead: "Port ini tidak diforward saat ini. Hubungi orang yang memberi tautan kalau kamu butuh akses.",
    },
    denied: {
      heading: "Port ini di luar aksesmu",
      lead: "Akses sementara ini hanya berlaku untuk port tertentu. Minta tautan baru kalau perlu port lain.",
      button: "Keluar",
    },
    admin: {
      title: "Dashboard",
      lead: "Kelola akses sementara, passkey, dan port yang diforward.",
      logout: "Keluar",
      createHeading: "Buat invite",
      typeAccess: "Akses sementara",
      typePasskey: "Passkey",
      typeAccessHelp: "Tautan memberi akses sementara ke port yang dipilih. Bisa dipakai berkali-kali sampai dicabut atau kedaluwarsa.",
      typePasskeyHelp: "Tautan untuk mendaftarkan passkey baru bagi akun pemilik. Sekali pakai.",
      label: "Label",
      labelPlaceholder: "Misal: tim desain",
      duration: "Durasi",
      unit: "Satuan",
      units: { minutes: "Menit", hours: "Jam", days: "Hari", weeks: "Minggu", months: "Bulan" },
      scope: "Cakupan port",
      scopeAll: "Semua port",
      scopeList: "Port tertentu",
      portsPlaceholder: "4322, 4323",
      create: "Buat tautan",
      maxHint: "Maksimum 12 bulan. Tidak ada opsi selamanya.",
      portsHeading: "Port",
      portsLead: "Matikan port yang tidak ingin diforward.",
      portInput: "Port",
      block: "Blokir",
      system: "Sistem",
      listening: "Aktif",
      notListening: "Tidak aktif",
      allowed: "Diizinkan",
      blockedLabel: "Diblokir",
      linksHeading: "Tautan",
      empty: "Belum ada tautan. Buat satu dari panel di atas.",
      thLabel: "Label",
      thType: "Tipe",
      thScope: "Cakupan",
      thExpires: "Berlaku",
      thUses: "Dipakai",
      thStatus: "Status",
      thActions: "Aksi",
      typeAccessShort: "Akses",
      typePasskeyShort: "Passkey",
      scopeAllShort: "Semua port",
      statusActive: "Aktif",
      statusExpired: "Kedaluwarsa",
      statusRevoked: "Dicabut",
      statusUsed: "Terpakai",
      copy: "Salin",
      copied: "Tersalin",
      revoke: "Cabut",
      revokeConfirm: "Yakin?",
      remove: "Hapus",
      removeConfirm: "Hapus?",
      usesUnit: "kali",
      never: "Tidak ada",
      toastCreated: "Tautan dibuat.",
      toastCopied: "Tautan disalin.",
      toastRevoked: "Tautan dicabut.",
      toastDeleted: "Tautan dihapus.",
      toastPortOn: "Port diizinkan kembali.",
      toastPortOff: "Port diblokir.",
      errLoad: "Gagal memuat data.",
      errCreate: "Gagal membuat tautan.",
      errPorts: "Daftar port tidak valid.",
      errDuration: "Durasi harus antara 1 menit dan 12 bulan.",
      errPort: "Port tidak valid.",
      errSystem: "Port sistem tidak bisa dimatikan.",
      remainingDays: "hari",
      remainingHours: "jam",
      remainingMinutes: "menit",
      expired: "Kedaluwarsa",
    },
    client: {
      preparing: "Menyiapkan permintaan...",
      waiting: "Menunggu konfirmasi perangkat...",
      verifying: "Memverifikasi...",
      success: "Berhasil. Mengalihkan...",
      registered: "Passkey terdaftar. Mengalihkan ke halaman masuk...",
      unsupported: "Browser ini tidak mendukung passkey.",
      lib: "Pustaka passkey gagal dimuat. Muat ulang halaman ini.",
      canceled: "Permintaan dibatalkan atau waktu habis. Coba lagi.",
      security: "Alamat ini tidak cocok dengan passkey yang terdaftar.",
      already: "Passkey ini sudah terdaftar di perangkat.",
      network: "Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.",
      generic: "Terjadi kesalahan. Coba lagi.",
      rejected: "Server menolak permintaan.",
      invalidLink: "Tautan undangan tidak berlaku.",
      verifyFailed: "Verifikasi gagal.",
    },
    api: {
      rateLimited: "Terlalu banyak percobaan. Coba lagi sebentar.",
      inviteInvalid: "Tautan undangan tidak valid atau kedaluwarsa.",
      challengeInvalid: "Sesi verifikasi tidak valid atau kedaluwarsa. Coba lagi.",
      originDenied: "Alamat asal tidak diizinkan.",
      verifyFailed: "Verifikasi gagal.",
      noPasskey: "Belum ada passkey terdaftar.",
      credNotFound: "Passkey tidak dikenali.",
      invalidDuration: "Durasi harus antara 1 menit dan 12 bulan.",
      invalidScope: "Cakupan port tidak valid.",
      invalidPort: "Port tidak valid.",
      systemPort: "Port sistem tidak bisa dimatikan.",
    },
  },
  en: {
    htmlLang: "en-US",
    titles: {
      login: "Sign in - Limen",
      register: "Register passkey - Limen",
      signedIn: "Signed in - Limen",
      invalidInvite: "Invalid invite link - Limen",
      granted: "Access granted - Limen",
      blocked: "Port unavailable - Limen",
      denied: "Port outside your access - Limen",
      admin: "Dashboard - Limen",
    },
    login: {
      heading: "Sign in",
      lead: "Use the passkey on this device to continue. There is no password to enter.",
      target: "Destination",
      button: "Sign in with passkey",
      note1: "Sessions last 24 hours from sign-in.",
      note2: "No passkey yet? Ask the server owner for an invite link.",
    },
    register: {
      heading: "Register a passkey",
      lead: "This link works once. After the passkey is registered, the link stops working.",
      button: "Register passkey",
      note1: "Use the device you want to grant access to. The passkey stays on the device, not on the server.",
      back: "Back to sign in",
    },
    signedIn: {
      heading: "Signed in",
      lead: "This browser has an active session. You can close the tab or sign out now.",
      button: "Sign out",
    },
    invalidInvite: {
      heading: "Invite link is invalid",
      lead: "The link was used, revoked, or has expired. Ask the server owner for a new one.",
      back: "Back to sign in",
    },
    granted: {
      heading: "Access granted",
      lead: "A guest session is active in this browser. Open the listed ports until the access period ends.",
      until: "Valid until",
      scopeAll: "All ports",
      scopeSome: "Ports you can open",
      button: "Sign out",
    },
    blocked: {
      heading: "This port is unavailable",
      lead: "This port is not being forwarded right now. Contact the person who gave you the link if you need access.",
    },
    denied: {
      heading: "This port is outside your access",
      lead: "This temporary access only covers specific ports. Ask for a new link if you need another port.",
      button: "Sign out",
    },
    admin: {
      title: "Dashboard",
      lead: "Manage temporary access, passkeys, and forwarded ports.",
      logout: "Sign out",
      createHeading: "Create invite",
      typeAccess: "Temporary access",
      typePasskey: "Passkey",
      typeAccessHelp: "The link grants temporary access to the chosen ports. It can be reused until revoked or expired.",
      typePasskeyHelp: "The link registers a new passkey for the owner account. Single use.",
      label: "Label",
      labelPlaceholder: "For example: design team",
      duration: "Duration",
      unit: "Unit",
      units: { minutes: "Minutes", hours: "Hours", days: "Days", weeks: "Weeks", months: "Months" },
      scope: "Port scope",
      scopeAll: "All ports",
      scopeList: "Specific ports",
      portsPlaceholder: "4322, 4323",
      create: "Create link",
      maxHint: "Maximum 12 months. There is no forever option.",
      portsHeading: "Ports",
      portsLead: "Turn off ports that should not be forwarded.",
      portInput: "Port",
      block: "Block",
      system: "System",
      listening: "Listening",
      notListening: "Not listening",
      allowed: "Allowed",
      blockedLabel: "Blocked",
      linksHeading: "Links",
      empty: "No links yet. Create one from the panel above.",
      thLabel: "Label",
      thType: "Type",
      thScope: "Scope",
      thExpires: "Expires",
      thUses: "Uses",
      thStatus: "Status",
      thActions: "Actions",
      typeAccessShort: "Access",
      typePasskeyShort: "Passkey",
      scopeAllShort: "All ports",
      statusActive: "Active",
      statusExpired: "Expired",
      statusRevoked: "Revoked",
      statusUsed: "Used",
      copy: "Copy",
      copied: "Copied",
      revoke: "Revoke",
      revokeConfirm: "Sure?",
      remove: "Delete",
      removeConfirm: "Delete?",
      usesUnit: "times",
      never: "None",
      toastCreated: "Link created.",
      toastCopied: "Link copied.",
      toastRevoked: "Link revoked.",
      toastDeleted: "Link deleted.",
      toastPortOn: "Port allowed again.",
      toastPortOff: "Port blocked.",
      errLoad: "Could not load data.",
      errCreate: "Could not create the link.",
      errPorts: "The port list is invalid.",
      errDuration: "Duration must be between 1 minute and 12 months.",
      errPort: "Invalid port.",
      errSystem: "System ports cannot be disabled.",
      remainingDays: "days",
      remainingHours: "hours",
      remainingMinutes: "minutes",
      expired: "Expired",
    },
    client: {
      preparing: "Preparing request...",
      waiting: "Waiting for device confirmation...",
      verifying: "Verifying...",
      success: "Success. Redirecting...",
      registered: "Passkey registered. Redirecting to sign in...",
      unsupported: "This browser does not support passkeys.",
      lib: "The passkey library failed to load. Reload this page.",
      canceled: "The request was cancelled or timed out. Try again.",
      security: "This address does not match the registered passkey.",
      already: "This passkey is already registered on the device.",
      network: "Cannot reach the server. Check your connection and try again.",
      generic: "Something went wrong. Try again.",
      rejected: "The server rejected the request.",
      invalidLink: "The invite link is not valid.",
      verifyFailed: "Verification failed.",
    },
    api: {
      rateLimited: "Too many attempts. Try again shortly.",
      inviteInvalid: "The invite link is invalid or has expired.",
      challengeInvalid: "The verification session is invalid or has expired. Try again.",
      originDenied: "The request origin is not allowed.",
      verifyFailed: "Verification failed.",
      noPasskey: "No passkey is registered yet.",
      credNotFound: "Passkey not recognised.",
      invalidDuration: "Duration must be between 1 minute and 12 months.",
      invalidScope: "The port scope is invalid.",
      invalidPort: "Invalid port.",
      systemPort: "System ports cannot be disabled.",
    },
  },
} as const;

export type Dict = (typeof UI)[Lang];

/** Pilih bahasa dari Accept-Language. Inggris hanya jika diminta eksplisit. */
export function resolveLang(req: Request): Lang {
  const header = req.headers.get("accept-language") || "";
  const entries = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.map(p => p.trim()).find(p => p.startsWith("q="));
      const q = qParam ? Number(qParam.slice(2)) : 1;
      return { tag: tag.toLowerCase(), q: Number.isFinite(q) ? q : 0, index };
    })
    .filter(entry => entry.tag !== "");

  entries.sort((a, b) => b.q - a.q || a.index - b.index);

  for (const entry of entries) {
    if (entry.tag === "id" || entry.tag.startsWith("id-")) return "id";
    if (entry.tag === "en" || entry.tag.startsWith("en-")) return "en";
  }
  return "id";
}

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
<html lang="${UI[lang].htmlLang}">
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

function loginScript(lang: Lang): string {
  return `
const T = ${JSON.stringify(UI[lang].client)};
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
const T = ${JSON.stringify(UI[lang].client)};
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
  const c = UI[lang];
  return page(lang, c.titles.login, `
<h1>${c.login.heading}</h1>
<p class="lead">${c.login.lead}</p>
<div class="target"><span>${c.login.target}</span><code id="target">${DOMAIN}</code></div>
<button id="btn" type="button">${c.login.button}</button>
<div class="status" id="status" role="status"></div>
<footer class="foot">
  <p>${c.login.note1}</p>
  <p>${c.login.note2}</p>
</footer>
`, loginScript(lang));
}

export function renderRegister(lang: Lang): string {
  const c = UI[lang];
  return page(lang, c.titles.register, `
<h1>${c.register.heading}</h1>
<p class="lead">${c.register.lead}</p>
<button id="btn" type="button">${c.register.button}</button>
<div class="status" id="status" role="status"></div>
<footer class="foot">
  <p>${c.register.note1}</p>
  <p><a href="/login">${c.register.back}</a></p>
</footer>
`, registerScript(lang));
}

export function renderSignedIn(lang: Lang): string {
  const c = UI[lang];
  return page(lang, c.titles.signedIn, `
<h1>${c.signedIn.heading}</h1>
<p class="lead">${c.signedIn.lead}</p>
<a class="button-link" href="/logout">${c.signedIn.button}</a>
`);
}

export function renderInviteInvalid(lang: Lang): string {
  const c = UI[lang];
  return page(lang, c.titles.invalidInvite, `
<h1>${c.invalidInvite.heading}</h1>
<p class="lead">${c.invalidInvite.lead}</p>
<footer class="foot"><p><a href="/login">${c.invalidInvite.back}</a></p></footer>
`);
}

export function renderAccessGranted(lang: Lang, scope: "all" | number[], expiresAt: string): string {
  const c = UI[lang];
  const until = new Date(expiresAt).toLocaleString(lang === "en" ? "en-US" : "id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TZ,
  });
  const ports = scope === "all"
    ? `<p class="lead">${c.granted.scopeAll}</p>`
    : `<div class="scope-list">${scope.map(p => `<a href="https://${portHost(p)}/">p${p}</a>`).join("")}</div>`;
  return page(lang, c.titles.granted, `
<h1>${c.granted.heading}</h1>
<p class="lead">${c.granted.lead}</p>
<div class="target"><span>${c.granted.until}</span><code>${until}</code></div>
${ports}
<a class="button-link" href="/logout">${c.granted.button}</a>
`);
}

export function renderPortBlocked(lang: Lang, port: number): string {
  const c = UI[lang];
  return page(lang, c.titles.blocked, `
<h1>${c.blocked.heading}</h1>
<p class="lead">${c.blocked.lead}</p>
<div class="target"><span>Port</span><code>${port}</code></div>
`);
}

export function renderPortDenied(lang: Lang, port: number, scope: number[]): string {
  const c = UI[lang];
  const list = scope.map(p => `<a href="https://${portHost(p)}/">p${p}</a>`).join("");
  return page(lang, c.titles.denied, `
<h1>${c.denied.heading}</h1>
<p class="lead">${c.denied.lead}</p>
<div class="target"><span>Port</span><code>${port}</code></div>
${list ? `<div class="scope-list">${list}</div>` : ""}
<a class="button-link" href="/logout">${c.denied.button}</a>
`);
}

