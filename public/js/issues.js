(function () {
  const container = document.getElementById('issuesContainer');
  const search = document.getElementById('searchInput');
  const fCat = document.getElementById('filterCategory');
  const fStatus = document.getElementById('filterStatus');
  const fPri = document.getElementById('filterPriority');

  // Progress strip above the list
  const statsEl = document.createElement('div');
  statsEl.id = 'issuesStats';
  container.parentNode.insertBefore(statsEl, container);

  let dict = {};
  let currentLang = null;
  let issues = [];
  let stats = null;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cls = s => String(s || '').replace(/\s+/g, '');
  const getLang = () => document.documentElement.lang || 'en';

  function t(key, fallback) {
    const v = key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), dict);
    return typeof v === 'string' ? v : (fallback !== undefined ? fallback : key);
  }

  async function loadDict() {
    currentLang = getLang();
    try {
      const r = await fetch('/locales/' + currentLang + '.json');
      if (!r.ok) throw new Error();
      dict = await r.json();
    } catch (e) {
      try { dict = await (await fetch('/locales/en.json')).json(); } catch (e2) { dict = {}; }
    }
  }

  function fmtDate(d) {
    try { return new Date(d).toLocaleDateString(currentLang || 'en', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (e) { return new Date(d).toLocaleDateString(); }
  }

  function renderStats() {
    if (!stats) { statsEl.innerHTML = ''; return; }
    const total = stats.total || 0;
    const w = n => (total ? (n / total) * 100 : 0);
    const b = stats.byStatus;
    statsEl.innerHTML = `
      <div class="ist-row">
        <div class="ist"><b>${b.Reported}</b><span>${esc(t('statuses.Reported', 'Reported'))}</span></div>
        <div class="ist"><b>${b['In Progress']}</b><span>${esc(t('statuses.In Progress', 'In Progress'))}</span></div>
        <div class="ist"><b>${b.Resolved}</b><span>${esc(t('statuses.Resolved', 'Resolved'))}</span></div>
      </div>
      <div class="ist-bar-wrap">
        <div class="ist-bar">
          <i class="seg-res" style="width:${w(b.Resolved)}%"></i>
          <i class="seg-prog" style="width:${w(b['In Progress'])}%"></i>
          <i class="seg-rep" style="width:${w(b.Reported)}%"></i>
        </div>
        <span class="ist-pct">${stats.resolutionRate}%</span>
      </div>`;
  }

  function renderList() {
    if (!issues.length) {
      container.innerHTML = `<div class="step-card" style="grid-column:1/-1;padding:40px 20px;"><p>${esc(t('issues.no_issues', 'No issues found'))}</p></div>`;
      return;
    }
    container.innerHTML = issues.map(i => {
      const cat = i.category ? t('categories.' + i.category, i.category) : '';
      const pri = i.priority ? `<span class="pbadge p-${cls(i.priority)}">${esc(t('priorities.' + i.priority, i.priority))}</span>` : '';
      const meta = [cat, i.area].filter(Boolean).join(' · ');
      return `
        <article class="issue-card">
          <div class="issue-top"><span class="issue-id">${esc(i.tracking_id)}</span>${pri}</div>
          <h3 class="issue-title">${esc(i.title)}</h3>
          <p class="issue-meta">${esc(meta)}</p>
          <div class="issue-bottom">
            <span class="sbadge s-${cls(i.status)}">${esc(t('statuses.' + i.status, i.status))}</span>
            <span class="issue-date">${esc(fmtDate(i.created_at))}</span>
          </div>
        </article>`;
    }).join('');
  }

  async function loadData() {
    const p = new URLSearchParams();
    if (search.value.trim()) p.set('q', search.value.trim());
    if (fCat.value) p.set('category', fCat.value);
    if (fStatus.value) p.set('status', fStatus.value);
    if (fPri.value) p.set('priority', fPri.value);
    try {
      const [a, s] = await Promise.all([
        fetch('/api/issues?' + p.toString()).then(r => r.json()),
        fetch('/api/issues/stats').then(r => r.json())
      ]);
      issues = a.issues || [];
      stats = s;
    } catch (e) { /* keep what is already shown */ }
    renderStats();
    renderList();
  }

  async function relang() { await loadDict(); renderStats(); renderList(); }

  let timer;
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(loadData, 300); });
  [fCat, fStatus, fPri].forEach(el => el.addEventListener('change', loadData));

  // Re-translate the dynamic cards whenever the language changes
  new MutationObserver(() => { if (getLang() !== currentLang) relang(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  document.addEventListener('change', e => {
    if (e.target.classList && e.target.classList.contains('lang-switcher-select')) {
      setTimeout(() => { if (getLang() !== currentLang) relang(); }, 600);
    }
  });

  (async function init() { await loadDict(); await loadData(); setInterval(loadData, 30000); })();
})();
