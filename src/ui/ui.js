// Interface : mode Vitrine (acheteur / vendeur) et mode Atelier (designer). Mobile d'abord.
import { t } from './i18n.js';
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

const BG = { light: '#efeae1', dark: '#17161a', transparent: null };

export class UI {
  constructor(root, app, services) {
    this.root = root;
    this.app = app;
    this.svc = services; // { openFile(file), reimport(patch) }
    const saved = prefs.get('mode', 'vitrine');
    this.mode = saved === 'atelier' ? 'atelier' : 'vitrine';
    this.locked = false; // lien client : l'interface ne peut pas quitter le mode client
    this.customHex = { metal: '#d8b45a', gem: '#4a7de0' };
    this.tab = 'metals';
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
        <div class="brand"><span class="mark">◇</span><span>${t('app')}</span></div>
        <div class="spacer"></div>
        <div class="seg" role="group" aria-label="Mode">
          <button data-mode="client">${t('modeClient')}</button>
          <button data-mode="vitrine">${t('modeVitrine')}</button>
          <button data-mode="atelier">${t('modeAtelier')}</button>
        </div>
        <button class="btn small client-exit" data-a="exit-client">✕ ${t('exitPreview')}</button>
        <button class="icon-btn" data-a="undo" aria-label="${t('undo')}" title="${t('undo')}">↶</button>
        <button class="icon-btn" data-a="redo" aria-label="${t('redo')}" title="${t('redo')}">↷</button>
        <button class="icon-btn" data-a="open" aria-label="${t('open')}" title="${t('open')}">⤒</button>
      </header>
      <main class="main">
        <section class="viewport" id="viewport">
          <div class="viewer-mount"></div>
          <div class="hud-chip" data-r="info"></div>
          <div class="hud-right">
            <button class="icon-btn" data-pop-btn="views" aria-label="${t('views')}" title="${t('views')}">◫</button>
            <button class="icon-btn" data-pop-btn="env" aria-label="${t('environment')}" title="${t('environment')}">☀</button>
            <button class="icon-btn" data-a="autorotate" aria-pressed="false" aria-label="${t('autoRotate')}" title="${t('autoRotate')}">⟳</button>
            <button class="icon-btn" data-a="present" aria-pressed="false" aria-label="${t('present')}" title="${t('present')}">⛶</button>
          </div>
          <button class="btn present-exit" data-a="present-exit" aria-label="${t('exitPresent')}">✕ ${t('exitPresent')}</button>
          <div class="pop" data-pop="views" hidden></div>
          <div class="pop" data-pop="env" hidden></div>
          <div class="hint" data-r="hint">${t('tapHint')}</div>
          <div class="drop" hidden>${t('dropHere')}</div>
          <div class="progress" hidden><div class="bar"><i></i></div><span></span></div>
        </section>
        <aside class="panel">
          <div class="p-section zones">
            <div class="p-head"><h3>${t('zones')}</h3>
              <div class="tools" style="margin:0">
                <button class="btn small" data-a="multi" aria-pressed="false">${t('multi')}</button>
                <button class="btn small" data-a="fine" aria-pressed="false">${t('fine')}</button>
              </div></div>
            <div class="zone-chips" data-r="zones"></div>
            <div class="tools" data-r="seltools"></div>
          </div>
          <div class="p-section mats">
            <div class="p-head"><h3>${t('materials')}</h3>
              <div class="tabs" role="tablist">
                <button role="tab" data-tab="metals">${t('metals')}</button>
                <button role="tab" data-tab="gems">${t('gems')}</button>
              </div></div>
            <p class="palette-title" data-r="ptitle"></p>
            <div class="palette" data-r="palette" role="listbox"></div>
            <div class="custom" data-r="custom" hidden></div>
            <div data-r="finishes-wrap">
              <p class="palette-title">${t('finishes')}</p>
              <div class="palette" data-r="finishes"></div>
            </div>
          </div>
          <div class="p-section atelier-only" data-r="atelier"></div>
          <nav class="actions" aria-label="Actions">
            <button class="btn" data-a="variants">❖ ${t('variants')}</button>
            <button class="btn" data-a="share">↗ ${t('share')}</button>
            <button class="btn" data-a="photo">◎ ${t('photo')}</button>
            <button class="btn" data-a="recap">☰ ${t('recap')}</button>
            <button class="btn" data-a="ar">◈ ${t('ar')}</button>
            <button class="btn primary" data-a="tryon">☝ ${t('tryon')}</button>
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
    $('[data-a=multi]', this.root).setAttribute('aria-pressed', String(this.app.multi));
    $('[data-a=fine]', this.root).setAttribute('aria-pressed', String(this.app.granularity === 'piece'));
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

  swatchOf(zone) {
    return swatchOf(zone.type === 'gem' ? 'gem' : 'metal', this.app.assign[zone.pieceIds[0]]);
  }

  renderZones() {
    const box = $('[data-r=zones]', this.root);
    const sel = this.app.selection;
    box.innerHTML = this.app.zones.map((z) => {
      const on = z.pieceIds.length > 0 && z.pieceIds.every((id) => sel.has(id));
      const hid = z.pieceIds.every((id) => this.app.hidden.has(id));
      return `<button class="zchip ${hid ? 'is-hidden' : ''}" data-zone="${esc(z.id)}" aria-pressed="${on}"><i style="--sw:${this.swatchOf(z)}"></i>${esc(z.name)}</button>`;
    }).join('');
    const tools = $('[data-r=seltools]', this.root);
    tools.innerHTML = sel.size ? `<button class="btn small" data-a="similar">${t('similar')}</button><button class="btn small" data-a="clearsel">✕</button>` : '';
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
      return `<button class="dot ${extra}" role="option" data-mat="${item.id}" aria-label="${esc(item.name)}" aria-pressed="${pressed}" title="${esc(item.name)}"><span style="--sw:${item.swatch ?? '#bbb'}"></span></button>`;
    };
    const groups = GEM_GROUPS.map((g) => {
      const items = list.filter((x) => x.group === g.id);
      return items.length ? `<div class="dots" role="group" aria-label="${esc(g.name)}">${items.map((x) => dot(x, x.id === sameM)).join('')}</div>` : '';
    }).join('');
    return groups;
  }

