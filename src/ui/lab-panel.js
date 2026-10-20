// Atelier d'or : feuille de réglages PBR + éclairage ambiant, appliquée en direct aux métaux sélectionnés (ou à tous les métaux).
// Le joaillier règle, voit la bague changer, puis enregistre sa texture sous son propre nom (bibliothèque de l'appareil).
import { LAB, LAB_DEFAULT, LAB_GROUPS, LAB_LIGHT_GROUP, sanitizeLab, sanitizeLight, listLabs, saveLab, deleteLab, refreshLabs } from '../materials/lab.js';
import { resolveMetal, rgbToHex, FINISHES } from '../materials/library.js';
import { ENVIRONMENTS } from '../core/environments.js';
import { LANG } from './i18n.js';

const I = LANG === 'en' ? 1 : 0;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TX = {
  title: ['Atelier d’or', 'Gold lab'],
  intro: ['Réglez la matière en direct sur la bague ; elle s’applique aux métaux sélectionnés (sinon à tous). Les textures enregistrées sont partagées avec tous les joailliers de l’atelier.', 'Tune the material live on the ring; it applies to the selected metals (otherwise all). Saved textures are shared with every jeweller of the workshop.'],
  name: ['Nom de la texture', 'Texture name'], save: ['Enregistrer', 'Save'], saved: ['Texture enregistrée', 'Texture saved'],
  noName: ['Donnez un nom à votre texture.', 'Give your texture a name.'], full: ['Enregistrement impossible (droits ou connexion).', 'Cannot save (rights or connection).'],
  mine: ['Mes textures', 'My textures'], none: ['Aucune texture enregistrée.', 'No saved texture yet.'],
  load: ['Charger', 'Load'], del: ['Supprimer', 'Delete'], reset: ['Réinitialiser', 'Reset'], close: ['Fermer', 'Close'],
  withLight: ['Enregistrer aussi l’éclairage', 'Also save the lighting'],
  delFail: ['Suppression refusée pour votre compte.', 'Deletion not allowed for your account.'],
  env: ['Environnement', 'Environment'], delAsk: ['Supprimer cette texture ?', 'Delete this texture?'],
};
const tx = (k) => TX[k][I];
const num = (v, step) => (step >= 1 ? String(Math.round(v)) : (+v).toFixed(step < 0.1 ? 2 : 1));

/** État de départ : la matière actuelle de la sélection (une texture sur mesure telle quelle, un or de la palette converti en réglages). */
function startFrom(assign) {
  if (assign?.m === LAB) return sanitizeLab(assign.l);
  const r = resolveMetal(assign);
  const c = (x) => Math.round((x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055) * 255);
  const tex = { satin: 'satin', brushed: 'brushed', hammered: 'hammered' }[assign?.f] ?? 'none';
  const fin = FINISHES.find((f) => f.id === assign?.f);
  return sanitizeLab({ ...LAB_DEFAULT, color: rgbToHex(c(r.rgb[0]), c(r.rgb[1]), c(r.rgb[2])), roughness: r.fin.roughness ?? LAB_DEFAULT.roughness, tex, texI: assign?.i ?? fin?.i0 ?? 0.5 });
}

export class LabPanel {
  constructor(ui) {
    this.ui = ui; this.app = ui.app;
    this.el = document.createElement('section');
    this.el.className = 'lab'; this.el.hidden = true; this.el.setAttribute('aria-label', tx('title'));
    (ui.root.querySelector('.panel') ?? ui.root).after(this.el); // dans la grille de mise en page, juste sous la vue 3D
    this.el.addEventListener('input', (e) => this.onInput(e));
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.openG = new Set(['base']);
    this.withLight = true;
  }

  get isOpen() { return !this.el.hidden; }

  /** Pièces visées : métaux sélectionnés, à défaut tous les métaux de la bague. */
  targets() {
    const a = this.app;
    const sel = [...a.selection].filter((id) => a.pieceById(id)?.kind === 'metal');
    return sel.length ? sel : a.pieces.filter((p) => p.kind === 'metal').map((p) => p.id);
  }

  open(preset = null) {
    this.ids = this.targets();
    if (!this.ids.length) return;
    this.l = preset ? sanitizeLab(preset.l) : startFrom(this.app.assign[this.ids[0]]);
    this.name = preset?.name ?? this.l.n ?? '';
    this.light0 = this.app.viewer.getLight();
    if (preset?.light) this.applyLight(preset.light);
    this.el.hidden = false;
    this.ui.el.dataset.lab = '1';
    this.render(); this.push(true);
    refreshLabs().then(() => { if (this.isOpen) this.render(); }); // textures de l'atelier (partagées avec les autres joailliers)
    this.ui.toggleLabBodyClass?.(true);
  }

  close() {
    if (!this.isOpen) return;
    this.push(true, true); // historique : une seule étape pour toute la séance de réglage
    this.el.hidden = true;
    delete this.ui.el.dataset.lab;
    this.ui.renderAll?.();
  }

  /** Applique la texture courante aux pièces visées (temps réel, sans historique tant que la feuille est ouverte). */
  push(animate = false, record = false) {
    this.app.applyMaterial(this.ids, { m: LAB, l: { ...this.l, ...(this.name ? { n: this.name } : {}) } }, { record, animate });
  }

  applyLight(light) {
    const v = this.app.viewer;
    if (light.env) v.setEnvironment(light.env);
    if (light.envRot != null) v.setEnvironmentRotation(light.envRot);
    v.setLight({ n: light.n ?? 1, x: light.x ?? 1 });
  }

  currentLight() {
    const v = this.app.viewer;
    return { env: v.envId, envRot: Math.round((v.scene.environmentRotation.y * 180) / Math.PI), ...v.getLight() };
  }

