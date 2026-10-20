/* Novex UX directions: one local state, one rendered wallet, no financial API.
 * Fixture provenance: packages/core/src/wallet-product-demo.ts and
 * apps/miniapp/src/mono-product/demo-activity.ts. SVG strokes reuse WalletIcon.
 */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const number = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const quantity = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 8 });
const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
const variants = {
  a: { title: 'Тихий обзор', caption: 'Воздух вокруг главного', detail: 'Общий баланс первым. Четыре компактных действия рядом, средства — на следующем уровне.' },
  b: { title: 'Два действия', caption: 'Чёткий приоритет', detail: 'Отправить и получить крупнее. Покупка и обмен остаются рядом, но не спорят за внимание.' },
  c: { title: 'Единая карточка', caption: 'Всё главное на одной плоскости', detail: 'Баланс и четыре действия объединены. Одна поверхность задаёт спокойный ритм экрану.' },
};
const assets = {
  btc: { name: 'Bitcoin', symbol: 'BTC', amount: .12, fiat: 8040.25, networks: ['Bitcoin'], available: { Bitcoin: .12 } },
  eth: { name: 'Ethereum', symbol: 'ETH', amount: 1.1, fiat: 3900.50, networks: ['Ethereum'], available: { Ethereum: null } },
  usdc: { name: 'USD Coin', symbol: 'USDC', amount: 900, fiat: 900, networks: ['Ethereum', 'Solana'], available: { Ethereum: 500, Solana: 400 } },
};
const activities = [
  { id: 'btc-received', asset: 'btc', amount: .0042, direction: 'incoming', status: 'completed', network: 'Bitcoin', date: '2026-09-27T12:00:00.000Z' },
  { id: 'eth-sent', asset: 'eth', amount: .12, direction: 'outgoing', status: 'completed', network: 'Ethereum', date: '2026-09-27T10:15:00.000Z' },
  { id: 'usdc-pending', asset: 'usdc', amount: 48.2, direction: 'incoming', status: 'pending', network: 'Ethereum', date: '2026-09-26T17:30:00.000Z' },
  { id: 'usdc-failed', asset: 'usdc', amount: 12.345, direction: 'outgoing', status: 'failed', network: 'Solana', date: '2026-09-25T08:45:00.000Z' },
];
const actionLabels = { send: 'Отправить', receive: 'Получить', swap: 'Обмен', buy: 'Купить' };
const statusLabels = { completed: 'Выполнено', pending: 'В обработке', failed: 'Не выполнено' };
const paths = {
  send: '<path d="M5 6.2 19.2 12 5 17.8l3.6-5.8Z"/><path d="M8.6 12h10.6"/>',
  receive: '<path d="M12 5.2v9.2m-3.8-3.6 3.8 3.8 3.8-3.8M5.6 16.4v1.6A1.4 1.4 0 0 0 7 19.4h10a1.4 1.4 0 0 0 1.4-1.4v-1.6"/>',
  swap: '<path d="M7 8.2h10m-2.6-2.6 3.2 2.6-3.2 2.6M17 15.8H7m2.6-2.6-3.2 2.6 3.2 2.6"/>',
  buy: '<path d="M7.2 8.6h9.6l-.8 10.2H8ZM9.2 8.6V7.4a2.8 2.8 0 0 1 5.6 0v1.2"/>',
  home: '<path d="m4.8 11.4 7.2-6.2 7.2 6.2M7.2 10.6v8.2h9.6v-8.2"/>',
  assets: '<circle cx="12" cy="12" r="7.2"/><path d="M12 4.8v7.2h7.2"/>',
  history: '<path d="M4 12a8 8 0 1 0 3-6M4 4v5h5m3-2v5l3 2"/>',
  menu: '<path d="M5 6h14M5 12h14M5 18h14"/>',
  eye: '<path d="M3.8 12s3.1-6.1 8.2-6.1 8.2 6.1 8.2 6.1-3.1 6.1-8.2 6.1S3.8 12 3.8 12Z"/><circle cx="12" cy="12" r="2.35"/>',
  hidden: '<path d="M3.8 12s3.1-6.1 8.2-6.1 8.2 6.1 8.2 6.1-3.1 6.1-8.2 6.1S3.8 12 3.8 12ZM4 4l16 16"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="m14 6-6 6 6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  search: '<circle cx="10.6" cy="10.6" r="5.1"/><path d="m14.5 14.5 4.2 4.2"/>',
  support: '<circle cx="12" cy="12" r="8"/><path d="M9.7 9a2.4 2.4 0 0 1 4.6 1c0 1.7-2.3 1.7-2.3 3.4M12 16.5h.01"/>',
  profile: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2.5"/><circle cx="15" cy="17" r="2.5"/>',
  accounts: '<rect x="4" y="6" width="16" height="13" rx="3"/><path d="M4 9V7a3 3 0 0 1 3-3h10M15 12h5v4h-5z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  pending: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  warning: '<path d="m12 4 9 16H3L12 4ZM12 9v5M12 17h.01"/>',
  incoming: '<path d="m17 7-10 10M7 7v10h10"/>',
  outgoing: '<path d="M7 17 17 7M7 7h10v10"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.chevron}</svg>`;
const query = new URLSearchParams(location.search);
const state = {
  variant: Object.hasOwn(variants, query.get('variant')) ? query.get('variant') : 'a',
  width: [320, 390, 430, 480].includes(Number(query.get('width'))) ? Number(query.get('width')) : 390,
  section: 'overview', asset: null, privacy: false, motion: true,
  historyQuery: '', historyFilter: 'all', historyDirection: 'all', expandedActivity: null,
  scroll: { overview: 0, assets: 0, history: 0 }, dialog: null,
  drafts: {
    send: { asset: 'usdc', network: 'Ethereum', recipient: 'demo:recipient', amount: '' },
    receive: { asset: 'usdc', network: 'Ethereum', amount: '' },
    swap: { amount: '', asset: 'usdc', network: 'Ethereum' },
    buy: { amount: '', asset: 'usdc', network: 'Ethereum' },
  },
};
const wallet = $('.wallet');
const content = $('#wallet-content');
const nav = $('#wallet-nav');
const dialog = $('#sheet-root');
const sheetBody = $('#sheet-body');
const sheetTitle = $('#sheet-title');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let sheetTrigger = null;
let sheetFocusKey = null;
let sheetHistory = [];
let afterSheetClose = null;
let toastTimer;

function money(value) { return state.privacy ? '••••' : `${number.format(value)} $`; }
function crypto(value, symbol) { return state.privacy ? '••••' : `${quantity.format(value)} ${symbol}`; }
function assetImage(id) { return `<img src="assets/${escapeHTML(id)}.svg" class="asset-symbol" alt="" width="36" height="36">`; }
function focusKey(element) { return element instanceof HTMLElement ? element.dataset.focusKey || element.id || null : null; }
function restoreFocus(key, fallback = content) {
  const target = key && ($$('[data-focus-key]').find(node => node.dataset.focusKey === key) || document.getElementById(key));
  (target && !target.closest('[hidden]') ? target : $('[data-page-heading]', fallback) || fallback)?.focus({ preventScroll: true });
}
function toast(message) {
  const element = $('#toast');
  if (!element) return;
  clearTimeout(toastTimer);
  element.textContent = message;
  element.classList.add('toast-visible');
  toastTimer = setTimeout(() => element.classList.remove('toast-visible'), 3600);
}
function updateURL() {
  const url = new URL(location.href);
  url.searchParams.set('variant', state.variant);
  url.searchParams.set('width', String(state.width));
  const home = $('[data-home]');
  if (home) home.setAttribute('href', `${url.pathname}${url.search}`);
  try { history.replaceState(null, '', url); } catch { /* Sandboxed previews may prohibit URL replacement. */ }
}
function positionSheet() {
  const rect = wallet.getBoundingClientRect();
  dialog.style.setProperty('--sheet-left', `${rect.left + rect.width / 2}px`);
  dialog.style.setProperty('--sheet-width', `${Math.min(rect.width, innerWidth - 16)}px`);
  dialog.style.setProperty('--sheet-bottom', `${Math.max(12, innerHeight - Math.min(rect.bottom, innerHeight - 12))}px`);
}
function updateMotion() {
  const off = !state.motion || reducedMotion.matches;
  document.body.classList.toggle('reduced-motion', off);
  document.documentElement.dataset.motion = off ? 'off' : 'on';
  const button = $('#motion-toggle');
  if (button) {
    button.setAttribute('aria-pressed', String(state.motion));
    button.setAttribute('aria-label', reducedMotion.matches ? 'Анимации отключены в настройках устройства' : state.motion ? 'Отключить анимации' : 'Включить анимации');
    const label = $('[data-motion-label]', button) || $('#motion-label', button);
    if (label) label.textContent = off ? 'Анимации выкл.' : 'Анимации вкл.';
    button.dataset.enabled = String(!off);
  }
}
function setWidth(width) {
  if (![320, 390, 430, 480].includes(width)) return;
  state.width = width;
  document.documentElement.style.setProperty('--phone-width', `${width}px`);
  $$('[data-width]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.width) === width)));
  positionSheet();
  updateURL();
}
function setVariant(variant, announce = true) {
  if (!Object.hasOwn(variants, variant)) return;
  const previousFocus = focusKey(document.activeElement);
  const scrollTop = content.scrollTop;
  state.variant = variant;
  wallet.dataset.variant = variant;
  document.documentElement.dataset.variant = variant;
  $$('[data-variant]').filter(button => button.tagName === 'BUTTON').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.variant === variant));
  });
  const meta = variants[variant];
  for (const [id, value] of Object.entries({ 'variant-title': meta.title, 'variant-caption': meta.caption,
    'variant-detail': meta.detail, 'variant-counter': `0${Object.keys(variants).indexOf(variant) + 1} / 03` })) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }
  if (state.section === 'overview') renderContent(announce);
  content.scrollTop = scrollTop;
  if (previousFocus) restoreFocus(previousFocus, document);
  updateURL();
  if (announce) toast(`${variant.toUpperCase()} · ${meta.title}`);
}
function renderHeader() {
  $('#wallet-header').innerHTML = `<a class="wallet-brand" href="?variant=${escapeHTML(state.variant)}&amp;width=${state.width}" data-home aria-label="Novex — в обзор"><img src="assets/logo.svg" alt="Novex" width="104" height="32"></a>
    <div class="header-tools"><button class="icon-button" type="button" data-open="support" data-focus-key="support" aria-label="Помощь" aria-haspopup="dialog">${icon('support')}</button>
    <button class="avatar-button" type="button" data-open="profile" data-focus-key="profile" aria-label="Открыть профиль" aria-haspopup="dialog"><img src="assets/portrait.webp" alt="" width="40" height="40"></button></div>`;
}
function renderNav() {
  nav.innerHTML = [['overview', 'home', 'Обзор'], ['assets', 'assets', 'Активы'], ['history', 'history', 'История']].map(([id, image, label]) =>
    `<button class="nav-item" type="button" data-section="${id}" data-focus-key="nav-${id}">${icon(image)}<span>${label}</span></button>`).join('') +
    `<button class="nav-item" type="button" data-open="menu" data-focus-key="nav-menu" aria-haspopup="dialog" aria-controls="sheet-root" aria-expanded="false">${icon('menu')}<span>Меню</span></button>`;
  updateNav();
}
function updateNav() {
  $$('[data-section]', nav).forEach(button => {
    const active = button.dataset.section === state.section;
    button.dataset.active = String(active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  const menu = $('[data-open="menu"]', nav);
  if (menu) {
    menu.dataset.active = String(state.dialog?.kind === 'menu');
    menu.setAttribute('aria-expanded', String(dialog.open && state.dialog?.kind === 'menu'));
  }
}
function actionButton(action, secondary = false) {
  return `<button type="button" class="action-button${secondary ? ' action-secondary' : ''}" data-action="${action}" data-focus-key="action-${action}" aria-haspopup="dialog"><span class="action-icon">${icon(action)}</span><span class="action-label">${actionLabels[action]}</span></button>`;
}
function balanceMarkup() {
  const [whole, fraction] = number.format(12840.75).split(',');
  return `<div class="balance-heading"><h1 data-page-heading tabindex="-1" data-focus-key="overview-heading">Общий баланс</h1><button class="icon-button privacy-button" type="button" data-privacy data-focus-key="privacy" aria-label="${state.privacy ? 'Показать суммы' : 'Скрыть суммы'}" aria-pressed="${state.privacy}">${icon(state.privacy ? 'hidden' : 'eye')}</button></div>
    <div class="balance-amount" aria-label="${state.privacy ? 'Суммы скрыты' : escapeHTML(`Общая оценка ${number.format(12840.75)} долларов США`)}">${state.privacy ? '<span class="balance-whole">••••••</span>' : `<span class="balance-whole">${whole}</span><span class="balance-fraction">,${fraction}</span><span class="balance-unit">$</span>`}</div>
    <p class="balance-note">Оценка всех средств в долларах</p>`;
}
function renderOverview() {
  const actions = ['send', 'receive', 'swap', 'buy'].map(action => actionButton(action)).join('');
  const hero = state.variant === 'c'
    ? `<section class="balance-card">${balanceMarkup()}<div class="actions-integrated" aria-label="Действия">${actions}</div></section>`
    : `<section class="balance-free${state.variant === 'b' ? ' left' : ''}">${balanceMarkup()}</section>${state.variant === 'b'
      ? `<div class="actions-priority" aria-label="Основные действия">${actionButton('send')}${actionButton('receive')}</div><div class="secondary-actions" aria-label="Другие действия">${actionButton('swap', true)}${actionButton('buy', true)}</div>`
      : `<div class="action-strip" aria-label="Действия">${actions}</div>`}`;
  return `<div class="overview-page">${hero}<div class="overview-entries"><button type="button" class="funds-entry" data-section="assets" data-focus-key="funds-entry"><span class="entry-icon">${icon('assets')}</span><span class="entry-copy"><strong>Мои средства</strong><small>3 актива · 4 размещения</small></span><span class="entry-chevron">${icon('chevron')}</span></button>
    <button type="button" class="pending-row" data-pending data-focus-key="pending"><span class="status-dot pending">${icon('pending')}</span><span class="entry-copy"><strong>Ожидается получение</strong><small>${state.privacy ? 'Сумма скрыта' : '48,2 USDC'} · Ethereum</small></span><span class="entry-chevron">${icon('chevron')}</span></button></div>
    <p class="demo-note home-demo-note">Демо · операции не выполняются</p></div>`;
}
function sectionHeading(title, eyebrow = '') {
  return `<div class="section-header"><div>${eyebrow ? `<p class="eyebrow">${escapeHTML(eyebrow)}</p>` : ''}<h1 data-page-heading tabindex="-1" data-focus-key="${state.section}-heading">${escapeHTML(title)}</h1></div><button class="icon-button" type="button" data-privacy data-focus-key="privacy" aria-label="${state.privacy ? 'Показать суммы' : 'Скрыть суммы'}" aria-pressed="${state.privacy}">${icon(state.privacy ? 'hidden' : 'eye')}</button></div>`;
}
function renderAssets() {
  return `${sectionHeading('Мои средства', 'Весь портфель')}<div class="portfolio-total"><span>Общая оценка</span><strong>${money(12840.75)}</strong></div><ul class="asset-list">${Object.entries(assets).map(([id, asset]) => `<li><button class="asset-row" type="button" data-asset="${id}" data-focus-key="asset-${id}">${assetImage(id)}<span class="asset-copy"><strong>${asset.name}</strong><small>${crypto(asset.amount, asset.symbol)}</small></span><span class="asset-value"><strong>${money(asset.fiat)}</strong><small>${asset.networks.length === 1 ? asset.networks[0] : '2 сети'}</small></span><span class="entry-chevron">${icon('chevron')}</span></button></li>`).join('')}</ul><p class="demo-note">Оценка портфеля не равна доступному остатку для отправки.</p>`;
}
function renderAssetDetail() {
  const asset = assets[state.asset];
  return `<button class="text-button back-button" type="button" data-assets-back data-focus-key="asset-back">${icon('back')}Мои средства</button><div class="asset-detail-heading">${assetImage(state.asset)}<h1 data-page-heading tabindex="-1" data-focus-key="asset-heading">${asset.name}</h1><p>${asset.symbol}</p></div><div class="asset-detail-balance"><strong>${crypto(asset.amount, asset.symbol)}</strong><span>${money(asset.fiat)}</span></div>
    <div class="actions-priority">${actionButton('send')}${actionButton('receive')}</div><section class="asset-placements"><h2>Размещения</h2>${asset.networks.map(network => `<div class="placement-row"><span class="entry-copy"><strong>${network}</strong><small>Основной счёт</small></span><span>${crypto(state.asset === 'usdc' ? (network === 'Ethereum' ? 500 : 400) : asset.amount, asset.symbol)}</span></div>`).join('')}</section>
    <button class="funds-entry" type="button" data-asset-history><span class="entry-icon">${icon('history')}</span><span class="entry-copy"><strong>Операции с ${asset.symbol}</strong><small>Открыть историю</small></span><span class="entry-chevron">${icon('chevron')}</span></button><p class="demo-note">Демонстрационные данные. Балансы здесь не изменяются.</p>`;
}
function historyMatches(activity) {
  const asset = assets[activity.asset];
  const searchable = `${asset.name} ${asset.symbol} ${activity.network} ${activity.direction === 'incoming' ? 'Получение' : 'Отправка'} ${statusLabels[activity.status]}`.toLocaleLowerCase('ru-RU');
  return (state.historyFilter === 'all' || activity.status === state.historyFilter) &&
    (state.historyDirection === 'all' || activity.direction === state.historyDirection) && searchable.includes(state.historyQuery.trim().toLocaleLowerCase('ru-RU'));
}
function receiptMarkup(activity) {
  const asset = assets[activity.asset];
  const status = statusLabels[activity.status];
  const rows = [['Статус', status], ['Сумма', crypto(activity.amount, asset.symbol)], ['Сеть', activity.network],
    ['Счёт', 'Основной'], ['Дата', `${dateFormat.format(new Date(activity.date))}, ${timeFormat.format(new Date(activity.date))} UTC`], ['Комиссия', 'Не указана']];
  return `<div class="receipt" id="receipt-${activity.id}" role="region" aria-label="Детали операции"><dl class="review-list">${rows.map(([label, value]) => `<div class="receipt-row"><dt>${label}</dt><dd>${escapeHTML(value)}</dd></div>`).join('')}</dl><p class="demo-note">Пример операции. ${activity.status === 'pending' ? 'Средства ещё не считаются полученными.' : activity.status === 'failed' ? 'Этот перевод не выполнен.' : 'Это демонстрационная запись.'}</p><button type="button" class="text-button" data-receipt-close="${activity.id}">Свернуть детали</button></div>`;
}
function historyResultsMarkup() {
  const visible = activities.filter(historyMatches);
  if (!visible.length) return `<div class="empty-state"><span class="empty-icon">${icon('search')}</span><h2>Ничего не найдено</h2><p>Попробуйте другое название актива или сбросьте фильтры.</p><button class="button-secondary" type="button" data-history-reset>Сбросить фильтры</button></div>`;
  const groups = new Map();
  visible.forEach(activity => { const date = activity.date.slice(0, 10); if (!groups.has(date)) groups.set(date, []); groups.get(date).push(activity); });
  return [...groups].map(([date, entries]) => `<section class="history-group"><h2 class="history-date">${dateFormat.format(new Date(`${date}T12:00:00Z`))}</h2><ol>${entries.map(activity => {
    const asset = assets[activity.asset], expanded = state.expandedActivity === activity.id;
    const completed = activity.status === 'completed';
    const amount = crypto(activity.amount, asset.symbol);
    const signed = state.privacy ? amount : completed ? `${activity.direction === 'incoming' ? '+' : '−'}${amount}` : amount;
    return `<li><button type="button" class="history-row" data-history-id="${activity.id}" data-focus-key="history-${activity.id}" data-status="${activity.status}" aria-expanded="${expanded}" aria-controls="receipt-${activity.id}" aria-label="${escapeHTML(`${activity.direction === 'incoming' ? 'Получение' : 'Отправка'} ${asset.symbol}, ${state.privacy ? 'сумма скрыта' : signed}, ${statusLabels[activity.status]}, ${activity.network}`)}"><span class="history-direction ${activity.status}">${icon(completed ? activity.direction : activity.status === 'pending' ? 'pending' : 'warning')}</span><span class="history-copy"><strong>${activity.direction === 'incoming' ? 'Получение' : 'Отправка'} ${asset.symbol}</strong><small>${asset.symbol === 'USDC' ? `${activity.network} · ` : ''}${completed ? 'Основной счёт' : `<span class="status-label ${activity.status}">${statusLabels[activity.status]}</span>`}</small></span><span class="history-amount" data-direction="${completed ? activity.direction : 'neutral'}">${signed}</span></button>${expanded ? receiptMarkup(activity) : `<div id="receipt-${activity.id}" hidden></div>`}</li>`;
  }).join('')}</ol></section>`).join('');
}
function renderHistory() {
  return `${sectionHeading('История', 'Все операции')}<div class="history-toolbar"><label class="search-field">${icon('search')}<input id="history-search" data-focus-key="history-search" type="search" placeholder="Актив или сеть" aria-label="Поиск в истории" maxlength="80" value="${escapeHTML(state.historyQuery)}" autocomplete="off"></label><div class="filter-chips" role="group" aria-label="Статус операций">${[['all', 'Все'], ['pending', 'В обработке'], ['failed', 'Не выполнено']].map(([id, label]) => `<button class="chip" type="button" data-filter="${id}" aria-pressed="${state.historyFilter === id}">${label}</button>`).join('')}</div><label class="history-direction-filter"><span>Направление</span><select id="history-direction" aria-label="Направление операций">${[['all', 'Все операции'], ['incoming', 'Получения'], ['outgoing', 'Отправки']].map(([id, label]) => `<option value="${id}"${state.historyDirection === id ? ' selected' : ''}>${label}</option>`).join('')}</select></label></div><div id="history-results">${historyResultsMarkup()}</div><p class="demo-note">Демонстрационная история · время UTC</p>`;
}
function renderContent(animate = false, isReturn = false) {
  const view = state.section === 'overview' ? renderOverview() : state.section === 'assets' ? state.asset ? renderAssetDetail() : renderAssets() : renderHistory();
  content.innerHTML = `<div class="page-view${isReturn ? ' is-return' : ''}"${animate ? '' : ' style="animation:none"'}>${view}</div>`;
  content.dataset.section = state.section;
  updateNav();
}
function updateHistoryResults() {
  const results = $('#history-results');
  if (results) results.innerHTML = historyResultsMarkup();
  $$('[data-filter]', content).forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === state.historyFilter)));
}
function navigate(section, focus = true) {
  if (!['overview', 'assets', 'history'].includes(section)) return;
  const isReturn = ['overview', 'assets', 'history'].indexOf(section) < ['overview', 'assets', 'history'].indexOf(state.section);
  state.scroll[state.section] = content.scrollTop;
  state.section = section;
  state.asset = null;
  renderContent(true, isReturn);
  content.scrollTop = state.scroll[section];
  if (focus) $('[data-page-heading]', content)?.focus({ preventScroll: true });
}
function togglePrivacy() {
  const key = focusKey(document.activeElement), top = content.scrollTop;
  state.privacy = !state.privacy;
  renderContent();
  content.scrollTop = top;
  if (dialog.open) renderSheet();
  restoreFocus(key, dialog.open ? dialog : content);
  toast(state.privacy ? 'Суммы скрыты во всех разделах' : 'Суммы видны');
}
function menuItem(kind, name, description, image = kind) {
  return `<button type="button" class="sheet-menu-item" data-sheet-view="${kind}"><span class="entry-icon">${icon(image)}</span><span class="sheet-menu-copy"><strong>${escapeHTML(name)}</strong><small>${escapeHTML(description)}</small></span><span class="entry-chevron">${icon('chevron')}</span></button>`;
}
function row(label, value) { return `<div class="review-row"><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`; }
function renderMenu() {
  return `<div class="sheet-stack">${menuItem('accounts', 'Мои счета', 'Основной, Хранилище и другие')}${menuItem('profile', 'Профиль', 'Демонстрационный аккаунт')}${menuItem('settings', 'Настройки', 'Суммы и анимации')}${menuItem('support', 'Помощь', 'Как устроены действия', 'support')}</div><p class="demo-note">Тестовый интерфейс Novex. Все данные — примеры.</p>`;
}
function renderAccounts() {
  return `<p class="sheet-lead">Один портфель, разные способы хранения.</p><div class="sheet-stack"><div class="sheet-menu-item"><span class="entry-icon">${icon('accounts')}</span><span class="sheet-menu-copy"><strong>Основной</strong><small>BTC, ETH, USDC · 4 размещения</small></span><strong>${money(12840.75)}</strong></div><div class="sheet-menu-item"><span class="entry-icon">${icon('accounts')}</span><span class="sheet-menu-copy"><strong>Хранилище</strong><small>Активно · пока без средств</small></span><strong>${money(0)}</strong></div><div class="sheet-menu-item"><span class="sheet-menu-copy"><strong>Размещение</strong><small>Неактивно</small></span></div><div class="sheet-menu-item"><span class="sheet-menu-copy"><strong>Приватный</strong><small>Недоступен в демонстрации</small></span></div></div><button class="button-primary" type="button" data-show-assets>Посмотреть средства</button><p class="demo-note">Статусы и средства взяты из демонстрационного портфеля.</p>`;
}
function renderProfile() {
  return `<div class="profile-preview"><img src="assets/portrait.webp" alt="Демонстрационный аватар" width="72" height="72"><h3>Демо пользователь</h3><p>Личный профиль Novex</p></div><dl class="review-list">${row('Режим', 'Демонстрационный')}${row('Основной счёт', 'Активен')}${row('Данные', 'Только примеры')}</dl><div class="sheet-stack">${menuItem('settings', 'Настройки интерфейса', 'Суммы и отклик кнопок')}${menuItem('support', 'Помощь', 'Ответы на частые вопросы')}</div>`;
}
function renderSettings() {
  return `<p class="sheet-lead">Настройки действуют только в этой открытой примерке.</p><div class="sheet-stack"><button type="button" class="sheet-menu-item" data-privacy data-focus-key="settings-privacy" aria-pressed="${state.privacy}"><span class="entry-icon">${icon(state.privacy ? 'hidden' : 'eye')}</span><span class="sheet-menu-copy"><strong>Скрывать суммы</strong><small>${state.privacy ? 'Включено во всех разделах' : 'Сейчас суммы видны'}</small></span><span class="setting-value">${state.privacy ? 'Вкл.' : 'Выкл.'}</span></button><button type="button" class="sheet-menu-item" data-toggle-motion data-focus-key="settings-motion" aria-pressed="${state.motion}"><span class="entry-icon">${icon('settings')}</span><span class="sheet-menu-copy"><strong>Анимации</strong><small>${reducedMotion.matches ? 'Отключены на устройстве' : state.motion ? 'Мягкий отклик и переходы' : 'Мгновенная смена состояния'}</small></span><span class="setting-value">${state.motion && !reducedMotion.matches ? 'Вкл.' : 'Выкл.'}</span></button></div>`;
}
function renderSupport() {
  return `<p class="sheet-lead">Несколько коротких подсказок, чтобы освоиться.</p><div class="help-topics"><details><summary>Как отправить средства?</summary><p>Нажмите «Отправить», выберите актив и сеть, укажите демонстрационного получателя и сумму. Затем проверьте данные. Переводы в этой версии не выполняются.</p></details><details><summary>Как получить средства?</summary><p>Выберите актив и сеть. В примерке можно пройти этот путь и указать сумму, но настоящий адрес и QR-код здесь не создаются.</p></details><details><summary>Почему баланс и доступная сумма отличаются?</summary><p>Баланс — общая оценка портфеля. Для отправки важен конкретный актив, его сеть и доступный остаток на выбранном счёте.</p></details><details><summary>Что значит «В обработке»?</summary><p>Операция ещё не завершена. Статус не означает, что средства уже поступили. В истории это видно по подписи и значку.</p></details></div><p class="demo-note">Здесь показаны локальные подсказки. Обращение в поддержку не отправляется.</p>`;
}
function field(name, label, input, hint = '') {
  const control = hint ? input.replace(/^(<(?:input|select)\b)/, `$1 aria-describedby="hint-${name}"`) : input;
  return `<div class="field"><label class="field-label" for="field-${name}">${escapeHTML(label)}</label>${control}${hint ? `<p class="field-hint" id="hint-${name}">${escapeHTML(hint)}</p>` : ''}<p class="field-error" id="error-${name}" hidden></p></div>`;
}
function input(name, draft, placeholder, extra = '') {
  return `<input class="field-input" id="field-${name}" name="${name}" data-draft="${name}" data-focus-key="field-${name}" value="${escapeHTML(draft[name])}" placeholder="${escapeHTML(placeholder)}" autocomplete="off" maxlength="${name === 'recipient' ? 80 : 32}"${name === 'amount' ? ' inputmode="decimal"' : ''} ${extra}>`;
}
function assetFields(action, draft) {
  const availableAssets = action === 'send' ? ['usdc', 'btc', 'eth'] : ['usdc', 'btc', 'eth'];
  const select = `<select class="field-input" id="field-asset" name="asset" data-draft="asset" data-focus-key="field-asset">${availableAssets.map(id => `<option value="${id}"${draft.asset === id ? ' selected' : ''}>${assets[id].name} · ${assets[id].symbol}</option>`).join('')}</select>`;
  const networks = assets[draft.asset].networks;
  return field('asset', 'Актив', select) + field('network', 'Сеть', `<select class="field-input" id="field-network" name="network" data-draft="network" data-focus-key="field-network">${networks.map(network => `<option value="${network}"${draft.network === network ? ' selected' : ''}>${network}</option>`).join('')}</select>`);
}
function renderActionForm(action) {
  const draft = state.drafts[action], asset = assets[draft.asset];
  let fields = '';
  if (action === 'send' || action === 'receive') fields += `<div class="form-row">${assetFields(action, draft)}</div>`;
  if (action === 'send') {
    const available = asset.available[draft.network];
    fields += field('recipient', 'Получатель · пример', input('recipient', draft, 'demo:recipient'), 'Используйте demo:имя. Настоящий адрес не требуется.');
    fields += field('amount', `Сумма, ${asset.symbol}`, input('amount', draft, '0,00'), available === null ? 'Доступный остаток для этого актива не указан.' : state.privacy ? 'Доступная сумма скрыта' : `Доступно в демонстрации: ${quantity.format(available)} ${asset.symbol}`);
  } else if (action === 'receive') {
    fields += field('amount', `Сумма, ${asset.symbol} · необязательно`, input('amount', draft, 'Любая сумма'), 'Можно оставить поле пустым.');
  } else if (action === 'buy') {
    fields += `<div class="trade-pair"><strong>USD</strong>${icon('chevron')}<strong>USDC · Ethereum</strong></div>`;
    fields += field('amount', 'Сумма покупки, USD', input('amount', draft, '100,00'), 'Пример расчёта: 1 USDC = 1 USD. Провайдер не подключён.');
  } else {
    fields += `<div class="trade-pair"><strong>USDC</strong>${icon('swap')}<strong>ETH</strong><small>Ethereum · Основной счёт</small></div>`;
    fields += field('amount', 'Отдать, USDC', input('amount', draft, '50,00'), state.privacy ? 'Доступная сумма скрыта' : 'Доступно в демонстрации: 500 USDC');
    fields += '<p class="field-hint">Расчёт использует фиксированную оценку ETH из демоданных, а не рыночную котировку.</p>';
  }
  return `<p class="sheet-lead">${action === 'receive' ? 'Выберите, что и в какой сети получить.' : action === 'send' ? 'Сначала данные, затем спокойная проверка.' : 'Посмотрите, как будет устроено действие.'}</p><form data-demo-form="${action}" novalidate>${fields}<p id="form-status" class="form-status" role="status"></p><div class="form-actions"><button class="button-primary" type="submit">${action === 'receive' ? 'Показать реквизиты демо' : 'Проверить данные'}</button></div></form><p class="demo-note">Демо · деньги не перемещаются</p>`;
}
function parsedAmount(value, optional = false) {
  const normalized = value.trim().replace(',', '.');
  if (optional && !normalized) return null;
  if (!/^\d+(?:\.\d{1,8})?$/.test(normalized)) return NaN;
  const result = Number(normalized);
  return Number.isFinite(result) && result > 0 && result <= 1000000000 ? result : NaN;
}
function showErrors(errors) {
  $$('[data-draft]', sheetBody).forEach(element => {
    const name = element.dataset.draft, message = errors[name];
    element.setAttribute('aria-invalid', String(Boolean(message)));
    const hint = $(`#hint-${name}`, sheetBody);
    element.setAttribute('aria-describedby', [hint ? hint.id : '', message ? `error-${name}` : ''].filter(Boolean).join(' '));
    const error = $(`#error-${name}`, sheetBody);
    if (error) { error.textContent = message || ''; error.hidden = !message; }
  });
  const status = $('#form-status', sheetBody);
  if (status) status.textContent = Object.keys(errors).length ? 'Проверьте отмеченные поля.' : '';
  const first = Object.keys(errors)[0];
  if (first) $(`#field-${first}`, sheetBody)?.focus();
}
function submitAction(action) {
  const draft = state.drafts[action], errors = {};
  const amount = parsedAmount(draft.amount, action === 'receive');
  if (Number.isNaN(amount)) errors.amount = 'Введите сумму больше нуля, до 8 знаков после запятой.';
  if (action === 'send') {
    if (!/^demo:[\p{L}\p{N}._-]{1,64}$/u.test(draft.recipient.trim())) errors.recipient = 'Введите получателя в формате demo:имя.';
    const available = assets[draft.asset].available[draft.network];
    if (available === null) errors.asset = 'Доступный остаток не указан. Для отправки выберите BTC или USDC.';
    else if (Number.isFinite(amount) && amount > available) errors.amount = state.privacy ? 'Сумма превышает доступный остаток.' : `Максимум ${quantity.format(available)} ${assets[draft.asset].symbol} в этой сети.`;
  }
  if (action === 'swap' && Number.isFinite(amount) && amount > 500) errors.amount = state.privacy ? 'Сумма превышает доступный остаток.' : 'Для этого примера доступно не более 500 USDC.';
  if (action === 'buy' && Number.isFinite(amount) && amount > 10000) errors.amount = 'Для примерки введите сумму до 10 000 USD.';
  showErrors(errors);
  if (Object.keys(errors).length) return;
  state.dialog.step = action === 'receive' ? 'receive-ready' : 'review';
  state.dialog.amount = amount;
  renderSheet(true);
}
function reviewRows(action) {
  const draft = state.drafts[action], amount = state.dialog.amount, asset = assets[draft.asset];
  if (action === 'buy') return [['Оплатить', money(amount)], ['Получить · пример', crypto(amount, 'USDC')], ['Сеть', 'Ethereum'], ['Курс примера', '1 USDC = 1 USD'], ['Комиссия', 'Не рассчитана']];
  if (action === 'swap') return [['Отдать', crypto(amount, 'USDC')], ['Получить · пример', crypto(amount / (3900.50 / 1.1), 'ETH')], ['Сеть', 'Ethereum'], ['Комиссия', 'Не рассчитана']];
  return [['Получатель', draft.recipient.trim()], ['Сумма', crypto(amount, asset.symbol)], ['Сеть', draft.network], ['Счёт', 'Основной'], ['Комиссия', 'Не рассчитана']];
}
function renderActionReview(action) {
  return `<p class="sheet-lead">Проверьте каждый пункт перед завершением примерки.</p><dl class="review-list">${reviewRows(action).map(([label, value]) => row(label, value)).join('')}</dl><p class="demo-note">Это предварительный экран на примерах. Комиссии и условия настоящей операции здесь не определены.</p><div class="form-actions"><button class="button-primary" type="button" data-demo-confirm>Завершить примерку</button><button class="button-secondary" type="button" data-action-edit>Изменить данные</button></div>`;
}
function renderReceiveReady() {
  const draft = state.drafts.receive, amount = state.dialog.amount;
  return `<div class="receive-preview"><span class="receive-preview-icon">${icon('receive')}</span><h3>Демо-адрес</h3><p>Не для переводов</p></div><dl class="review-list">${row('Актив', assets[draft.asset].symbol)}${row('Сеть', draft.network)}${row('Сумма', amount === null ? 'Не указана' : crypto(amount, assets[draft.asset].symbol))}</dl><p class="demo-note">Настоящий адрес и QR-код не создаются. Ничего не отправляйте по данным из примерки.</p><div class="form-actions"><button class="button-primary" type="button" data-close-sheet>Готово</button><button class="button-secondary" type="button" data-action-edit>Изменить выбор</button></div>`;
}
function renderFinished() {
  return `<div class="empty-state success-state"><span class="success-icon">${icon('check')}</span><h3>Примерка завершена</h3><p>Вы прошли путь действия. Деньги не перемещались, баланс и история остались прежними.</p></div><div class="form-actions"><button class="button-primary" type="button" data-close-sheet>Вернуться в кошелёк</button><button class="button-secondary" type="button" data-action-edit>Изменить данные</button></div>`;
}
function renderSheet(focusHeading = false) {
  if (!state.dialog) return;
  const { kind, step } = state.dialog;
  const titles = { menu: 'Меню', accounts: 'Мои счета', profile: 'Профиль', settings: 'Настройки', support: 'Помощь', ...actionLabels };
  sheetTitle.textContent = step === 'review' ? 'Проверка данных' : step === 'finished' ? 'Готово' : titles[kind];
  sheetTitle.tabIndex = -1;
  const body = Object.hasOwn(actionLabels, kind)
    ? step === 'review' ? renderActionReview(kind) : step === 'receive-ready' ? renderReceiveReady() : step === 'finished' ? renderFinished() : renderActionForm(kind)
    : ({ menu: renderMenu, accounts: renderAccounts, profile: renderProfile, settings: renderSettings, support: renderSupport }[kind] || renderMenu)();
  sheetBody.innerHTML = `${sheetHistory.length ? `<button class="text-button sheet-back" type="button" data-sheet-back>${icon('back')}Назад</button>` : ''}${body}`;
  dialog.dataset.view = kind;
  dialog.dataset.step = step || 'root';
  positionSheet();
  if (focusHeading) { dialog.scrollTop = 0; sheetBody.scrollTop = 0; sheetTitle.focus({ preventScroll: true }); }
  updateNav();
}
function openSheet(kind, trigger = document.activeElement) {
  if (!Object.hasOwn(actionLabels, kind) && !['menu', 'accounts', 'profile', 'settings', 'support'].includes(kind)) return;
  if (!dialog.open) { sheetTrigger = trigger; sheetFocusKey = focusKey(trigger); sheetHistory = []; }
  if (Object.hasOwn(actionLabels, kind) && state.asset && (kind === 'send' || kind === 'receive')) {
    state.drafts[kind].asset = state.asset;
    state.drafts[kind].network = assets[state.asset].networks[0];
  }
  state.dialog = { kind, step: 'form' };
  renderSheet();
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  sheetBody.scrollTop = 0;
  sheetTitle.focus({ preventScroll: true });
  updateNav();
}
function onSheetClosed() {
  state.dialog = null;
  sheetHistory = [];
  updateNav();
  if (afterSheetClose) {
    const after = afterSheetClose;
    afterSheetClose = null;
    after();
  } else if (sheetTrigger instanceof HTMLElement && sheetTrigger.isConnected) sheetTrigger.focus({ preventScroll: true });
  else restoreFocus(sheetFocusKey);
  sheetTrigger = null;
  sheetFocusKey = null;
}
function closeSheet() { if (dialog.open) dialog.close(); }

