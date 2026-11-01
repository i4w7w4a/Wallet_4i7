(() => {
  let tries = 0;
  let ready = false;
  const announce = () => {
    if (ready) window.parent.postMessage({ type: 'novex-review-ready', mode: 'gold' }, '*');
  };
  const timer = setInterval(() => {
    ready = [...document.querySelectorAll('button')].some(button => {
      const key = Object.keys(button).find(name => name.startsWith('__reactProps$'));
      return key && typeof button[key]?.onClick === 'function';
    });
    if (ready || ++tries > 1200) clearInterval(timer);
    announce();
  }, 100);
  addEventListener('message', event => {
    if (event.source === window.parent && event.data?.type === 'novex-motion-probe') announce();
  });
  addEventListener('pagehide', () => window.parent.postMessage({ type: 'novex-review-unloading' }, '*'));
  addEventListener('pageshow', announce);
})();
