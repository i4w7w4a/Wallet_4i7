'use strict';

const icons = {
  send:'<path d="M7 17 17 7M7 7h10v10"/>',
  receive:'<path d="m17 7-10 10M7 7v10h10"/>',
  swap:'<path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4"/>',
  buy:'<path d="M12 5v14M5 12h14"/>',
  chevron:'<path d="m7 10 5 5 5-5"/>',
  'arrow-right':'<path d="m9 6 6 6-6 6"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  eye:'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  home:'<path d="m4 10 8-6 8 6v10h-5v-6H9v6H4Z"/>',
  chart:'<path d="M4 19h16M6 15l5-6 4 3 4-7"/>',
  history:'<path d="M4 9a8 8 0 1 1 1 9M4 4v5h5m3-2v5l3 2"/>',
  profile:'<circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon:'<path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>',
  battery:'<rect x="2" y="5" width="18" height="14" rx="3"/><path d="M22 9v6"/><rect x="5" y="8" width="8.5" height="8" rx="1" fill="currentColor" stroke="none"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icons[name] || icons['arrow-right']}</svg>`;
const variants = {
  priority:{letter:'A',title:'Два + два'},
  strip:{letter:'B',title:'Общая полоса'},
  more:{letter:'C',title:'Другие действия'}
};
const requested = new URLSearchParams(window.location.search).get('variant');
const variant = Object.hasOwn(variants, requested) ? requested : null;
const popover = document.getElementById('popover');
const popoverTitle = document.getElementById('popover-title');
const popoverContent = document.getElementById('popover-content');
const wallet = document.querySelector('.wallet');
let currentAnchor = null;
let currentPanel = null;
let privacyHidden = false;

document.querySelectorAll('[data-icon]').forEach(element => { element.innerHTML = icon(element.dataset.icon); });
document.getElementById('theme-icon').innerHTML = icon('sun');

const primaryButton = (action, label) => `<button class="action-button" type="button" data-action="${action}" aria-haspopup="dialog" aria-expanded="false">${icon(action)}<span>${label}</span></button>`;
const serviceButton = (action, label, inStrip = false) => `<button class="${inStrip ? 'action-button service-action' : 'secondary-button'}" type="button" data-action="${action}" aria-label="${label}: ещё не подключено. Показать пояснение" aria-haspopup="dialog" aria-expanded="false">${inStrip ? icon(action) + `<span>${label}</span>` : `<span>${icon(action)}${label}</span>`}<span class="action-hint">не подключено</span></button>`;
const pair = `<div class="action-pair">${primaryButton('send','Отправить')}${primaryButton('receive','Получить')}</div>`;

if (variant) {
  document.getElementById('variant-view').hidden = false;
  const selected = variants[variant];
  document.getElementById('studio-caption').textContent = `${selected.letter} · ${selected.title}`;
  document.title = `Novex · ${selected.letter} — ${selected.title}`;
  document.querySelector(`[data-variant-link="${variant}"]`).setAttribute('aria-current','page');
  document.getElementById('actions').innerHTML = variant === 'priority'
    ? pair + `<div class="secondary-actions">${serviceButton('buy','Купить')}${serviceButton('swap','Обмен')}</div>`
    : variant === 'strip'
      ? `<div class="action-strip">${primaryButton('send','Отправить')}${primaryButton('receive','Получить')}${serviceButton('buy','Купить',true)}${serviceButton('swap','Обмен',true)}</div>`
      : pair + `<div class="more-action-wrap"><button class="more-action" type="button" data-action="more" aria-haspopup="dialog" aria-expanded="false"><span>Другие действия</span>${icon('chevron')}</button></div>`;
} else {
  document.getElementById('comparison').hidden = false;
}

const assets = {
  btc:{name:'Bitcoin',symbol:'BTC',network:'Bitcoin',initial:'B',amount:'0,12 BTC',value:'8 040,25 $'},
  eth:{name:'Ethereum',symbol:'ETH',network:'Ethereum',initial:'E',amount:'1,1 ETH',value:'3 900,50 $'},
  usdc:{name:'USD Coin',symbol:'USDC',network:'Ethereum',initial:'U',amount:'900 USDC',value:'900,00 $'}
};

function placePopover() {
  if (!currentAnchor || popover.hidden) return;
  const anchorRect = currentAnchor.getBoundingClientRect();
  const sceneRect = wallet.getBoundingClientRect();
  const leftLimit = Math.max(12,sceneRect.left + 10);
  const rightLimit = Math.min(window.innerWidth - 12,sceneRect.right - 10);
  const available = Math.max(0,rightLimit - leftLimit);
  popover.style.width = `${Math.min(300,available)}px`;
  const size = popover.getBoundingClientRect();
  const left = Math.min(Math.max(anchorRect.left + anchorRect.width / 2 - size.width / 2,leftLimit),rightLimit - size.width);
  const preferredTop = anchorRect.bottom + 7;
  const top = preferredTop + size.height <= window.innerHeight - 12
    ? preferredTop : Math.max(12,anchorRect.top - size.height - 7);
  popover.style.left = `${Math.max(12,left)}px`;
  popover.style.top = `${Math.min(Math.max(12,top),Math.max(12,window.innerHeight - size.height - 12))}px`;
}

function closePopover(restoreFocus = true) {
  if (popover.hidden) return;
  const previousAnchor = currentAnchor;
  popover.hidden = true;
  previousAnchor?.setAttribute('aria-expanded','false');
  currentAnchor = null;
  currentPanel = null;
  if (restoreFocus && previousAnchor?.isConnected) previousAnchor.focus({preventScroll:true});
}

function showPopover(title, content, anchor, panel) {
  if (!popover.hidden && currentAnchor === anchor && currentPanel === panel) {
    closePopover();
    return;
  }
  closePopover(false);
  currentAnchor = anchor;
  currentPanel = panel;
  anchor.setAttribute('aria-expanded','true');
  popoverTitle.textContent = title;
  popoverContent.innerHTML = content;
  popover.hidden = false;
  placePopover();
  const firstButton = popoverContent.querySelector('button');
  (firstButton || document.getElementById('popover-close')).focus({preventScroll:true});
}

function chooseAsset(action, anchor) {
  const title = action === 'send' ? 'Отправить' : 'Получить';
  const list = Object.entries(assets).map(([id,asset]) => `<button class="popover-item" type="button" data-preview-action="${action}" data-preview-asset="${id}"><span class="asset-symbol">${asset.initial}</span><span class="popover-item-copy"><strong>${asset.name}</strong><small>${asset.symbol} · ${asset.network} · Основной</small></span>${icon('arrow-right')}</button>`).join('');
  showPopover(title, `<p class="popover-lead">Выберите актив для примерки входа.</p>${list}`, anchor, action);
}

function renderActionPreview(action, assetId) {
  const asset = assets[assetId];
  if (!asset) return;
  const title = action === 'send' ? 'Отправить' : 'Получить';
  popoverTitle.textContent = `${title} ${asset.symbol}`;
  popoverContent.innerHTML = `<div class="preview-copy"><strong>${asset.name}</strong><span class="preview-network">Основной · ${asset.network}</span><p style="margin-top:12px">Выбран вход «${title}». Здесь заканчивается композиционная примерка: адреса, реквизиты и переводы не создаются.</p></div><div class="preview-actions"><button type="button" data-back-action="${action}">К выбору</button><button type="button" data-close>Закрыть</button></div>`;
  placePopover();
  popoverContent.querySelector('button').focus({preventScroll:true});
  document.getElementById('announcer').textContent = `Примерка: ${title} ${asset.symbol}, сеть ${asset.network}`;
}

function showUnavailable(action, anchor) {
  const title = action === 'buy' ? 'Купить' : 'Обмен';
  showPopover(title, `<div class="preview-copy"><strong>Ещё не подключено</strong><p>В этой примерке можно оценить только расположение входа. Способы покупки, пары обмена, комиссии и условия здесь не заданы.</p></div>`, anchor, action);
}

function showPanel(panel, anchor) {
  const content = {
    accounts:['Все счета', '<div class="preview-copy"><p>Общая стоимость и состав средств одинаковые во всех трёх вариантах. Переключение настоящих счетов здесь не подключено.</p></div>'],
    battery:['Батарейка', '<div class="battery-preview"><span>Ethereum · пример</span><strong>60%</strong></div><div class="preview-copy"><p>Процент фиксирован для сравнения композиций. Значок находится справа от суммы.</p><p>Покрытие конкретного перевода и обновление остатка требуют данных. Здесь батарейка не расходуется и не заряжается.</p></div>'],
    operation:['Последняя операция', `<div class="preview-copy"><strong>Получение Bitcoin</strong><p>${privacyHidden ? 'Сумма скрыта' : '0,0042 BTC'} · Выполнено · демонстрационный пример.</p><p>Запись служит ориентиром для сравнения экрана. Новых операций примерка не создаёт.</p></div>`],
    history:['История', '<div class="preview-copy"><p>Здесь сравниваются композиции главного экрана. Последняя операция одинакова; история рабочего MONO не загружается.</p></div>'],
    profile:['Профиль', '<div class="preview-copy"><p>Переключатель светлой/тёмной темы находится над примеркой. Он действует только на эту страницу.</p><p>Для скрытия сумм нажмите значок глаза у баланса. Настройки рабочего кошелька не затрагиваются.</p></div>']
  };
  if (panel === 'overview') { closePopover(false); document.getElementById('wallet-scroll').scrollTo({top:0,behavior:'auto'}); return; }
  if (panel === 'assets') {
    closePopover(false);
    document.getElementById('funds-list').hidden = false;
    document.getElementById('funds-toggle').setAttribute('aria-expanded','true');
    document.getElementById('funds-toggle').scrollIntoView({block:'center',behavior:'auto'});
    document.getElementById('funds-toggle').focus({preventScroll:true});
    return;
  }
  const item = content[panel];
  if (item) showPopover(item[0],item[1],anchor,panel);
}

document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const button = target.closest('button');
  if (button?.dataset.action) {
    const action = button.dataset.action;
    if (action === 'send' || action === 'receive') chooseAsset(action,button);
    else if (action === 'more') showPopover('Другие действия', `<p class="popover-lead">Оба сервиса ещё не подключены.</p><button type="button" class="popover-item" data-action="buy">${icon('buy')}<span class="popover-item-copy"><strong>Купить</strong><small>Посмотреть пояснение</small></span>${icon('arrow-right')}</button><button type="button" class="popover-item" data-action="swap">${icon('swap')}<span class="popover-item-copy"><strong>Обмен</strong><small>Посмотреть пояснение</small></span>${icon('arrow-right')}</button>`, button, 'more');
    else showUnavailable(action,popover.contains(button) && currentAnchor ? currentAnchor : button);
    return;
  }
  if (button?.dataset.previewAction) { renderActionPreview(button.dataset.previewAction,button.dataset.previewAsset); return; }
  if (button?.dataset.backAction) {
    const action = button.dataset.backAction;
    const anchor = currentAnchor;
    closePopover(false);
    if (anchor) chooseAsset(action,anchor);
    return;
  }
  if (button?.hasAttribute('data-close')) { closePopover(); return; }
  if (button?.dataset.panel) { showPanel(button.dataset.panel,button); return; }
  if (button?.dataset.asset) {
    const asset = assets[button.dataset.asset];
    showPopover(asset.name, `<div class="preview-copy"><span class="preview-network">${asset.symbol} · пример актива</span><p style="margin-top:12px">Размещения по счетам и сетям входят в рабочий MONO. В этой странице состав средств зафиксирован для честного сравнения кнопок.</p></div>`, button, 'asset');
    return;
  }
  if (!popover.hidden && !popover.contains(target) && !currentAnchor?.contains(target)) closePopover(false);
});

