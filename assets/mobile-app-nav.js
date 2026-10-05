/* One navigation order shared by every public page. */
(() => {
  const page = location.pathname.split('/').pop() || 'index.html';
  const nav = document.createElement('nav');
  nav.className = 'mobile-app-nav';
  nav.setAttribute('aria-label', 'Navegación móvil');
  const svg = paths => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none">${paths}</svg>`;
  const link = (file, label, icon) => `<a class="mobile-app-nav__button${page === file ? ' is-active' : ''}" href="${file}" aria-label="${label}" title="${label}"${page === file ? ' aria-current="page"' : ''}>${icon}</a>`;
  const maps = ['mapa_desarrollo_urbano.html', 'mapa_fiscalidad_mejorada.html'];
  nav.innerHTML = `<div class="mobile-app-nav__inner">
    ${link('index.html', 'Inicio', '<img class="mobile-app-nav__logo" src="assets/brand/vivienda-thinktank-logo-final.png" alt="">')}
    ${link('vivienda_simulator.html', 'Vivienda Simulator', svg('<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8"/>'))}
    ${link('simulador_total.html', 'Calculadora de alquiler regulado', svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"/>'))}
    <div class="mobile-map-picker">
      <div class="mobile-map-menu" id="mobile-map-menu" hidden>
        ${link(maps[0], 'Desarrollo urbano', svg('<path d="M5 20h14M7 20V6h10v14M10 9h1M13 9h1M10 13h1M13 13h1"/>') + '<span>Desarrollo urbano</span>')}
        ${link(maps[1], 'Fiscalidad rural', svg('<path d="M3 12 9 6l6 6M5 10v9h8v-9M17 3v18M14 6h6M14 18h6"/>') + '<span>Fiscalidad rural</span>')}
      </div>
      <button class="mobile-app-nav__button${maps.includes(page) ? ' is-active' : ''}" id="mobile-map-toggle" type="button" aria-expanded="false" aria-controls="mobile-map-menu" aria-label="Abrir mapas" title="Mapas">${svg('<path d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2V6ZM9 4v14M15 6v14"/>')}</button>
    </div>
  </div>`;
  document.body.append(nav);
  const toggle = nav.querySelector('#mobile-map-toggle');
  const menu = nav.querySelector('#mobile-map-menu');
  const close = () => {
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  };
  toggle.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    toggle.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.mobile-map-picker')) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) {
      close();
      toggle.focus();
    }
  });
})();
