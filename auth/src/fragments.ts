import { translator, type Lang } from "./i18n/index.ts";
import {
  loadInvites,
  inviteState,
  inviteToken,
  loadBlockedPorts,
  listeningPorts,
  type Invite,
} from "./store.ts";
import { AUTH_ORIGIN, SYSTEM_PORTS, TZ } from "./config.ts";

const BASE_URL = AUTH_ORIGIN;

const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c] as string));

const BADGE: Record<string, string> = {
  active: "border-mint/40 bg-mint/10 text-mint",
  revoked: "border-danger/40 bg-danger/10 text-danger",
  expired: "border-line-strong text-faint",
  used: "border-line-strong text-faint",
};

function inviteUrl(invite: Invite): string {
  const path = invite.type === "access" ? "/access" : "/register";
  return `${BASE_URL}${path}?token=${inviteToken(invite)}`;
}

export function renderInvitesFragment(lang: Lang): string {
  const t = translator(lang);
  const locale = lang === "en" ? "en-US" : "id-ID";
  const invites = loadInvites().slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  if (invites.length === 0) {
    return `<div class="rounded-lg border border-dashed border-line px-6 py-8 text-center text-xs text-faint">${t("admin.empty")}</div>`;
  }

  const statusLabel: Record<string, string> = {
    active: t("admin.statusActive"),
    expired: t("admin.statusExpired"),
    revoked: t("admin.statusRevoked"),
    used: t("admin.statusUsed"),
  };

  const cards = invites.map((invite) => {
    const state = inviteState(invite);
    const url = inviteUrl(invite);
    const type = invite.type === "access" ? t("admin.typeAccessShort") : t("admin.typePasskeyShort");
    const scope = invite.scope === "all" ? t("admin.scopeAllShort") : invite.scope.map(p => `p${p}`).join(", ");
    const uses = invite.maxUses === null ? t("admin.uses", { count: invite.uses }) : `${invite.uses}/${invite.maxUses}`;
    const expires = new Date(invite.expiresAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short", timeZone: TZ });
    const label = invite.label || "-";
    const canRevoke = state === "active";

    return `<article class="rounded-lg border border-line bg-field/40 p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <strong class="truncate text-[13px] font-medium">${esc(label)}</strong>
            <span class="inline-flex h-5 items-center rounded-full border px-2 text-[11px] ${BADGE[state] || BADGE.expired}">${esc(statusLabel[state] || state)}</span>
          </div>
          <p class="mt-1 truncate font-mono text-[11.5px] text-muted" title="${esc(url)}">${esc(url.replace(/^https:\/\//, ""))}</p>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button type="button" data-url="${esc(url)}"
                  class="rounded-md border border-line px-2 py-1 text-[11.5px] text-muted transition-colors hover:border-line-strong hover:text-ink"
                  @click="navigator.clipboard.writeText($el.dataset.url).catch(() => {}); $dispatch('toast', { message: D.toastCopied, kind: 'ok' })">${t("admin.copy")}</button>
          ${canRevoke ? `<button type="button" data-url="/admin/invites/${invite.id}/revoke"
                  class="rounded-md border border-line px-2 py-1 text-[11.5px] text-muted transition-colors hover:border-danger/40 hover:text-danger"
                  x-data="{ armed: false, go() { if (!this.armed) { this.armed = true; setTimeout(() => { this.armed = false; }, 3000); return; } htmx.ajax('POST', $el.dataset.url, { target: '#invites', swap: 'innerHTML' }); } }"
                  @click="go()" x-text="armed ? D.revokeConfirm : D.revoke"></button>` : ""}
          <button type="button" data-url="/admin/invites/${invite.id}/delete"
                  class="rounded-md border border-line px-2 py-1 text-[11.5px] text-muted transition-colors hover:border-danger/40 hover:text-danger"
                  x-data="{ armed: false, go() { if (!this.armed) { this.armed = true; setTimeout(() => { this.armed = false; }, 3000); return; } htmx.ajax('POST', $el.dataset.url, { target: '#invites', swap: 'innerHTML' }); } }"
                  @click="go()" x-text="armed ? D.removeConfirm : D.remove"></button>
        </div>
      </div>
      <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11.5px] sm:grid-cols-4">
        <div><dt class="text-muted">${t("admin.thType")}</dt><dd class="mt-0.5">${esc(type)}</dd></div>
        <div><dt class="text-muted">${t("admin.thScope")}</dt><dd class="mt-0.5">${esc(scope)}</dd></div>
        <div><dt class="text-muted">${t("admin.thExpires")}</dt><dd class="mt-0.5">${esc(expires)}</dd></div>
        <div><dt class="text-muted">${t("admin.thUses")}</dt><dd class="mt-0.5">${esc(uses)}</dd></div>
      </dl>
    </article>`;
  }).join("");

  return `<div class="space-y-2.5">${cards}</div>`;
}

export function renderPortsFragment(lang: Lang): string {
  const t = translator(lang);
  const blocked = loadBlockedPorts();
  const listening = new Set(listeningPorts());
  const ports = [...new Set([...listening, ...blocked])].sort((a, b) => a - b);

  if (ports.length === 0) {
    return `<p class="py-2 text-xs text-faint">-</p>`;
  }

  const rows = ports.map((port) => {
    const isSystem = SYSTEM_PORTS.has(port);
    const allowed = !blocked.has(port);
    const meta = `${listening.has(port) ? t("admin.listening") : t("admin.notListening")}${isSystem ? " · " + t("admin.system") : ""}`;
    const badge = isSystem
      ? `<span class="inline-flex h-5 items-center rounded-full border border-line-strong px-2 text-[11px] text-faint">${t("admin.system")}</span>`
      : `<span class="inline-flex h-5 items-center rounded-full border px-2 text-[11px] ${allowed ? "border-mint/40 bg-mint/10 text-mint" : "border-danger/40 bg-danger/10 text-danger"}">${allowed ? t("admin.allowed") : t("admin.blockedLabel")}</span>`;
    const toggle = isSystem
      ? ""
      : `<button type="button" role="switch" aria-checked="${allowed}" aria-label="p${port}"
                 hx-post="/admin/ports" hx-vals='{"port":${port},"blocked":${allowed}}' hx-target="#ports" hx-swap="innerHTML"
                 class="relative h-5 w-[34px] rounded-full border transition-colors ${allowed ? "border-mint/50 bg-mint/20" : "border-line-strong bg-field"}">
           <span class="absolute left-[2px] top-[2px] h-3.5 w-3.5 rounded-full transition-transform ${allowed ? "translate-x-3.5 bg-mint" : "bg-faint"}"></span>
         </button>`;

    return `<li class="flex items-center justify-between gap-3 py-2.5">
      <div>
        <span class="font-mono text-xs">p${port}</span>
        <span class="mt-0.5 block text-[11.5px] text-muted">${esc(meta)}</span>
      </div>
      <div class="flex items-center gap-2">${badge}${toggle}</div>
    </li>`;
  }).join("");

  return `<ul class="divide-y divide-line">${rows}</ul>`;
}
