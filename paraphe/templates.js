/* Modèles de signature : HTML en tableaux + styles inline (compatibles clients mail). */
(function () {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const url = (u) => {
    u = String(u || "").trim();
    if (!u) return "";
    if (/^(javascript|data|vbscript):/i.test(u)) return "";
    return /^[a-z]+:\/\//i.test(u) ? u : "https://" + u;
  };
  const bare = (u) => String(u || "").replace(/^https?:\/\//i, "").replace(/\/$/, "");

  function parts(d) {
    const c = d.color, f = d.font;
    const link = (href, text, color = "#555") => `<a href="${esc(href)}" style="color:${color};text-decoration:none;">${esc(text)}</a>`;
    const contacts = [];
    if (d.email) contacts.push(link("mailto:" + d.email.trim(), d.email));
    if (d.phone) contacts.push(link("tel:" + d.phone.replace(/[^\d+]/g, ""), d.phone));
    if (d.website) contacts.push(link(url(d.website), bare(d.website)));
    if (d.address) contacts.push(`<span style="color:#555;">${esc(d.address)}</span>`);
    const socials = [["linkedin", "LinkedIn"], ["instagram", "Instagram"], ["x", "X"]]
      .filter(([k]) => url(d[k])).map(([k, n]) => link(url(d[k]), n, c));
    const photo = (size) => url(d.photo)
      ? `<img src="${esc(url(d.photo))}" alt="${esc(d.name)}" width="${size}" height="${size}" style="display:block;width:${size}px;height:${size}px;border-radius:${d.round ? "50%" : "8px"};object-fit:cover;border:0;">` : "";
    const logo = (h) => url(d.logo) ? `<img src="${esc(url(d.logo))}" alt="${esc(d.company)}" height="${h}" style="display:block;height:${h}px;width:auto;border:0;">` : "";
    const base = `font-family:${f};font-size:13px;line-height:1.5;color:#333;`;
    return { c, f, esc, contacts, socials, photo, logo, base, d };
  }

  const T = [];
  const add = (id, name, cat, fn) => T.push({ id, name, cat, render: (d) => fn(parts(d)) });

  add("meridien", "Méridien", "Essentiel", (p) => `
<table cellpadding="0" cellspacing="0" border="0" style="${p.base}"><tr>
${p.photo(80) ? `<td style="padding-right:16px;vertical-align:top;">${p.photo(80)}</td>` : ""}
<td style="border-left:3px solid ${p.c};padding-left:16px;vertical-align:top;">
<div style="font-size:17px;font-weight:bold;color:#111;">${p.esc(p.d.name)}</div>
<div style="color:${p.c};font-weight:bold;">${p.esc(p.d.title)}${p.d.company ? ` · ${p.esc(p.d.company)}` : ""}</div>
<div style="margin-top:6px;">${p.contacts.join("<br>")}</div>
${p.socials.length ? `<div style="margin-top:6px;">${p.socials.join(" &nbsp;·&nbsp; ")}</div>` : ""}
</td></tr></table>`);

  add("ligne", "Ligne", "Essentiel", (p) => `
<table cellpadding="0" cellspacing="0" border="0" style="${p.base}"><tr><td>
<span style="font-size:15px;font-weight:bold;color:#111;">${p.esc(p.d.name)}</span>
<span style="color:#999;"> &nbsp;|&nbsp; </span><span style="color:${p.c};">${p.esc(p.d.title)}</span>
${p.d.company ? `<span style="color:#999;"> &nbsp;|&nbsp; </span><span>${p.esc(p.d.company)}</span>` : ""}
</td></tr><tr><td style="padding-top:4px;font-size:12px;">${p.contacts.concat(p.socials).join(' <span style="color:#ccc;">&nbsp;•&nbsp;</span> ')}</td></tr></table>`);

  add("correspondance", "Correspondance", "Éditorial", (p) => `
<table cellpadding="0" cellspacing="0" border="0" style="${p.base}">
<tr><td style="font-style:italic;color:#666;padding-bottom:10px;">${p.esc(p.d.tagline || "Bien à vous,")}</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:20px;color:#111;">${p.esc(p.d.name)}</td></tr>
<tr><td style="color:${p.c};letter-spacing:1px;text-transform:uppercase;font-size:11px;padding-bottom:8px;">${p.esc(p.d.title)}${p.d.company ? ` — ${p.esc(p.d.company)}` : ""}</td></tr>
<tr><td style="border-top:1px solid #ddd;padding-top:8px;">${p.contacts.join("<br>")}</td></tr>
${p.logo(28) ? `<tr><td style="padding-top:10px;">${p.logo(28)}</td></tr>` : ""}</table>`);

  add("carte", "Carte", "Professionnel", (p) => `
<table cellpadding="0" cellspacing="0" border="0" style="${p.base}background:#f7f7f5;border-radius:10px;"><tr>
<td style="padding:16px 18px;vertical-align:middle;">${p.photo(72) || `<div style="width:72px;height:72px;border-radius:${p.d.round ? "50%" : "8px"};background:${p.c};color:#fff;font-size:28px;font-weight:bold;text-align:center;line-height:72px;">${p.esc((p.d.name || "?").trim().charAt(0).toUpperCase())}</div>`}</td>
<td style="padding:16px 18px 16px 0;vertical-align:middle;">
<div style="font-size:16px;font-weight:bold;color:#111;">${p.esc(p.d.name)}</div>
<div style="color:#666;">${p.esc(p.d.title)}</div>
${p.d.company ? `<div style="color:${p.c};font-weight:bold;">${p.esc(p.d.company)}</div>` : ""}
<div style="margin-top:6px;font-size:12px;">${p.contacts.join("<br>")}</div>
</td></tr></table>`);

  add("bandeau", "Bandeau", "Professionnel", (p) => `
<table cellpadding="0" cellspacing="0" border="0" style="${p.base}min-width:320px;">
<tr><td style="background:${p.c};color:#fff;padding:12px 16px;border-radius:8px 8px 0 0;">
<div style="font-size:16px;font-weight:bold;">${p.esc(p.d.name)}</div>
<div style="opacity:.9;">${p.esc(p.d.title)}${p.d.company ? ` · ${p.esc(p.d.company)}` : ""}</div></td></tr>
<tr><td style="border:1px solid #e5e5e5;border-top:0;padding:10px 16px;border-radius:0 0 8px 8px;">
${p.contacts.join(" &nbsp;·&nbsp; ")}${p.socials.length ? `<br>${p.socials.join(" &nbsp;·&nbsp; ")}` : ""}</td></tr></table>`);

  add("minimal", "Minimal", "Essentiel", (p) => `
<table cellpadding="0" cellspacing="0" border="0" style="${p.base}">
<tr><td style="color:#111;font-weight:bold;">${p.esc(p.d.name)}</td></tr>
<tr><td style="color:#777;">${p.esc([p.d.title, p.d.company].filter(Boolean).join(", "))}</td></tr>
<tr><td style="padding-top:4px;">${p.contacts.join("<br>")}</td></tr></table>`);

  add("atelier", "Atelier", "Créatif", (p) => `
<table cellpadding="0" cellspacing="0" border="0" style="${p.base}"><tr>
<td style="vertical-align:top;padding-right:18px;">
${p.logo(36) ? `<div style="padding-bottom:8px;">${p.logo(36)}</div>` : ""}
<div style="font-family:Georgia,serif;font-size:22px;color:#111;line-height:1.2;">${p.esc(p.d.name)}</div>
<div style="color:#777;">${p.esc(p.d.title)}</div>
${url(p.d.website) ? `<div style="padding-top:10px;"><a href="${p.esc(url(p.d.website))}" style="display:inline-block;background:${p.c};color:#fff;text-decoration:none;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:bold;">Voir mon travail →</a></div>` : ""}
</td><td style="vertical-align:top;border-left:1px solid #e5e5e5;padding-left:18px;font-size:12px;">
${p.contacts.join("<br>")}${p.socials.length ? `<br><br>${p.socials.join("<br>")}` : ""}</td></tr></table>`);

  add("signal", "Signal", "Créatif", (p) => `
<table cellpadding="0" cellspacing="0" border="0" style="${p.base}">
<tr><td style="font-size:20px;font-weight:bold;color:${p.c};padding-bottom:6px;">${p.esc(p.d.tagline || "Ravi de vous rencontrer.")}</td></tr>
<tr><td><table cellpadding="0" cellspacing="0" border="0"><tr>
${p.photo(56) ? `<td style="padding-right:12px;vertical-align:middle;">${p.photo(56)}</td>` : ""}
<td style="vertical-align:middle;"><b style="color:#111;">${p.esc(p.d.name)}</b><br><span style="color:#777;">${p.esc(p.d.title)}${p.d.company ? ` · ${p.esc(p.d.company)}` : ""}</span></td>
</tr></table></td></tr>
<tr><td style="padding-top:8px;font-size:12px;">${p.contacts.join(" &nbsp;/&nbsp; ")}</td></tr></table>`);

  add("colonne", "Colonne", "Éditorial", (p) => `
<table cellpadding="0" cellspacing="0" border="0" style="${p.base}text-align:center;"><tr><td align="center">
${p.photo(64) ? `<div style="padding-bottom:8px;"><center>${p.photo(64)}</center></div>` : ""}
<div style="font-size:16px;font-weight:bold;color:#111;">${p.esc(p.d.name)}</div>
<div style="color:${p.c};text-transform:uppercase;letter-spacing:2px;font-size:10px;">${p.esc(p.d.title)}</div>
<div style="width:40px;height:2px;background:${p.c};margin:8px auto;font-size:0;line-height:0;">&nbsp;</div>
<div style="font-size:12px;">${p.contacts.join("<br>")}</div>
${p.socials.length ? `<div style="padding-top:6px;font-size:12px;">${p.socials.join(" · ")}</div>` : ""}
</td></tr></table>`);

  add("monogramme", "Monogramme", "Professionnel", (p) => {
    const ini = (p.d.company || p.d.name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
    return `
<table cellpadding="0" cellspacing="0" border="0" style="${p.base}"><tr>
<td style="vertical-align:middle;padding-right:14px;">${p.logo(48) || `<div style="width:52px;height:52px;border:2px solid ${p.c};color:${p.c};font-family:Georgia,serif;font-size:20px;font-weight:bold;text-align:center;line-height:48px;border-radius:6px;">${p.esc(ini)}</div>`}</td>
<td style="vertical-align:middle;"><div style="font-weight:bold;color:#111;font-size:15px;">${p.esc(p.d.name)}</div>
<div style="color:#777;">${p.esc(p.d.title)}</div>
<div style="font-size:12px;padding-top:4px;">${p.contacts.join(" · ")}</div></td></tr></table>`;
  });

  window.Paraphe = { templates: T, esc };
})();