  renderPalette() {
    const app = this.app;
    const kind = app.selectionKind();
    if (kind === 'metal') this.tab = 'metals'; else if (kind === 'gem') this.tab = 'gems';
    this.root.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === this.tab)));
    const ids = [...app.selection];
    const assigns = ids.map((i) => app.assign[i]).filter(Boolean);
    const sameM = assigns.length && assigns.every((a) => a.m === assigns[0].m) ? assigns[0].m : null;
    const sameF = assigns.length && assigns.every((a) => a.f === assigns[0].f) ? assigns[0].f : null;
    const palette = $('[data-r=palette]', this.root);
    const finWrap = $('[data-r=finishes-wrap]', this.root);
    const title = $('[data-r=ptitle]', this.root);
    const enabled = kind && kind !== 'mixed' && ((kind === 'metal' && this.tab === 'metals') || (kind === 'gem' && this.tab === 'gems'));
    const allowed = enabled ? this.allowedFor(kind) : null;
    let list = this.tab === 'metals' ? METALS : GEMS;
    if (allowed) list = list.filter((x) => allowed.includes(x.id));
    const sameC = assigns.length && assigns.every((a) => a.m === CUSTOM && a.c === assigns[0].c) ? assigns[0].c : null;
    const customOn = !allowed || allowed.includes(CUSTOM);
    palette.innerHTML = this.tab === 'gems'
      ? this.gemDots(list, sameM) + (customOn ? `<button class="dot custom-dot" role="option" data-mat="${CUSTOM}" aria-label="${t('customColor')}" aria-pressed="${sameM === CUSTOM}" title="${t('customColor')}"><span></span></button>` : '')
      : list.map((m) => this.ball(m, this.tab, m.id === sameM)).join('')
        + (customOn ? `<button class="ball" role="option" data-mat="${CUSTOM}" aria-label="${t('customColor')}" aria-pressed="${sameM === CUSTOM}" title="${t('customColor')}"><span class="b custom-b"></span><span class="n">${t('customColor')}</span></button>` : '');
    palette.classList.toggle('gems', this.tab === 'gems');
    palette.classList.toggle('dim', !enabled);
    this.renderCustom(this.tab === 'gems' ? 'gem' : 'metal', enabled && customOn, sameM === CUSTOM ? sameC : null);
    finWrap.hidden = this.tab !== 'metals';
    $('[data-r=finishes]', this.root).innerHTML = FINISHES.map((f) => this.ball(f, 'finishes', f.id === sameF)).join('');
    $('[data-r=finishes]', this.root).classList.toggle('dim', !enabled);
    title.textContent = !kind ? t('nothingSelected') + ' — ' + t('tapHint')
      : kind === 'mixed' ? t('selected') + ' : ' + t('typeMetal') + ' + ' + t('typeGem')
      : (enabled ? `${t('selected')} : ${ids.length} ${t('pieces')}${sameM ? ' · ' + describeAssignment({ m: sameM, f: sameF, c: sameC }, kind) : ''}` : '');
  }

  /** Sélecteur de teinte libre : couleur native + code + teinte / intensité / clarté. */
  renderCustom(kind, show, hexIn) {
    const box = $('[data-r=custom]', this.root);
    if (this._dragging) return; // ne pas reconstruire les curseurs pendant un glissement
    if (!show) { box.hidden = true; box.innerHTML = ''; return; }
    const hex = hexIn ?? this.customHex[kind];
    const [h, s, l] = hexToHsl(hex);
    box.hidden = false;
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
    if (box && !box.hidden) {
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
    const zone = tgt.closest('[data-zone]');
    if (zone) {
      const z = app.zoneById(zone.dataset.zone);
      const allIn = z.pieceIds.every((id) => app.selection.has(id));
      if (app.multi) allIn ? app.select([...app.selection].filter((id) => !z.pieceIds.includes(id))) : app.selectZone(z.id, true);
      else app.selectZone(z.id);
      app.viewer.invalidate();
      return;
    }
    const mat = tgt.closest('[data-mat]');
    if (mat) { app.applyToSelection({ m: mat.dataset.mat }); return; }
    const fin = tgt.closest('[data-finish]');
    if (fin) { app.applyToSelection({ f: fin.dataset.finish }); return; }
    const tab = tgt.closest('[data-tab]');
    if (tab) { this.tab = tab.dataset.tab; this.renderPalette(); return; }
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
      case 'multi': app.multi = !app.multi; this.renderAll(); break;
      case 'fine': app.granularity = app.granularity === 'zone' ? 'piece' : 'zone'; this.renderAll(); break;
      case 'similar': app.selectSimilar(); break;
      case 'clearsel': app.clearSelection(); break;
      case 'autorotate': this.autorotate = !(el.getAttribute('aria-pressed') === 'true'); el.setAttribute('aria-pressed', String(this.autorotate)); app.viewer.setAutoRotate(this.autorotate); break;
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
      case 'variants': this.openVariants(); break;
      case 'share': this.openShare(); break;
      case 'photo': this.takePhoto(); break;
      case 'recap': this.openRecap(); break;
      case 'ar': this.openAR(); break;
      case 'tryon': this.tryon.open(); break;
    }
  }

  /** Plein écran : sur iPhone (pas d'API Fullscreen) l'interface se réduit à la vue 3D + un bouton de sortie visible. */
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
    if (this.locked) m = 'client';
    this.mode = m;
    if (m !== 'client') prefs.set('mode', m);
    this.app.viewer.setAutoRotate(m !== 'atelier' && this.autorotate !== false);
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

  /** Génère les billes (WebGL temporaire) puis rafraîchit la palette. */
  loadThumbnails() {
    setTimeout(() => { try { this.thumbs = renderThumbnails(112); } catch { /* repli : pastilles de couleur CSS */ } this.renderPalette(); }, 60);
  }
}
