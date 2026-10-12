// Interface : mode Vitrine (acheteur / vendeur) et mode Atelier (designer). Mobile d'abord.
import { t } from './i18n.js';
import { FEATURES } from '../config/features.js';
import { CHANGELOG, CURRENT_VERSION, unseenEntries } from '../config/changelog.js';
import { LANG } from './i18n.js';
import theme, { brandHTML } from '../config/theme.js';
import { gemIconUrl } from '../materials/gemicon.js';
import { METALS, FINISHES, GEMS, GEM_GROUPS, CUSTOM, byId, describeAssignment, swatchOf, hexToHsl, hslToHex, validHex } from '../materials/library.js';
import { ENVIRONMENTS } from '../core/environments.js';
import { renderThumbnails } from '../materials/thumbnails.js';
import { prefs, buildShareUrl } from '../state/store.js';
import { exportProjectGLB, download, shareOrDownload, recapRows, withoutHighlight } from '../export/exporters.js';
import { prepareAR, buildARLauncher, qrDataUrl, isMobile, isChromeIOS } from '../ar/ar.js';
import { TryOn } from '../tryon/tryon.js';
import { frenchRingSize } from '../import/zones.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, root = document) => root.querySelector(sel);

const BG = { light: '#e9e0d0', dark: '#16140f', transparent: null };