  fieldHtml(f, val, prefix = '') {
    const lab = esc(f.label[I]);
    if (f.type === 'color') return `<label class="lf lf-color"><span>${lab}</span><input type="color" data-lf="${prefix}${f.k}" value="${val}"></label>`;
    if (f.type === 'select') return `<label class="lf"><span>${lab}</span><select data-lf="${prefix}${f.k}">${f.options.map(([v, n]) => `<option value="${v}" ${v === val ? 'selected' : ''}>${esc(n[I])}</option>`).join('')}</select></label>`;
    return `<label class="lf"><span>${lab}<output>${num(val, f.step)}</output></span><input type="range" data-lf="${prefix}${f.k}" min="${f.min}" max="${f.max}" step="${f.step}" value="${val}"></label>`;
  }

  render() {
    const vw = this.app.viewer, lt = vw.getLight();
    const rot = Math.round((vw.scene.environmentRotation.y * 180) / Math.PI);
    const lightVals = { n: lt.n, x: lt.x, envRot: rot };
    const group = (g, body) => `<details class="lg" data-g="${g.id}" ${this.openG.has(g.id) ? 'open' : ''}><summary>${esc(g.title[I])}</summary><div class="lg-b">${body}</div></details>`;
    const labs = listLabs();
    this.el.innerHTML = `
      <header class="lab-h"><h3>${tx('title')}</h3><button class="icon-btn" data-lab-a="close" aria-label="${tx('close')}" title="${tx('close')}">✕</button></header>
      <div class="lab-b">
        <p class="lab-note">${tx('intro')}</p>
        <div class="lab-save">
          <input type="text" data-lname maxlength="40" placeholder="${esc(tx('name'))}" value="${esc(this.name)}" autocomplete="off" spellcheck="false" aria-label="${esc(tx('name'))}">
          <button class="btn primary small" data-lab-a="save">${tx('save')}</button>
        </div>
        <label class="lab-chk"><input type="checkbox" data-lwl ${this.withLight ? 'checked' : ''}> ${tx('withLight')}</label>
        <div class="lab-mine"><h4>${tx('mine')}</h4>${labs.length ? labs.map((p) => `<div class="lab-row"><i style="--sw:${p.l.color}"></i><span>${esc(p.name)}${p.by ? `<small>${esc(p.by)}</small>` : ''}</span><button class="btn small" data-lab-a="load" data-id="${p.id}">${tx('load')}</button><button class="icon-btn small" data-lab-a="del" data-id="${p.id}" aria-label="${tx('del')}" title="${tx('del')}">🗑</button></div>`).join('') : `<p class="lab-empty">${tx('none')}</p>`}</div>
        ${LAB_GROUPS.map((g) => group(g, g.fields.map((f) => this.fieldHtml(f, this.l[f.k])).join(''))).join('')}
        ${group(LAB_LIGHT_GROUP, `<div class="lab-envs">${ENVIRONMENTS.map((e) => `<button class="btn small ${vw.envId === e.id ? 'primary' : ''}" data-lab-a="env" data-lenv="${e.id}">${esc(e.name)}</button>`).join('')}</div>`
          + LAB_LIGHT_GROUP.fields.map((f) => this.fieldHtml(f, lightVals[f.k], 'L:')).join(''))}
        <button class="btn small lab-reset" data-lab-a="reset">${tx('reset')}</button>
      </div>`;
  }

  onInput(e) {
    const el = e.target;
    if (el.matches('[data-lname]')) { this.name = el.value.slice(0, 40); return; }
    if (el.matches('[data-lwl]')) { this.withLight = el.checked; return; }
    const k = el.dataset.lf; if (!k) return;
    const out = el.closest('.lf')?.querySelector('output');
    const v = el.type === 'range' ? +el.value : el.value;
    if (out) out.textContent = num(v, +el.step || 1);
    if (k.startsWith('L:')) {
      const key = k.slice(2), vw = this.app.viewer;
      if (key === 'envRot') vw.setEnvironmentRotation(v); else vw.setLight({ [key]: v });
      return;
    }
    this.l = sanitizeLab({ ...this.l, [k]: v });
    this.push(false);
  }

  async onClick(e) {
    const g = e.target.closest('summary')?.parentElement; if (g?.dataset.g) { setTimeout(() => (g.open ? this.openG.add(g.dataset.g) : this.openG.delete(g.dataset.g)), 0); return; }
    const b = e.target.closest('[data-lab-a]'); if (!b) return;
    const a = b.dataset.labA;
    if (a === 'close') this.close();
    else if (a === 'reset') { this.l = startFrom(null); this.push(false); this.render(); }
    else if (a === 'env') { await this.app.viewer.setEnvironment(b.dataset.lenv); this.render(); }
    else if (a === 'save') {
      const name = (this.name || '').trim();
      if (!name) { this.ui.toast(tx('noName')); return; }
      this.name = name; this.l = sanitizeLab({ ...this.l, n: name });
      const list = await saveLab(name, this.l, this.withLight ? this.currentLight() : null);
      if (!list) { this.ui.toast(tx('full')); return; }
      this.push(false);
      this.ui.toast(tx('saved')); this.render();
    } else if (a === 'load') {
      const p = listLabs().find((x) => x.id === b.dataset.id); if (!p) return;
      this.l = sanitizeLab(p.l); this.name = p.name;
      if (p.light) this.applyLight(sanitizeLight(p.light));
      this.push(false); this.render();
    } else if (a === 'del') {
      if (!confirm(tx('delAsk'))) return;
      if (!(await deleteLab(b.dataset.id))) this.ui.toast(tx('delFail')); this.render();
    }
  }
}