document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target.closest('button, a[data-home]') : null;
  if (!target || target.disabled) return;
  if (target.hasAttribute('data-home')) { event.preventDefault(); navigate('overview'); return; }
  if (target.id === 'comparison-toggle') {
    const notes = $('#comparison-notes');
    notes.hidden = !notes.hidden;
    target.setAttribute('aria-expanded', String(!notes.hidden));
    return;
  }
  if (target.dataset.variant && Object.hasOwn(variants, target.dataset.variant)) { setVariant(target.dataset.variant); return; }
  if (target.dataset.width) { setWidth(Number(target.dataset.width)); return; }
  if (target.id === 'motion-toggle' || target.hasAttribute('data-toggle-motion')) {
    state.motion = !state.motion; updateMotion();
    if (state.dialog?.kind === 'settings') { renderSheet(); restoreFocus('settings-motion', dialog); }
    return;
  }
  if (target.hasAttribute('data-privacy')) { togglePrivacy(); return; }
  if (target.dataset.section) { navigate(target.dataset.section); return; }
  if (target.dataset.open) { openSheet(target.dataset.open, target); return; }
  if (target.dataset.action && Object.hasOwn(actionLabels, target.dataset.action)) { openSheet(target.dataset.action, target); return; }
  if (target.dataset.sheetView && ['menu', 'accounts', 'profile', 'settings', 'support'].includes(target.dataset.sheetView)) {
    sheetHistory.push({ ...state.dialog });
    state.dialog = { kind: target.dataset.sheetView, step: 'root' }; renderSheet(true); return;
  }
  if (target.hasAttribute('data-sheet-back') && sheetHistory.length) { state.dialog = sheetHistory.pop(); renderSheet(true); return; }
  if (target.id === 'sheet-close' || target.hasAttribute('data-close-sheet')) { closeSheet(); return; }
  if (target.hasAttribute('data-show-assets')) { afterSheetClose = () => navigate('assets'); closeSheet(); return; }
  if (target.dataset.asset && Object.hasOwn(assets, target.dataset.asset)) {
    state.scroll.assets = content.scrollTop; state.asset = target.dataset.asset; renderContent(true); content.scrollTop = 0;
    $('[data-page-heading]', content)?.focus({ preventScroll: true }); return;
  }
  if (target.hasAttribute('data-assets-back')) {
    const id = state.asset; state.asset = null; renderContent(true, true); content.scrollTop = state.scroll.assets; restoreFocus(`asset-${id}`); return;
  }
  if (target.hasAttribute('data-asset-history')) {
    state.historyQuery = assets[state.asset].symbol; state.historyFilter = 'all'; state.historyDirection = 'all'; navigate('history'); return;
  }
  if (target.hasAttribute('data-pending')) {
    state.historyQuery = ''; state.historyFilter = 'pending'; state.historyDirection = 'all'; state.expandedActivity = 'usdc-pending';
    navigate('history'); content.scrollTop = 0; return;
  }
  if (target.dataset.filter) { state.historyFilter = target.dataset.filter; updateHistoryResults(); return; }
  if (target.dataset.historyId) {
    const id = target.dataset.historyId; state.expandedActivity = state.expandedActivity === id ? null : id;
    updateHistoryResults(); restoreFocus(`history-${id}`); return;
  }
  if (target.dataset.receiptClose) { const id = target.dataset.receiptClose; state.expandedActivity = null; updateHistoryResults(); restoreFocus(`history-${id}`); return; }
  if (target.hasAttribute('data-history-reset')) {
    state.historyQuery = ''; state.historyFilter = 'all'; state.historyDirection = 'all';
    const search = $('#history-search'), direction = $('#history-direction');
    if (search) search.value = ''; if (direction) direction.value = 'all';
    updateHistoryResults(); search?.focus({ preventScroll: true }); return;
  }
  if (target.hasAttribute('data-action-edit') && state.dialog) { state.dialog.step = 'form'; renderSheet(true); return; }
  if (target.hasAttribute('data-demo-confirm') && state.dialog?.step === 'review') {
    state.dialog.step = 'finished'; renderSheet(true); return;
  }
});
document.addEventListener('input', event => {
  const element = event.target;
  if (!(element instanceof HTMLInputElement)) return;
  if (element.id === 'history-search') { state.historyQuery = element.value.slice(0, 80); updateHistoryResults(); return; }
  if (element.dataset.draft && state.dialog && Object.hasOwn(state.drafts, state.dialog.kind)) {
    const draft = state.drafts[state.dialog.kind];
    if (Object.hasOwn(draft, element.dataset.draft)) draft[element.dataset.draft] = element.value;
    element.removeAttribute('aria-invalid');
    const error = $(`#error-${element.dataset.draft}`, sheetBody);
    if (error) { error.hidden = true; error.textContent = ''; }
    const status = $('#form-status', sheetBody); if (status) status.textContent = '';
  }
});
document.addEventListener('change', event => {
  const element = event.target;
  if (!(element instanceof HTMLSelectElement)) return;
  if (element.id === 'history-direction' && ['all', 'incoming', 'outgoing'].includes(element.value)) {
    state.historyDirection = element.value; updateHistoryResults(); return;
  }
  if (element.dataset.draft && state.dialog && Object.hasOwn(state.drafts, state.dialog.kind)) {
    const draft = state.drafts[state.dialog.kind];
    if (element.dataset.draft === 'asset' && Object.hasOwn(assets, element.value)) {
      draft.asset = element.value; draft.network = assets[draft.asset].networks[0];
    } else if (element.dataset.draft === 'network' && assets[draft.asset].networks.includes(element.value)) draft.network = element.value;
    const key = focusKey(element); renderSheet(); restoreFocus(key, dialog);
  }
});
document.addEventListener('submit', event => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.dataset.demoForm) return;
  event.preventDefault();
  if (state.dialog?.kind === form.dataset.demoForm && state.dialog.step === 'form') submitAction(form.dataset.demoForm);
});
dialog.addEventListener('cancel', event => { event.preventDefault(); closeSheet(); });
dialog.addEventListener('close', onSheetClosed);
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeSheet();
});
window.addEventListener('resize', positionSheet, { passive: true });
window.addEventListener('scroll', () => { if (dialog.open) positionSheet(); }, { passive: true });
reducedMotion.addEventListener('change', () => {
  updateMotion();
  if (state.dialog?.kind === 'settings') {
    const key = focusKey(document.activeElement);
    renderSheet();
    restoreFocus(key, dialog);
  }
});
document.addEventListener('keydown', event => {
  if (dialog.open || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  const variant = { 1: 'a', 2: 'b', 3: 'c' }[event.key];
  if (variant) { event.preventDefault(); setVariant(variant); }
});

renderHeader();
renderNav();
renderContent();
setWidth(state.width);
setVariant(state.variant, false);
updateMotion();