// Icônes au trait (cohérentes, sans emoji)
const ic = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  views: ic('<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/>'),
  light: ic('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z"/>'),
  rotate: ic('<path d="M20 12a8 8 0 1 1-2.7-6"/><path d="M20 4.5V9h-4.5"/>'),
  fullExit: ic('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
  full: ic('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  undo: ic('<path d="M9 14 4 9l5-5"/><path d="M4 9h9a6 6 0 0 1 0 12h-3"/>'),
  redo: ic('<path d="m15 14 5-5-5-5"/><path d="M20 9h-9a6 6 0 0 0 0 12h3"/>'),
  sun: ic('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: ic('<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>'),
  eye: ic('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff: ic('<path d="M2 12s3.6-6.5 10-6.5c2 0 3.7.6 5.1 1.5M22 12s-3.6 6.5-10 6.5c-2 0-3.7-.6-5.1-1.5M4 4l16 16"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
  explode: ic('<rect x="9" y="9" width="6" height="6" rx="1"/><path d="M12 3v3M10.5 4.5 12 3l1.5 1.5M12 21v-3M10.5 19.5 12 21l1.5-1.5M3 12h3M4.5 10.5 3 12l1.5 1.5M21 12h-3M19.5 10.5 21 12l-1.5 1.5"/>'),
  open: ic('<path d="M12 16V4M7.5 8.5 12 4l4.5 4.5"/><path d="M5 20h14"/>'),
};
const CHEV = ic('<path d="m6 9 6 6 6-6"/>').replace('class=""','').replace('<svg ','<svg class="chev" ');
const MORE = ic('<circle cx="5" cy="12" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="19" cy="12" r="1.1"/>');
const MARK = `<svg class="mark" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 4h11L22 9.5 12 21 2 9.5z"/><path d="M2 9.5h20M9 4 7.5 9.5 12 21l4.5-11.5L15 4"/></svg>`;

export class UI {
  constructor(root, app, services) {
    this.root = root;
    this.app = app;
    this.svc = services; // { openFile(file), reimport(patch) }
    const saved = prefs.get('mode', 'vitrine');
    this.mode = 'vitrine'; // le mode Atelier a été retiré
    this.locked = false; // lien client : l'interface ne peut pas quitter le mode client
    this.customHex = { metal: '#d8b45a', gem: '#4a7de0' };
    this.tab = 'metals';
    this.acc = { zones: false, mat: true, custom: false }; // accordéons de la feuille matière
    this.thumbs = { metals: {}, finishes: {}, gems: {} };
    this.bg = 'light';
    this.build();
    this.bind();
    this.renderAll();
    this.tryon = new TryOn(app, $('.viewport', root), { toast: (m) => this.toast(m) });
  }

  // ---------- Squelette ----------
  build() {
    this.root.innerHTML = `
    <div class="app" data-mode="${this.mode}">
      <header class="topbar">
        <div class="brand">${brandHTML(MARK)}</div>
        <div class="spacer"></div>
        <button class="icon-btn theme-btn" data-a="theme" aria-label="${t('theme')}" title="${t('theme')}"><span class="i-sun">${ICON.sun}</span><span class="i-moon">${ICON.moon}</span></button>
        <div class="seg" role="group" aria-label="Mode">
          <button data-mode="client">${t('modeClient')}</button>
          <button data-mode="vitrine">${t('modeVitrine')}</button>
        </div>
        <button class="btn small client-exit" data-a="exit-client">${t('exitPreview')}</button>
      </header>
      <main class="main">
        <section class="viewport" id="viewport">
          <div class="viewer-mount"></div>
          <div class="hud-chip" data-r="info"></div>
          <div class="hud-right">
            <button class="icon-btn" ${FEATURES.viewAngles ? '' : 'hidden'} data-pop-btn="views" aria-label="${t('views')}" title="${t('views')}">${ICON.views}</button>
            <button class="icon-btn" ${FEATURES.lighting ? '' : 'hidden'} data-pop-btn="env" aria-label="${t('environment')}" title="${t('environment')}">${ICON.light}</button>
            <button class="icon-btn" data-a="explode" aria-pressed="false" aria-label="${t('explode')}" title="${t('explode')}">${ICON.explode}</button>
            <button class="icon-btn" ${FEATURES.autoRotate ? '' : 'hidden'} data-a="autorotate" aria-pressed="false" aria-label="${t('autoRotate')}" title="${t('autoRotate')}">${ICON.rotate}</button>
            <button class="icon-btn" data-a="present" aria-pressed="false" aria-label="${t('present')}" title="${t('present')}"><span class="i-full">${ICON.full}</span><span class="i-exit">${ICON.fullExit}</span></button>
          </div>
          <div class="dock">
            <button class="icon-btn" data-a="undo" aria-label="${t('undo')}" title="${t('undo')}">${ICON.undo}</button>
            <button class="icon-btn" data-a="redo" aria-label="${t('redo')}" title="${t('redo')}">${ICON.redo}</button>
            <button class="icon-btn" data-a="open" aria-label="${t('open')}" title="${t('open')}">${ICON.open}</button>
          </div>
          <div class="pop" data-pop="views" hidden></div>
          <div class="pop" data-pop="env" hidden></div>
          <div class="hint" data-r="hint">${t('tapHint')}</div>
          <div class="drop" hidden>${t('dropHere')}</div>
          <div class="progress" hidden><div class="bar"><i></i></div><span></span></div>
        </section>
        <aside class="panel">
          <div class="parts" data-r="parts"></div>
          <div class="mats" data-r="mats"></div>
          <div class="p-section atelier-only" data-r="atelier"></div>
          <nav class="actions" aria-label="Actions">
            <button class="btn primary" data-a="tryon">${t('tryon')}</button>
            <button class="btn" data-a="ar">${t('ar')}</button>
            <button class="btn" data-a="photo">${t('photo')}</button>
            <button class="btn more-btn" data-a="more" aria-label="${t('more')}" title="${t('more')}">${MORE}</button>
          </nav>
        </aside>
      </main>
      <input type="file" id="file" hidden>
      <dialog id="dlg"><div class="dlg-h"><h2></h2><button class="icon-btn" data-a="dlg-close" aria-label="${t('close')}">✕</button></div><div class="dlg-b"></div></dialog>
      <div class="tooltip" hidden></div>
    </div>`;
    this.el = $('.app', this.root);
    this.viewport = $('.viewport', this.root);
    // Le viewer vit dans .viewer-mount (ré-attaché après l'essayage)
    this.mount = $('.viewer-mount', this.root);
    this.app.viewer.attachTo(this.mount);
    this.dlg = $('#dlg', this.root);
    this.tooltip = $('.tooltip', this.root);
  }

  bind() {
    const app = this.app;
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.root.addEventListener('input', (e) => this.onInput(e));
    this.root.addEventListener('change', (e) => this.onChange(e));
    $('#file', this.root).addEventListener('change', (e) => { const f = e.target.files?.[0]; if (f) this.svc.openFile(f); e.target.value = ''; });
    window.addEventListener('dragover', (e) => { e.preventDefault(); $('.drop', this.root).hidden = false; });
    window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) $('.drop', this.root).hidden = true; });
    window.addEventListener('drop', (e) => { e.preventDefault(); $('.drop', this.root).hidden = true; const f = e.dataTransfer?.files?.[0]; if (f) this.svc.openFile(f); });
    window.addEventListener('keydown', (e) => this.onKey(e));
    app.on('selection', () => { if (!this._listTap) this.acc = { zones: false, mat: true, custom: false }; });
    app.on('explode', () => this.renderZones());
    for (const ev of ['model', 'zones', 'selection', 'config', 'history', 'variants']) app.on(ev, () => this.renderAll());
    app.on('hover', (piece, e) => this.showTooltip(piece, e));
    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.pop') && !e.target.closest('[data-pop-btn]')) this.root.querySelectorAll('.pop').forEach((p) => (p.hidden = true));
    });
  }

  onKey(e) {
    if (e.target.matches('input, select, textarea')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? this.app.redo() : this.app.undo(); }
    else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); this.app.redo(); }
    else if (e.key === 'Escape') { this.app.clearSelection(); if (this.el.dataset.present === '1') this.setPresent(false); }
    else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.target.closest?.('.palette')) {
      const balls = [...e.target.closest('.palette').querySelectorAll('.ball')];
      const i = balls.indexOf(e.target.closest('.ball'));
      balls[(i + (e.key === 'ArrowRight' ? 1 : -1) + balls.length) % balls.length]?.focus();
    }
  }

  toast(msg, ms = 2400) {
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = msg; el.setAttribute('role', 'status');
    document.body.append(el);
    setTimeout(() => el.remove(), ms);
  }

  // ---------- Rendu ----------
  renderAll() {
    this.el.dataset.mode = this.mode;
    this.app.interactive = this.mode !== 'client';
    this.root.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === this.mode)));
    this.renderInfo();
    this.renderZones();
    this.renderPalette();
    this.renderAtelier();
    const h = this.app.history;
    $('[data-a=undo]', this.root).disabled = !h.canUndo;
    $('[data-a=redo]', this.root).disabled = !h.canRedo;
    const ex = this.app.exploder;
    $('[data-a=explode]', this.root).setAttribute('aria-pressed', String(!!ex?.anyExploded));
    $('[data-a=explode]', this.root).hidden = !ex?.explodable.length;
    $('[data-r=hint]', this.root).hidden = this.app.selection.size > 0 || !this.app.model;
  }

  renderInfo() {
    const m = this.app.model?.meta;
    const el = $('[data-r=info]', this.root);
    if (!m) { el.textContent = t('loading'); return; }
    const parts = [];
    if (m.innerDiameter) parts.push(`${t('inner')} ${m.innerDiameter.toFixed(1).replace('.', ',')} mm · ${t('frSize')} ${frenchRingSize(m.innerDiameter)}`);
    if (this.mode === 'atelier') parts.push(`${this.app.pieces.length} ${t('pieces')} · ${Math.round(this.app.pieces.reduce((a, p) => a + p.tris, 0) / 1000)} k ${t('triangles')}`);
    el.textContent = parts.join(' · ');
    el.hidden = !parts.length;
  }

  /** Attributs d'une pastille : gemme (SVG facetté) pour les pierres, disque pour les métaux. */
  swAttr(type, hex, cls = '') {
    return type === 'gem' ? `class="${cls} gemic" style="--sw:${hex};--gem:${gemIconUrl(hex)}"` : `class="${cls}" style="--sw:${hex}"`;
  }
  swatchOf(zone) {
    return swatchOf(zone.type === 'gem' ? 'gem' : 'metal', this.app.assign[zone.pieceIds[0]]);
  }

  /** Parties de la bague : liste à choix multiples (accordéon), avec éclatement partie par partie. */
  renderZones() {
    const host = $('[data-r=parts]', this.root);
    if (!host) return;
    const app = this.app, sel = app.selection, ex = app.exploder;
    const zones = app.zones;
    const isOn = (z) => z.pieceIds.length > 0 && z.pieceIds.every((id) => sel.has(id));
    const chosen = zones.filter(isOn);
    const summary = !chosen.length ? t('partsPick') : chosen.length === 1 ? chosen[0].name : chosen.length === zones.length ? t('partsAll') : chosen.length <= 2 ? chosen.map((z) => z.name).join(', ') : `${chosen.length} ${t('partsCount')}`;
    const stack = chosen.slice(0, 3).map((z) => `<i ${this.swAttr(z.type, this.swatchOf(z))}></i>`).join('') || '<i class="empty"></i>';
    const subOpen = (this.subOpen ||= new Set());
    const rows = zones.map((z) => {
      const on = isOn(z), hid = z.pieceIds.every((id) => app.hidden.has(id));
      const can = ex?.has(z.id), exp = ex?.isExploded(z.id);
      const multi = z.pieceIds.length > 1, open = multi && subOpen.has(z.id);
      const word = z.type === 'gem' ? t('stoneN') : t('pieceN');
      const subs = open ? z.pieceIds.map((id, i) => {
        const pon = sel.has(id), phid = app.hidden.has(id);
        return `<li class="prow sub ${phid ? 'is-hidden' : ''}">
          <button class="pmain" role="option" data-piece="${esc(id)}" aria-selected="${pon}">
            <i ${this.swAttr(z.type, swatchOf(z.type === 'gem' ? 'gem' : 'metal', app.assign[id]), 'psw')}></i><span class="pn">${word} ${i + 1}</span><span class="pcheck" aria-hidden="true"></span>
          </button>
          <button class="pexp peye" data-eyep="${esc(id)}" aria-pressed="${phid}" aria-label="${phid ? t('show') : t('hide')}" title="${phid ? t('show') : t('hide')}">${phid ? ICON.eyeOff : ICON.eye}</button>
          <span class="pexp-gap"></span>
        </li>`;
      }).join('') : '';
      return `<li class="prow ${hid ? 'is-hidden' : ''}">
        ${multi ? `<button class="pexp pfold" data-fold="${esc(z.id)}" aria-expanded="${open}" aria-label="${t('eachOne')}" title="${t('eachOne')}">${CHEV}</button>` : '<span class="pexp-gap pfold-gap"></span>'}
        <button class="pmain" role="option" data-zone="${esc(z.id)}" aria-selected="${on}">
          <i ${this.swAttr(z.type, this.swatchOf(z), 'psw')}></i><span class="pn">${esc(z.name)}${multi ? ` <small>${z.pieceIds.length}</small>` : ''}</span><span class="pcheck" aria-hidden="true"></span>
        </button>
        <button class="pexp peye" data-eye="${esc(z.id)}" aria-pressed="${hid}" aria-label="${hid ? t('show') : t('hide')}" title="${hid ? t('show') : t('hide')}">${hid ? ICON.eyeOff : ICON.eye}</button>
        ${can ? `<button class="pexp" data-explode="${esc(z.id)}" aria-pressed="${!!exp}" aria-label="${exp ? t('assemblePart') : t('explodePart')}" title="${exp ? t('assemblePart') : t('explodePart')}">${ICON.explode}</button>` : '<span class="pexp-gap"></span>'}
      </li>${subs}`;
    }).join('');
    host.innerHTML = `<section class="acc ${this.acc.zones ? 'open' : ''}" data-accsec="zones">
      <button class="acc-h" data-acc="zones" aria-expanded="${this.acc.zones}">
        <span class="sw-stack">${stack}</span>
        <span class="t"><small>${t('zones')}</small><b>${esc(summary)}</b></span>${CHEV}
      </button>
      <div class="acc-b"><div class="acc-in">
        <ul class="plist" role="listbox" aria-multiselectable="true" aria-label="${t('zones')}">${rows}</ul>
        <div class="ptools">
          <button class="link" data-a="selall">${t('selectAll')}</button>
          <button class="link" data-a="clearsel" ${sel.size ? '' : 'disabled'}>${t('selectNone')}</button>
          <button class="link" data-a="similar" ${sel.size ? '' : 'disabled'}>${t('similarShort')}</button>
          <button class="link ${app.granularity === 'piece' ? 'on' : ''}" data-a="fine" aria-pressed="${app.granularity === 'piece'}">${t('fine')}</button>
        </div>
      </div></div></section>`;
  }

  allowedFor(kind) {
    // intersection des règles des zones sélectionnées (mode Vitrine uniquement)
    if (this.mode === 'atelier') return null;
    let allowed = null;
    for (const id of this.app.selection) {
      const z = this.app.zoneOfPiece(id);
      if (z?.allowed) allowed = allowed ? allowed.filter((x) => z.allowed.includes(x)) : [...z.allowed];
    }
    return allowed;
  }

  ball(item, kind, pressed) {
    const url = this.thumbs[kind]?.[item.id];
    return `<button class="ball" role="option" data-${kind === 'finishes' ? 'finish' : 'mat'}="${item.id}" aria-label="${esc(item.name)}" aria-pressed="${pressed}" title="${esc(item.name)}">
      <span class="b" style="--sw:${item.swatch ?? '#bbb'};${url ? `--img:url(${url})` : ''}"></span><span class="n">${esc(item.name)}</span></button>`;
  }

  /** Pierres : pastilles de couleur groupées par famille, sans nom d'espèce. */
  gemDots(list, sameM) {
    const dot = (item, pressed, extra = '') => {
      return `<button class="dot ${extra}" role="option" data-mat="${item.id}" aria-label="${esc(item.name)}" aria-pressed="${pressed}" title="${esc(item.name)}"><span class="gemic" style="--sw:${item.swatch ?? '#bbb'};--gem:${gemIconUrl(item.swatch)}"></span></button>`;
    };
    const groups = GEM_GROUPS.map((g) => {
      const items = list.filter((x) => x.group === g.id);
      return items.length ? `<div class="dots" role="group" aria-label="${esc(g.name)}">${items.map((x) => dot(x, x.id === sameM)).join('')}</div>` : '';
    }).join('');
    return groups;
  }

  /** Feuille « matière » : un accordéon (matière courante en en-tête) + un accordéon « teinte libre ». Rien sans sélection. */
  renderPalette() {
    if (this._dragging) return; // ne pas reconstruire pendant un glissement de curseur
    const app = this.app, host = $('[data-r=mats]', this.root);
    const kind = app.selectionKind();
    this.el.dataset.sel = kind ? '1' : '0';
    if (!kind) { host.innerHTML = ''; return; }
    if (kind === 'mixed') { host.innerHTML = `<p class="mixed">${t('mixedNote')}</p>`; return; }
    this.tab = kind === 'metal' ? 'metals' : 'gems';
    const assigns = [...app.selection].map((i) => app.assign[i]).filter(Boolean);
    const sameM = assigns.length && assigns.every((a) => a.m === assigns[0].m) ? assigns[0].m : null;
    const sameF = assigns.length && assigns.every((a) => a.f === assigns[0].f) ? assigns[0].f : null;
    const sameC = assigns.length && assigns.every((a) => a.m === CUSTOM && a.c === assigns[0].c) ? assigns[0].c : null;
    const allowed = this.allowedFor(kind);
    let list = kind === 'metal' ? METALS : GEMS;
    if (allowed) list = list.filter((x) => allowed.includes(x.id));
    const customOn = !allowed || allowed.includes(CUSTOM);
    const pal = kind === 'gem'
      ? this.gemDots(list, sameM) + (customOn ? `<button class="dot custom-dot" role="option" data-mat="${CUSTOM}" aria-label="${t('customColor')}" aria-pressed="${sameM === CUSTOM}" title="${t('customColor')}"><span></span></button>` : '')
      : list.map((m) => this.ball(m, 'metals', m.id === sameM)).join('')
        + (customOn ? `<button class="ball" role="option" data-mat="${CUSTOM}" aria-label="${t('customColor')}" aria-pressed="${sameM === CUSTOM}" title="${t('customColor')}"><span class="b custom-b"></span><span class="n">${t('customColor')}</span></button>` : '');
    const fin = kind === 'metal'
      ? `<div class="finish-seg" role="group" aria-label="${t('finishes')}">${FINISHES.map((f) => `<button class="pill" data-finish="${f.id}" aria-pressed="${f.id === sameF}">${esc(f.name)}</button>`).join('')}</div>` : '';
    const name = sameM ? describeAssignment({ m: sameM, f: sameF, c: sameC }, kind) : t('severalMaterials');
    const sw = swatchOf(kind, assigns[0]);
    const cHex = (sameC ?? this.customHex[kind]).toUpperCase();
    const acc = (id, head, body) => `<section class="acc ${this.acc[id] ? 'open' : ''}" data-accsec="${id}">
        <button class="acc-h" data-acc="${id}" aria-expanded="${this.acc[id]}">${head}${CHEV}</button>
        <div class="acc-b"><div class="acc-in">${body}</div></div></section>`;
    host.innerHTML = acc('mat',
      `<i class="sw ${kind === 'gem' ? 'gemic' : ''}" style="--sw:${sw};${kind === 'gem' ? `--gem:${gemIconUrl(sw)}` : ''}"></i><span class="t"><small>${kind === 'metal' ? t('typeMetal') : t('typeGem')}</small><b>${esc(name)}</b></span>`,
      `<div class="palette ${kind === 'gem' ? 'gems' : ''}" data-r="palette" role="listbox">${pal}</div>${fin}`)
      + (customOn ? acc('custom',
        `<i class="sw custom-sw" style="--sw:${sameC ?? this.customHex[kind]}"></i><span class="t"><small>${t('customColor')}</small><b class="hex">${cHex}</b></span>`,
        '<div class="custom" data-r="custom"></div>') : '');
    this.renderCustom(kind, customOn, sameM === CUSTOM ? sameC : null);
  }

  /** Sélecteur de teinte libre : couleur native + code + teinte / intensité / clarté. */
  renderCustom(kind, show, hexIn) {
    const box = $('[data-r=custom]', this.root);
    if (!box || this._dragging || !show) return;
    const hex = hexIn ?? this.customHex[kind];
    const [h, s, l] = hexToHsl(hex);
    box.dataset.kind = kind;
    box.innerHTML = `<div class="c-row">
        <input type="color" data-r="cpick" value="${hex}" aria-label="${t('customColor')}">
        <input type="text" data-r="chex" value="${hex.toUpperCase()}" maxlength="7" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="${t('hexLabel')}">
      </div>
      <label>${t('hue')}<input type="range" class="hue" min="0" max="360" value="${Math.round(h)}" data-r="ch"></label>
      <label>${t('intensity')}<input type="range" class="track-s" min="0" max="100" value="${Math.round(s * 100)}" data-r="cs"></label>
      <label>${t('lightness')}<input type="range" class="track-l" min="4" max="96" value="${Math.round(l * 100)}" data-r="cl"></label>`;
    this.paintTracks(box);
  }

  paintTracks(box) {
    const h = +$('[data-r=ch]', box).value, s = +$('[data-r=cs]', box).value / 100, l = +$('[data-r=cl]', box).value / 100;
    $('[data-r=cs]', box).style.background = `linear-gradient(90deg, ${hslToHex(h, 0, l)}, ${hslToHex(h, 1, l)})`;
    $('[data-r=cl]', box).style.background = `linear-gradient(90deg, #000, ${hslToHex(h, s, 0.5)}, #fff)`;
  }

  /** Applique une teinte libre à la sélection. live = glissement en cours (pas d'historique). */
  applyCustom(hex, { live = false, source = null } = {}) {
    hex = validHex(hex);
    const kind = this.app.selectionKind();
    if (!hex || (kind !== 'metal' && kind !== 'gem')) return;
    this.customHex[kind] = hex;
    this._dragging = live;
    this.app.applyToSelection({ m: CUSTOM, c: hex }, { record: !live, animate: false });
    const box = $('[data-r=custom]', this.root);
    if (box) {
      if (source !== 'pick') $('[data-r=cpick]', box).value = hex;
      if (source !== 'hex') $('[data-r=chex]', box).value = hex.toUpperCase();
      if (source === 'pick' || source === 'hex') {
        const [h, s, l] = hexToHsl(hex);
        $('[data-r=ch]', box).value = Math.round(h); $('[data-r=cs]', box).value = Math.round(s * 100); $('[data-r=cl]', box).value = Math.round(l * 100);
      }
      this.paintTracks(box);
    }
  }

  renderAtelier() {
    const box = $('[data-r=atelier]', this.root);
    if (this.mode !== 'atelier' || !this.app.model) { box.innerHTML = ''; return; }
    const app = this.app;
    const selZones = app.zones.filter((z) => z.pieceIds.some((id) => app.selection.has(id)));
    const m = app.model.meta;
    let html = `<div class="p-head"><h3>${t('modeAtelier')}</h3></div>`;
    if (selZones.length === 1) {
      const z = selZones[0];
      const hidden = z.pieceIds.every((id) => app.hidden.has(id));
      const list = z.type === 'gem' ? GEMS : METALS;
      html += `<div class="field"><label>${t('rename')}<input type="text" data-r="zname" value="${esc(z.name)}" maxlength="40"></label></div>
        <div class="field"><label>${t('type')}<select data-r="ztype"><option value="metal" ${z.type === 'metal' ? 'selected' : ''}>${t('typeMetal')}</option><option value="gem" ${z.type === 'gem' ? 'selected' : ''}>${t('typeGem')}</option></select></label></div>
        <div class="tools"><button class="btn small" data-a="zhide">${hidden ? t('show') : t('hide')}</button>${z.pieceIds.length > 1 ? `<button class="btn small" data-a="zsplit">${t('split')}</button>` : ''}</div>
        <p class="palette-title">${t('rules')}</p>
        <div class="rules" data-r="rules">${[...list, { id: CUSTOM, name: t('customColor') }].map((x) => `<label><input type="checkbox" data-rule="${x.id}" ${!z.allowed || z.allowed.includes(x.id) ? 'checked' : ''}>${esc(x.name)}</label>`).join('')}</div>`;
    } else if (selZones.length > 1) {
      html += `<div class="tools"><button class="btn small" data-a="zmerge">${t('merge')} (${selZones.length})</button></div>`;
    } else {
      html += `<p class="muted tiny">${t('tapHint')}</p>`;
    }
    html += `<div class="field" style="margin-top:10px"><label>${t('unit')}<select data-r="unit">${['mm', 'cm', 'm', 'inch'].map((u) => `<option ${u === m.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></label></div>
      <div class="tools"><button class="btn small" data-a="flipup">${t('flipUp')}</button><button class="btn small" data-a="report">${t('report')}</button><button class="btn small" data-a="exportproject">${t('exportProject')}</button></div>`;
    box.innerHTML = html;
  }

  showTooltip(piece, e) {
    if (!piece || !e) { this.tooltip.hidden = true; return; }
    const z = this.app.zoneOfPiece(piece.id);
    this.tooltip.textContent = this.mode === 'atelier' ? `${z?.name ?? ''} — ${piece.name}` : (z?.name ?? piece.name);
    this.tooltip.style.left = e.clientX + 14 + 'px'; this.tooltip.style.top = e.clientY + 14 + 'px';
    this.tooltip.hidden = false;
  }

  // ---------- Événements ----------
  onClick(e) {
    const app = this.app;
    const tgt = e.target;
    const fold = tgt.closest('[data-fold]');
    if (fold) { const k = fold.dataset.fold; this.subOpen ||= new Set(); this.subOpen.has(k) ? this.subOpen.delete(k) : this.subOpen.add(k); this.acc = { zones: true, mat: false, custom: false }; this.renderZones(); return; }
    const eyep = tgt.closest('[data-eyep]');
    if (eyep) { app.setHidden([eyep.dataset.eyep], !app.hidden.has(eyep.dataset.eyep)); return; }
    const pc = tgt.closest('[data-piece]');
    if (pc) {
      const id = pc.dataset.piece;
      this._listTap = true; this.acc = { zones: true, mat: false, custom: false };
      app.selection.has(id) ? app.select([...app.selection].filter((x) => x !== id)) : app.select([id], true);
      this._listTap = false; app.viewer.invalidate();
      return;
    }
    const eye = tgt.closest('[data-eye]');
    if (eye) { const z = app.zones.find((zz) => zz.id === eye.dataset.eye); if (z) app.setHidden(z.pieceIds, !z.pieceIds.every((id) => app.hidden.has(id))); return; }
    const ex1 = tgt.closest('[data-explode]');
    if (ex1) { app.exploder.toggleZone(ex1.dataset.explode); this.renderAll(); return; }
    const zone = tgt.closest('[data-zone]');
    if (zone) {
      // liste à choix multiples : chaque ligne ajoute / retire sa partie de la sélection
      const z = app.zoneById(zone.dataset.zone);
      const allIn = z.pieceIds.every((id) => app.selection.has(id));
      this._listTap = true;
      this.acc = { zones: true, mat: false, custom: false };
      allIn ? app.select([...app.selection].filter((id) => !z.pieceIds.includes(id))) : app.selectZone(z.id, true);
      this._listTap = false;
      app.viewer.invalidate();
      return;
    }
    const mat = tgt.closest('[data-mat]');
    if (mat) { app.applyToSelection({ m: mat.dataset.mat }); return; }
    const fin = tgt.closest('[data-finish]');
    if (fin) { app.applyToSelection({ f: fin.dataset.finish }); return; }
    const acc = tgt.closest('[data-acc]');
    if (acc) {
      const k = acc.dataset.acc, open = !this.acc[k];
      this.acc = { zones: false, mat: false, custom: false }; this.acc[k] = open;
      this.root.querySelectorAll('.acc[data-accsec]').forEach((sec) => {
        const on = !!this.acc[sec.dataset.accsec];
        sec.classList.toggle('open', on); sec.querySelector('.acc-h')?.setAttribute('aria-expanded', String(on));
      });
      return;
    }
    const md = tgt.closest('.seg [data-mode]');
    if (md) { this.setMode(md.dataset.mode); return; }
    const pb = tgt.closest('[data-pop-btn]');
    if (pb) { this.togglePop(pb.dataset.popBtn); return; }
    const vw = tgt.closest('[data-view]');
    if (vw) { app.viewer.setView(JSON.parse(vw.dataset.view)); return; }
    const env = tgt.closest('[data-env]');
    if (env) {
      const id = env.dataset.env;
      const hdr = ENVIRONMENTS.find((e) => e.id === id)?.group === 'hdri';
      if (hdr) this.toast(t('envLoading'), 1500);
      app.viewer.setEnvironment(id).then(() => { if (!hdr && this.bg === 'env') this.setBg('light'); this.renderEnvPop(); }).catch(() => this.toast(t('envError')));
      return;
    }
    const bg = tgt.closest('[data-bg]');
    if (bg) { this.setBg(bg.dataset.bg); return; }
    const a = tgt.closest('[data-a]')?.dataset.a;
    if (a) this.action(a, tgt.closest('[data-a]'));
  }

  onInput(e) {
    const r = e.target.dataset.r;
    if (r === 'envrot') this.app.viewer.setEnvironmentRotation(+e.target.value);
    if (r === 'bgblur') this.app.viewer.setBackground('env', { blur: +e.target.value });
    if (r === 'exposure') this.app.viewer.setExposure(+e.target.value);
    if (r === 'cpick') this.applyCustom(e.target.value, { live: true, source: 'pick' });
    if (r === 'ch' || r === 'cs' || r === 'cl') this.applyCustom(this.hexFromSliders(), { live: true, source: 'slider' });
  }

  hexFromSliders() {
    const box = $('[data-r=custom]', this.root);
    return hslToHex(+$('[data-r=ch]', box).value, +$('[data-r=cs]', box).value / 100, +$('[data-r=cl]', box).value / 100);
  }

  onChange(e) {
    const app = this.app, r = e.target.dataset.r;
    const z = app.zones.find((zz) => zz.pieceIds.some((id) => app.selection.has(id)));
    if (r === 'zname' && z) app.renameZone(z.id, e.target.value.trim() || z.name);
    if (r === 'ztype' && z) app.setZoneType(z.id, e.target.value);
    if (r === 'unit') this.svc.reimport({ unit: e.target.value });
    if (r === 'cpick') { this._dragging = false; this.applyCustom(e.target.value, { source: 'pick' }); }
    if (r === 'ch' || r === 'cs' || r === 'cl') { this._dragging = false; this.applyCustom(this.hexFromSliders(), { source: 'slider' }); }
    if (r === 'chex') {
      const hx = validHex(e.target.value);
      this._dragging = false;
      if (hx) this.applyCustom(hx, { source: 'hex' }); else this.renderPalette();
    }
    if (e.target.dataset.rule && z) {
      const checks = [...this.root.querySelectorAll('[data-rule]')];
      const on = checks.filter((c) => c.checked).map((c) => c.dataset.rule);
      app.setZoneRules(z.id, on.length === checks.length ? null : on);
    }
  }

  async action(a, el) {
    const app = this.app;
    switch (a) {
      case 'open': $('#file', this.root).click(); break;
      case 'undo': app.undo(); break;
      case 'redo': app.redo(); break;
      case 'explode': app.exploder.toggleAll(); this.renderAll(); break;
      case 'selall': this._listTap = true; this.acc = { zones: true, mat: false, custom: false }; app.select(app.zones.flatMap((z) => z.pieceIds)); this._listTap = false; break;
      case 'fine': app.granularity = app.granularity === 'zone' ? 'piece' : 'zone'; this.renderAll(); break;
      case 'similar': app.selectSimilar(); break;
      case 'clearsel': app.clearSelection(); break;
      case 'autorotate': this.autorotate = !(el.getAttribute('aria-pressed') === 'true'); el.setAttribute('aria-pressed', String(this.autorotate)); app.viewer.setAutoRotate(this.autorotate); break;
      case 'theme': this.toggleTheme(); break;
      case 'present': this.setPresent(this.el.dataset.present !== '1'); break;
      case 'present-exit': this.setPresent(false); break;
      case 'exit-client': if (!this.locked) this.setMode(prefs.get('mode', 'vitrine') === 'atelier' ? 'atelier' : 'vitrine'); break;
      case 'dlg-close': this.dlg.close(); break;
      case 'zhide': { const z = app.zones.find((zz) => zz.pieceIds.some((id) => app.selection.has(id))); if (z) app.setHidden(z.pieceIds, !z.pieceIds.every((id) => app.hidden.has(id))); break; }
      case 'zsplit': { const z = app.zones.find((zz) => zz.pieceIds.some((id) => app.selection.has(id))); if (z) app.splitZone(z.id); break; }
      case 'zmerge': { const ids = app.zones.filter((zz) => zz.pieceIds.some((id) => app.selection.has(id))).map((zz) => zz.id); app.mergeZones(ids); break; }
      case 'flipup': this.svc.reimport({ flipUp: !this.svc.options?.flipUp }); break;
      case 'report': this.openReport(); break;
      case 'exportproject': this.exportProject(); break;
      case 'more': this.openMore(); break;
      case 'variants': this.openVariants(); break;
      case 'share': this.openShare(); break;
      case 'photo': this.takePhoto(); break;
      case 'whatsnew': this.changelog({ force: true }); break;
      case 'recap': this.openRecap(); break;
      case 'ar': this.openAR(); break;
      case 'tryon': this.tryon.open(); break;
    }
  }

  /** Plein écran : sur iPhone (pas d'API Fullscreen) l'interface se réduit à la vue 3D + un bouton de sortie visible. */
  initTheme() {
    let th = null; try { th = localStorage.getItem('rc:theme'); } catch {}
    if (th !== 'light' && th !== 'dark') th = theme.defaultScheme === 'light' || theme.defaultScheme === 'dark' ? theme.defaultScheme : null;
    if (th) document.documentElement.dataset.theme = th;
    this._syncThemeColor();
  }
  toggleTheme() {
    const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('rc:theme', next); } catch {}
    this._syncThemeColor();
    this.app.viewer._applyBackground();
    this.renderAll?.();
  }
  _syncThemeColor() {
    const m = document.querySelector('meta[name=theme-color]');
    if (m) m.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || m.content;
  }

  setPresent(on) {
    this.el.dataset.present = on ? '1' : '0';
    $('[data-a=present]', this.root).setAttribute('aria-pressed', String(on));
    if (on) this.app.clearSelection();
    const canFs = document.documentElement.requestFullscreen && !/iPhone|iPad/.test(navigator.userAgent);
    if (on && canFs) document.documentElement.requestFullscreen().catch(() => {});
    if (!on && document.fullscreenElement) document.exitFullscreen?.();
    for (const d of [50, 250]) setTimeout(() => this.app.viewer.resize(), d);
  }

  setMode(m) {
    if (m === 'client' && this.el.dataset.present === '1') this.setPresent(false);
    if (this.locked) m = 'client';
    this.mode = m;
    if (m !== 'client') prefs.set('mode', m);
    this.app.viewer.setAutoRotate(FEATURES.autoRotate && m !== 'atelier' && this.autorotate !== false);
    if (m === 'client') { this.app.clearSelection(); this.setPresent(false); }
    this.renderAll();
    setTimeout(() => this.app.viewer.resize(), 50);
  }

  /** Lien client : interface épurée, verrouillée. */
  lockClient() {
    this.locked = true;
    this.el.dataset.locked = '1';
    this.setMode('client');
  }

  setBg(k) {
    this.bg = k;
    this.viewport.classList.remove('bg-dark', 'bg-transparent');
    if (k === 'transparent') this.viewport.classList.add('bg-transparent');
    this.app.viewer.setBackground(k);
    this.renderEnvPop();
  }

  togglePop(name) {
    const pops = [...this.root.querySelectorAll('.pop')];
    pops.forEach((p) => { if (p.dataset.pop !== name) p.hidden = true; });
    const pop = $(`.pop[data-pop=${name}]`, this.root);
    if (name === 'views') this.renderViewsPop(); else this.renderEnvPop();
    pop.hidden = !pop.hidden;
  }

  viewLabel(n) {
    if (/face|front/i.test(n)) return t('viewFront');
    if (/dessus|top/i.test(n)) return t('viewTop');
    if (/droite|right/i.test(n)) return t('viewRight');
    if (/gauche|left/i.test(n)) return 'Gauche';
    if (/persp/i.test(n)) return t('view34') + ' (CAO)';
    return n;
  }

  renderViewsPop() {
    const v = this.app.model?.views ?? [];
    const std = [[t('view34'), [0.62, 0.45, 0.64]], [t('viewFront'), [0, 0, 1]], [t('viewTop'), [0, 1, 0]], [t('viewSide'), [1, 0, 0]]];
    const fromFile = v.map((x) => [this.viewLabel(x.name), x.dir]);
    $('[data-pop=views]', this.root).innerHTML = `<h4>${t('views')}</h4><div class="row">${[...std, ...fromFile].map(([n, d]) => `<button class="btn small" data-view='${JSON.stringify(d)}'>${esc(n)}</button>`).join('')}</div>`;
  }

  renderEnvPop() {
    const vw = this.app.viewer;
    const btn = (e) => `<button class="btn small ${vw.envId === e.id ? 'primary' : ''}" data-env="${e.id}">${esc(e.name)}</button>`;
    const isHdri = ENVIRONMENTS.find((e) => e.id === vw.envId)?.group === 'hdri';
    const bgs = [['light', t('bgLight')], ['dark', t('bgDark')], ['transparent', t('bgTransparent')], ...(isHdri ? [['env', t('bgEnv')]] : [])];
    $('[data-pop=env]', this.root).innerHTML = `
      <h4>${t('environment')}</h4>
      <div class="row">${ENVIRONMENTS.filter((e) => e.group === 'studio').map(btn).join('')}</div>
      <h4 class="sub">${t('envHdri')}</h4>
      <div class="row">${ENVIRONMENTS.filter((e) => e.group === 'hdri').map(btn).join('')}</div>
      <label>${t('envRotation')}<input type="range" min="0" max="360" value="${Math.round((vw.scene.environmentRotation.y * 180) / Math.PI)}" data-r="envrot"></label>
      <label>${t('exposure')}<input type="range" min="0.6" max="1.6" step="0.05" value="${vw.renderer.toneMappingExposure}" data-r="exposure"></label>
      <h4 style="margin-top:10px">${t('background')}</h4>
      <div class="row">${bgs.map(([k, n]) => `<button class="btn small ${this.bg === k ? 'primary' : ''}" data-bg="${k}">${esc(n)}</button>`).join('')}</div>
      ${this.bg === 'env' ? `<label>${t('bgBlur')}<input type="range" min="0" max="1" step="0.05" value="${vw.bgBlur}" data-r="bgblur"></label>` : ''}`;
  }

  // ---------- Dialogues ----------
  openDialog(title, node) {
    $('h2', this.dlg).textContent = title;
    const body = $('.dlg-b', this.dlg);
    body.replaceChildren(node);
    if (!this.dlg.open) this.dlg.showModal();
  }

  html(s) { const d = document.createElement('div'); d.innerHTML = s; return d; }

  shareUrl(client = false) {
    const a = this.app;
    return buildShareUrl(location.origin + location.pathname, {
      client, modelId: a.modelId, assign: a.assign, hidden: [...a.hidden],
      env: a.viewer.envId, envRot: Math.round((a.viewer.scene.environmentRotation.y * 180) / Math.PI),
    });
  }

  /** Actions secondaires, rangées dans un menu pour garder la barre d'actions propre. */
  openMore() {
    const d = this.html(`<div class="more-list">
      <button data-a="variants"><b>${t('variants')}</b><span>${t('variantsHint')}</span></button>
      <button data-a="share"><b>${t('share')}</b><span>${t('shareHint')}</span></button>
      <button data-a="recap"><b>${t('recap')}</b><span>${t('recapHint')}</span></button>
      <button data-a="whatsnew"><b>${t('whatsNew')}</b><span>${t('whatsNewHint')}</span></button></div>`);
    this.openDialog(t('more'), d);
  }

  async openShare() {
    const urls = { client: this.shareUrl(true), jeweler: this.shareUrl(false) };
    const field = (k, label) => `<p class="palette-title">${label}</p>
      <input type="url" readonly value="${esc(urls[k])}" data-r="shareurl-${k}" aria-label="${esc(label)}">
      <div class="row"><button class="btn ${k === 'client' ? 'primary' : ''}" data-s="copy" data-k="${k}">${t('copyLink')}</button>
        ${navigator.share ? `<button class="btn" data-s="native" data-k="${k}">${t('share')}…</button>` : ''}</div>`;
    const d = this.html(`
      <p class="muted tiny">${t('clientNote')}</p>
      ${field('client', t('clientLink'))}
      <img class="qr" alt="QR" width="180" height="180">
      ${field('jeweler', t('jewelerLink'))}
      <p class="muted tiny">${t('shareNote')}</p>
      <div class="row"><button class="btn" data-s="project">${t('exportProject')}</button></div>`);
    d.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-s]'); if (!b) return;
      const s = b.dataset.s, url = urls[b.dataset.k];
      if (s === 'copy') { try { await navigator.clipboard.writeText(url); this.toast(t('linkCopied')); } catch { $(`[data-r=shareurl-${b.dataset.k}]`, d).select(); } }
      if (s === 'native') { try { await navigator.share({ url, title: t('app') }); } catch { /* annulé */ } }
      if (s === 'project') this.exportProject();
    });
    this.openDialog(t('share'), d);
    qrDataUrl(urls.client).then((u) => { $('img.qr', d).src = u; }).catch(() => {});
  }

  async exportProject() {
    try {
      const blob = await exportProjectGLB(this.app);
      const name = (this.app.model.meta.fileName || 'bague').replace(/\.[^.]+$/, '') + '.projet.glb';
      await shareOrDownload(blob, name, t('app'));
    } catch (e) { this.toast(t('errorGeneric') + ' ' + e.message); }
  }

  async takePhoto() {
    const app = this.app;
    await withoutHighlight(app, async () => {
      const blob = await app.viewer.capture({ scale: 2, background: BG[this.bg] });
      const how = await shareOrDownload(blob, 'bague.png', t('app'));
      if (how !== 'cancelled') this.toast(t('photoSaved'));
    });
  }

  openRecap() {
    const m = this.app.model.meta;
    const rows = recapRows({ ...this.app, finishName: (id) => byId(FINISHES, id)?.name });
    const d = this.html(`
      <table><tbody>${rows.map((r) => `<tr><th><span class="sw" style="background:${r.swatch ?? '#ccc'}"></span>${esc(r.zone)}</th><td>${esc(r.material)}</td></tr>`).join('')}</tbody></table>
      <p class="muted tiny">${m.innerDiameter ? `${t('inner')} ${m.innerDiameter.toFixed(1).replace('.', ',')} mm · ${t('frSize')} ${frenchRingSize(m.innerDiameter)} · ` : ''}${t('size')} ${m.size.map((x) => x.toFixed(1).replace('.', ',')).join(' × ')} mm</p>
      <div class="row no-print"><button class="btn primary" data-s="print">${t('print')}</button></div>`);
    d.addEventListener('click', (e) => { if (e.target.closest('[data-s=print]')) window.print(); });
    this.openDialog(t('recap'), d);
  }

  openVariants() {
    const app = this.app;
    const d = this.html('');
    const draw = () => {
      d.innerHTML = `<div class="row"><input type="text" data-r="vname" placeholder="${t('variantName')}" maxlength="40"><button class="btn primary" data-s="save">${t('saveVariant')}</button></div>
        <ul style="list-style:none;padding:0">${app.variants.map((v) => `<li class="row"><strong style="flex:1">${esc(v.name)}</strong><button class="btn small" data-s="apply" data-id="${v.id}">${t('apply')}</button><button class="btn small" data-s="del" data-id="${v.id}">${t('delete')}</button></li>`).join('')}</ul>`;
    };
    draw();
    d.addEventListener('click', (e) => {
      const b = e.target.closest('[data-s]'); if (!b) return;
      if (b.dataset.s === 'save') { app.saveVariant($('[data-r=vname]', d).value.trim() || `Variante ${app.variants.length + 1}`); draw(); }
      if (b.dataset.s === 'apply') { app.applyVariant(b.dataset.id); this.dlg.close(); }
      if (b.dataset.s === 'del') { app.deleteVariant(b.dataset.id); draw(); }
    });
    this.openDialog(t('variants'), d);
  }

  openReport() {
    const { report, meta } = this.app.model;
    const d = this.html(`<ul>${report.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
      <p class="muted tiny">${esc(meta.fileName)} · ${esc(meta.format)} · ${t('size')} ${meta.size.map((x) => x.toFixed(1)).join(' × ')} mm</p>`);
    this.openDialog(t('report'), d);
  }

  async openAR() {
    const app = this.app;
    const d = this.html('');
    const url = this.shareUrl(this.mode === 'client');
    if (!isMobile()) {
      d.innerHTML = `<p>${t('arDesktop')}</p><img class="qr" alt="QR" width="200" height="200">`;
      this.openDialog(t('arTitle'), d);
      qrDataUrl(url).then((u) => { $('img.qr', d).src = u; }).catch(() => {});
      return;
    }
    let mode = 'real';
    d.innerHTML = `<div class="row"><div class="seg" role="group"><button data-m="real" aria-pressed="true">${t('arReal')}</button><button data-m="big" aria-pressed="false">${t('arBig')}</button></div></div>
      <div data-r="slot"><button class="btn primary big" data-s="prep">${t('arPrepare')}</button></div>
      <p class="muted tiny">${t('arStonesNote')}</p>${isChromeIOS() ? `<p class="muted tiny">${t('arIosChrome')}</p>` : ''}`;
    d.addEventListener('click', async (e) => {
      const m = e.target.closest('[data-m]');
      if (m) { mode = m.dataset.m; d.querySelectorAll('[data-m]').forEach((b) => b.setAttribute('aria-pressed', String(b === m))); $('[data-r=slot]', d).innerHTML = `<button class="btn primary big" data-s="prep">${t('arPrepare')}</button>`; return; }
      if (e.target.closest('[data-s=prep]')) {
        const slot = $('[data-r=slot]', d);
        slot.innerHTML = `<p class="muted">${t('arPreparing')}</p>`;
        try {
          const prepared = await prepareAR(app, mode);
          slot.replaceChildren(buildARLauncher(prepared, { label: t('arOpen'), scaleMode: mode })); // 2ᵉ appui = geste utilisateur valide pour Quick Look
        } catch (err) { slot.innerHTML = `<p class="err">${esc(err.message)}</p>`; }
      }
    });
    this.openDialog(t('arTitle'), d);
  }

  // ---------- Progression / erreurs ----------
  progress(pct, label) {
    const p = $('.progress', this.root);
    p.hidden = pct >= 100;
    $('.bar i', p).style.width = pct + '%';
    $('span', p).textContent = label || '';
  }

  fatal(msg) {
    const d = this.html(`<p class="err">${esc(msg)}</p>`);
    this.openDialog(t('app'), d);
  }

  onboard() {
    if (prefs.get('onboarded') || this.locked) return;
    const d = this.html(`<p>${t('onboardBody')}</p><p class="muted tiny">${t('privacy')}</p><div class="row"><button class="btn primary" data-s="ok">${t('gotIt')}</button></div>`);
    d.addEventListener('click', (e) => { if (e.target.closest('[data-s=ok]')) { prefs.set('onboarded', true); this.dlg.close(); } });
    this.openDialog(t('onboardTitle'), d);
  }

  /** Fenêtre « Nouveautés » : une seule fois par version et par visiteur (pas à la toute première visite, ni en mode client). */
  changelog({ force = false } = {}) {
    const seen = prefs.get('seenVersion');
    if (!force) {
      if (!prefs.get('onboarded')) { prefs.set('seenVersion', CURRENT_VERSION); return; } // première visite : l'accueil suffit
      if (this.locked || this.mode === 'client' || this.dlg.open) return;
    }
    const entries = force ? CHANGELOG.slice(0, 1) : unseenEntries(seen);
    if (!entries.length) return;
    const li = (e) => `<h3 class="cl-v">v${e.version} <small>${e.date}</small></h3><ul class="cl">${(e[LANG] || e.fr).map((x) => `<li>${x}</li>`).join('')}</ul>`;
    const d = this.html(`${entries.map(li).join('')}<div class="row"><button class="btn primary" data-s="ok">${t('gotIt')}</button></div>`);
    const done = () => prefs.set('seenVersion', CURRENT_VERSION);
    d.addEventListener('click', (e) => { if (e.target.closest('[data-s=ok]')) { done(); this.dlg.close(); } });
    this.dlg.addEventListener('close', done, { once: true });
    this.openDialog(t('whatsNew'), d);
  }

  /** Génère les billes (WebGL temporaire) puis rafraîchit la palette. */
  loadThumbnails() {
    setTimeout(() => { try { this.thumbs = renderThumbnails(112); } catch { /* repli : pastilles de couleur CSS */ } this.renderPalette(); }, 60);
  }
}
