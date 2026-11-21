(function () {
  const { templates, esc } = window.Paraphe;
  const $ = (s) => document.querySelector(s);
  const form = $("#form");
  const KEY = "paraphe:data", KITS = "paraphe:kits";

  const SAMPLE = {
    name: "Camille Durand", title: "Directrice artistique", company: "Studio Lumen",
    email: "camille@lumen.fr", phone: "+33 6 12 34 56 78", website: "lumen.fr", address: "",
    linkedin: "", instagram: "", x: "", photo: "", logo: "", round: true,
    color: "#2f5bea", font: "Arial, Helvetica, sans-serif", tagline: "", template: "meridien",
  };

  const store = {
    get(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  let state = { ...SAMPLE, ...store.get(KEY, {}) };

  function fillForm() {
    for (const el of form.elements) {
      if (!el.name) continue;
      if (el.type === "checkbox") el.checked = !!state[el.name];
      else el.value = state[el.name] ?? "";
    }
  }
  function readForm() {
    for (const el of form.elements) {
      if (!el.name) continue;
      state[el.name] = el.type === "checkbox" ? el.checked : el.value;
    }
  }
  const current = () => templates.find((t) => t.id === state.template) || templates[0];
  const html = () => current().render(state).trim();

  function render() {
    $("#preview").innerHTML = html();
    document.querySelectorAll(".tpl").forEach((b) => b.setAttribute("aria-pressed", b.dataset.id === state.template));
    store.set(KEY, state);
  }

  // Galerie de modèles
  function renderGallery() {
    $("#tplCount").textContent = `${templates.length} modèles gratuits`;
    $("#templates").innerHTML = templates.map((t) => `
      <button class="tpl" type="button" data-id="${t.id}" aria-pressed="false">
        <div class="thumb"><div>${t.render({ ...state, ...(state.name ? {} : SAMPLE) })}</div></div>
        <div class="meta"><span>${esc(t.name)}</span><small>${esc(t.cat)}</small></div>
      </button>`).join("");
  }
  $("#templates").addEventListener("click", (e) => {
    const b = e.target.closest(".tpl"); if (!b) return;
    state.template = b.dataset.id; render();
    $("#editeur").scrollIntoView({ behavior: "smooth" });
  });

  let galleryTimer;
  form.addEventListener("input", () => {
    readForm(); render();
    clearTimeout(galleryTimer); galleryTimer = setTimeout(renderGallery, 300);
  });
  $("#reset").addEventListener("click", () => {
    state = { ...SAMPLE, template: state.template }; fillForm(); render(); renderGallery();
  });

  // Copie / export
  function toast(msg) { const t = $("#toast"); t.textContent = msg; clearTimeout(toast.t); toast.t = setTimeout(() => (t.textContent = ""), 2500); }
  $("#copy").addEventListener("click", async () => {
    const h = html();
    try {
      await navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([h], { type: "text/html" }),
        "text/plain": new Blob([$("#preview").innerText], { type: "text/plain" }),
      })]);
    } catch {
      const r = document.createRange(); r.selectNodeContents($("#preview"));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand("copy"); s.removeAllRanges();
    }
    toast("Signature copiée — collez-la dans votre messagerie.");
  });
  $("#copyHtml").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(html()); toast("Code HTML copié."); } catch { toast("Copie impossible dans ce navigateur."); }
  });
  $("#download").addEventListener("click", () => {
    const doc = `<!doctype html><html><head><meta charset="utf-8"><title>Signature</title></head><body>${html()}</body></html>`;
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([doc], { type: "text/html" })), download: "signature.html" });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  // Kits de marque
  const KIT_FIELDS = ["color", "font", "company", "logo", "website", "template"];
  let kits = store.get(KITS, []);
  const fontName = (f) => (f || "").split(",")[0].replace(/'/g, "");
  function renderKits() {
    $("#kitList").innerHTML = kits.length ? kits.map((k, i) => `
      <div class="kit">
        <div class="sw" style="background:${/^#[0-9a-f]{6}$/i.test(k.color) ? k.color : "#999"}"></div>
        <div class="info"><b>${esc(k.label)}</b><span>${esc(fontName(k.font))} · ${esc((templates.find((t) => t.id === k.template) || {}).name || "")}</span></div>
        <button class="btn primary" data-apply="${i}">Appliquer</button>
        <button class="btn" data-del="${i}" aria-label="Supprimer ${esc(k.label)}">✕</button>
      </div>`).join("") : `<div class="empty">Aucun kit pour l'instant. Réglez votre style dans l'éditeur, nommez-le et enregistrez-le.</div>`;
    store.set(KITS, kits);
  }
  $("#saveKit").addEventListener("click", () => {
    const label = $("#kitName").value.trim() || state.company || `Kit ${kits.length + 1}`;
    const kit = { label }; KIT_FIELDS.forEach((f) => (kit[f] = state[f]));
    kits.unshift(kit); $("#kitName").value = ""; renderKits(); toast(`Kit « ${label} » enregistré.`);
  });
  $("#kitList").addEventListener("click", (e) => {
    const a = e.target.closest("[data-apply]"), d = e.target.closest("[data-del]");
    if (a) { const k = kits[+a.dataset.apply]; KIT_FIELDS.forEach((f) => k[f] !== undefined && (state[f] = k[f])); fillForm(); render(); renderGallery(); $("#editeur").scrollIntoView({ behavior: "smooth" }); }
    if (d) { kits.splice(+d.dataset.del, 1); renderKits(); }
  });
  $("#exportKits").addEventListener("click", () => {
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([JSON.stringify(kits, null, 2)], { type: "application/json" })), download: "paraphe-kits.json" });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $("#importKits").addEventListener("change", async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const list = (Array.isArray(data) ? data : [data]).filter((k) => k && typeof k === "object")
        .map((k) => { const o = { label: String(k.label || "Kit importé").slice(0, 80) }; KIT_FIELDS.forEach((f) => typeof k[f] === "string" && (o[f] = k[f].slice(0, 500))); return o; });
      kits = list.concat(kits); renderKits(); toast(`${list.length} kit(s) importé(s).`);
    } catch { toast("Fichier JSON invalide."); }
    e.target.value = "";
  });

  fillForm(); renderGallery(); render(); renderKits();
})();
