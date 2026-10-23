import { translator, type Lang } from "./i18n/index.ts";
import { DOMAIN } from "./config.ts";

const MARK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-[13px] w-[13px]"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>`;

const CLIENT_KEYS = [
  "typeAccessHelp", "typePasskeyHelp", "toastCopied",
  "revoke", "revokeConfirm", "remove", "removeConfirm",
] as const;

export function renderAdmin(lang: Lang): string {
  const t = translator(lang);
  const clientDict = Object.fromEntries(CLIENT_KEYS.map(key => [key, t(`admin.${key}`)]));
  const unitLabels = {
    minutes: t("admin.units.minutes"),
    hours: t("admin.units.hours"),
    days: t("admin.units.days"),
    weeks: t("admin.units.weeks"),
    months: t("admin.units.months"),
  };
  const units = (["minutes", "hours", "days", "weeks", "months"] as const)
    .map(u => `<option value="${u}"${u === "hours" ? " selected" : ""}>${unitLabels[u]}</option>`)
    .join("");

  return `<!doctype html>
<html lang="${lang}" class="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#0d0f0e">
<title>${t("titles.admin")}</title>
<link rel="stylesheet" href="/assets/app.css">
<script defer src="/assets/vendor.js"></script>
</head>
<body class="min-h-screen bg-canvas font-sans text-ink antialiased">
<div class="mx-auto w-full max-w-[1080px] px-6 py-10" x-data="dashboard()" @toast.window="notify($event.detail)">

  <header class="flex items-center justify-between gap-4">
    <div class="flex items-center gap-2.5 text-[13px] tracking-wide">
      <span class="grid h-[26px] w-[26px] place-items-center rounded-[7px] border border-line-strong text-muted">${MARK}</span>
      Limen
      <span class="-ml-1 text-[11px] text-faint">· ${DOMAIN}</span>
    </div>
    <a href="/logout" class="text-xs text-muted underline underline-offset-2 hover:text-ink">${t("admin.logout")}</a>
  </header>

  <div class="mt-10 max-w-[560px]">
    <h1 class="text-3xl font-semibold tracking-tight">${t("admin.title")}</h1>
    <p class="mt-1.5 text-sm text-muted">${t("admin.lead")}</p>
  </div>

  <div class="mt-7 grid items-start gap-5 lg:grid-cols-[1.4fr_1fr]">

    <section class="rounded-[10px] border border-line bg-panel p-[22px]" x-data="{ type: 'access', scope: 'all' }">
      <h2 class="text-[15px] font-semibold">${t("admin.createHeading")}</h2>
      <p class="mt-1 text-xs leading-relaxed text-muted" x-text="type === 'access' ? D.typeAccessHelp : D.typePasskeyHelp"></p>

      <form class="mt-4 space-y-3"
            hx-post="/admin/invites" hx-target="#invites" hx-swap="innerHTML"
            hx-on::after-request="if (event.detail.successful) { this.querySelector('[name=label]').value = ''; }">

        <div class="grid grid-cols-2 overflow-hidden rounded-lg border border-line">
          <label class="cursor-pointer">
            <input type="radio" name="type" value="access" x-model="type" class="peer sr-only" checked>
            <span class="block px-2.5 py-2 text-center text-xs text-muted peer-checked:bg-ink peer-checked:font-semibold peer-checked:text-canvas">${t("admin.typeAccess")}</span>
          </label>
          <label class="cursor-pointer border-l border-line">
            <input type="radio" name="type" value="passkey" x-model="type" class="peer sr-only">
            <span class="block px-2.5 py-2 text-center text-xs text-muted peer-checked:bg-ink peer-checked:font-semibold peer-checked:text-canvas">${t("admin.typePasskey")}</span>
          </label>
        </div>

        <label class="block text-xs text-muted">${t("admin.label")}
          <input name="label" maxlength="60" autocomplete="off" placeholder="${t("admin.labelPlaceholder")}"
                 class="mt-1 h-10 w-full rounded-lg border border-line bg-field px-3 text-[13px] text-ink placeholder:text-[#6f7a74] focus:border-line-strong focus:outline-none focus:ring-2 focus:ring-mint/20">
        </label>

        <div class="grid grid-cols-2 gap-2.5">
          <label class="block text-xs text-muted">${t("admin.duration")}
            <input name="amount" type="number" min="1" max="525600" value="24" required inputmode="numeric"
                   class="mt-1 h-10 w-full rounded-lg border border-line bg-field px-3 text-[13px] text-ink focus:border-line-strong focus:outline-none focus:ring-2 focus:ring-mint/20">
          </label>
          <label class="block text-xs text-muted">${t("admin.unit")}
            <select name="unit" class="mt-1 h-10 w-full rounded-lg border border-line bg-field px-3 text-[13px] text-ink focus:border-line-strong focus:outline-none focus:ring-2 focus:ring-mint/20">${units}</select>
          </label>
        </div>

        <div x-show="type === 'access'" x-cloak>
          <span class="block text-xs text-muted">${t("admin.scope")}</span>
          <label class="mt-1.5 flex items-center gap-2 text-[13px]">
            <input type="radio" name="scope" value="all" x-model="scope" class="accent-mint" checked> ${t("admin.scopeAll")}
          </label>
          <label class="mt-1 flex items-center gap-2 text-[13px]">
            <input type="radio" name="scope" value="list" x-model="scope" class="accent-mint"> ${t("admin.scopeList")}
          </label>
          <input name="ports" placeholder="${t("admin.portsPlaceholder")}" inputmode="numeric" :disabled="scope !== 'list'"
                 class="mt-2 h-10 w-full rounded-lg border border-line bg-field px-3 font-mono text-[12.5px] text-ink placeholder:text-[#6f7a74] disabled:opacity-45 focus:border-line-strong focus:outline-none focus:ring-2 focus:ring-mint/20">
        </div>

        <button class="h-10 w-full rounded-lg bg-ink text-[13.5px] font-semibold text-canvas transition-colors hover:bg-white">${t("admin.create")}</button>
        <p class="text-[11.5px] text-faint">${t("admin.maxHint")}</p>
      </form>
    </section>

    <section class="rounded-[10px] border border-line bg-panel p-[22px]">
      <h2 class="text-[15px] font-semibold">${t("admin.portsHeading")}</h2>
      <p class="mt-1 text-xs leading-relaxed text-muted">${t("admin.portsLead")}</p>

      <div id="ports" hx-get="/fragments/ports" hx-trigger="load" hx-swap="innerHTML" class="mt-2 max-h-[340px] overflow-y-auto pr-1">
        <p class="py-2 text-xs text-faint">...</p>
      </div>

      <form class="mt-3 flex gap-2" hx-post="/admin/ports" hx-target="#ports" hx-swap="innerHTML"
            hx-on::after-request="if (event.detail.successful) this.reset()">
        <input name="port" type="number" min="1" max="65535" required inputmode="numeric" placeholder="${t("admin.portInput")}"
               class="h-10 min-w-0 flex-1 rounded-lg border border-line bg-field px-3 text-[13px] text-ink placeholder:text-[#6f7a74] focus:border-line-strong focus:outline-none focus:ring-2 focus:ring-mint/20">
        <input type="hidden" name="blocked" value="true">
        <button class="h-10 rounded-lg border border-line-strong px-3.5 text-xs text-ink transition-colors hover:bg-field">${t("admin.block")}</button>
      </form>
    </section>
  </div>

  <section class="mt-5 rounded-[10px] border border-line bg-panel p-[22px]">
    <h2 class="text-[15px] font-semibold">${t("admin.linksHeading")}</h2>
    <div id="invites" hx-get="/fragments/invites" hx-trigger="load" hx-swap="innerHTML" class="mt-3">
      <p class="py-2 text-xs text-faint">...</p>
    </div>
  </section>

  <div x-show="toast" x-cloak x-transition.opacity
       class="fixed bottom-6 left-1/2 z-10 max-w-[calc(100vw-48px)] -translate-x-1/2 rounded-lg border border-line-strong bg-panel px-3.5 py-2.5 text-xs shadow-[0_8px_24px_rgba(0,0,0,.35)]"
       :class="kind === 'error' ? 'border-danger/40 text-danger' : 'text-ink'" x-text="toast"></div>
</div>

<script>window.__DICT__ = ${JSON.stringify(clientDict)}; window.D = window.__DICT__;</script>
<script>
function dashboard() {
  return {
    toast: "",
    kind: "ok",
    timer: null,
    type: "access",
    notify(detail) {
      this.toast = (detail && detail.message) || "";
      this.kind = (detail && detail.kind) || "ok";
      clearTimeout(this.timer);
      this.timer = setTimeout(() => { this.toast = ""; }, 4000);
    },
  };
}
</script>
</body>
</html>`;
}
