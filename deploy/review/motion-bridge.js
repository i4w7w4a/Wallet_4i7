(() => {
  'use strict';

  const allowedParents = new Set(['__STABLE_ORIGIN__', '__REVISION_ORIGIN__']);
  if (window.parent === window) return;

  let parentOrigin = null;
  let lastReady = null;
  const launcher = () => document.querySelector('[data-review-motion-launch][data-review-motion-ready="true"]');
  const isReady = () => {
    const anchor = launcher();
    return Boolean(anchor && anchor.getAttribute('aria-disabled') !== 'true');
  };
  const announce = (force = false) => {
    if (!parentOrigin) return;
    const ready = isReady();
    if (!force && ready === lastReady) return;
    lastReady = ready;
    window.parent.postMessage({ type: 'novex-motion-ready', ready }, parentOrigin);
  };
  const observer = new MutationObserver(() => announce());
  const observe = () => observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-review-motion-ready', 'aria-disabled'],
  });
  observe();
  addEventListener('pagehide', () => observer.disconnect());
  addEventListener('pageshow', () => { observe(); announce(true); });

  addEventListener('message', event => {
    if (event.source !== window.parent || !allowedParents.has(event.origin) || !event.data || typeof event.data !== 'object') return;
    if (event.data.type === 'novex-motion-probe') {
      parentOrigin = event.origin;
      announce(true);
      return;
    }
    if (event.origin !== parentOrigin || event.data.type !== 'novex-motion-launch' ||
        typeof event.data.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(event.data.id)) return;

    const anchor = launcher();
    if (!anchor || anchor.getAttribute('aria-disabled') === 'true') {
      window.parent.postMessage({ type: 'novex-motion-result', id: event.data.id, error: 'not-ready' }, parentOrigin);
      return;
    }

    // The native handler records the session. Navigation is owned by the parent,
    // which opened a window synchronously in the user's click or keyboard gesture.
    const previousHref = anchor.href;
    anchor.addEventListener('click', event => event.preventDefault(), { once: true });
    anchor.click();
    const url = new URL(anchor.href, location.href);
    if (url.href === previousHref || url.origin !== location.origin || url.pathname !== '/design-lab/motion' ||
        !/^[0-9a-f-]{36}$/i.test(url.searchParams.get('session') || '') ||
        url.searchParams.get('target') !== 'mono.quick-actions') {
      window.parent.postMessage({ type: 'novex-motion-result', id: event.data.id, error: 'invalid-session' }, parentOrigin);
      return;
    }
    window.parent.postMessage({ type: 'novex-motion-result', id: event.data.id, url: url.href }, parentOrigin);
  });
})();