document.getElementById('popover-close').addEventListener('click', () => closePopover());
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !popover.hidden) { event.preventDefault(); closePopover(); }
});
document.addEventListener('focusin', event => {
  if (!popover.hidden && !popover.contains(event.target) && !currentAnchor?.contains(event.target)) closePopover(false);
});
window.addEventListener('resize',placePopover);
document.getElementById('wallet-scroll').addEventListener('scroll',() => closePopover(false),{passive:true});

document.getElementById('theme-toggle').addEventListener('click', event => {
  closePopover(false);
  const dark = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  event.currentTarget.setAttribute('aria-pressed',String(dark));
  event.currentTarget.setAttribute('aria-label',dark ? 'Включить светлую тему' : 'Включить тёмную тему');
  document.getElementById('theme-label').textContent = dark ? 'Тёмная' : 'Светлая';
  document.getElementById('theme-icon').innerHTML = icon(dark ? 'moon' : 'sun');
});

document.querySelectorAll('[data-money]').forEach(element => { element.dataset.originalMarkup = element.innerHTML; element.dataset.originalLabel = element.getAttribute('aria-label') || ''; });
document.getElementById('privacy-toggle').addEventListener('click', event => {
  closePopover(false);
  privacyHidden = !privacyHidden;
  event.currentTarget.setAttribute('aria-pressed',String(privacyHidden));
  event.currentTarget.setAttribute('aria-label',privacyHidden ? 'Показать суммы' : 'Скрыть суммы');
  document.querySelectorAll('[data-money]').forEach(element => {
    element.innerHTML = privacyHidden ? (element.classList.contains('balance-value') ? '<span class="whole">••••••</span>' : '••••') : element.dataset.originalMarkup;
    if (element.dataset.originalLabel) element.setAttribute('aria-label',privacyHidden ? 'Сумма скрыта' : element.dataset.originalLabel);
  });
});
document.getElementById('funds-toggle').addEventListener('click',event => {
  closePopover(false);
  const expanded = event.currentTarget.getAttribute('aria-expanded') !== 'true';
  event.currentTarget.setAttribute('aria-expanded',String(expanded));
  document.getElementById('funds-list').hidden = !expanded;
});
