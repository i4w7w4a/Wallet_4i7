(() => {
  let clicks = 0;
  let lastClick = 0;
  let ready = false;
  let tries = 0;
  const announce = () => {
    if (ready) window.parent.postMessage({ type: 'novex-review-ready', mode: 'mono' }, '*');
  };
  const timer = setInterval(() => {
    const button = document.querySelector('.mono-workbench__master');
    if (button?.getAttribute('aria-expanded') === 'false') {
      clearInterval(timer);
      ready = true;
      document.documentElement.dataset.reviewReady = 'true';
      announce();
      return;
    }
    const key = button && Object.keys(button).find(name => name.startsWith('__reactProps$'));
    const launcher = document.querySelector('[data-review-motion-launch][data-review-motion-ready="true"]');
    if (launcher && key && typeof button[key]?.onClick === 'function' && clicks < 10 && Date.now() - lastClick >= 1000) {
      clicks++;
      lastClick = Date.now();
      button.click();
    }
    if (++tries > 1200) clearInterval(timer);
  }, 100);
  addEventListener('message', event => {
    if (event.source === window.parent && event.data?.type === 'novex-motion-probe') announce();
  });
  addEventListener('pagehide', () => window.parent.postMessage({ type: 'novex-review-unloading' }, '*'));
  addEventListener('pageshow', announce);
  document.addEventListener('keydown', event => {
    const target = event.target;
    if (/^[1-7]$/.test(event.key) && !(target instanceof HTMLElement && (target.isContentEditable || target.closest('input,textarea,select,[contenteditable]')))) event.stopPropagation();
  }, true);
})();
