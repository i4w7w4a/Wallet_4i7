# Review presentation

This directory is delivery chrome, not wallet application code. `shell.html` is the outer review page. `presentation.css` hides the existing workbench controls and removes their reserved mobile space in the presented Mono HTML. `motion-bridge.js` is delivered as `/review-session-dock.js` inside the wallet iframe; it does not draw an additional control. `review-overlay.js` and `review-gold.js` implement review readiness for the two actual iframe documents.

The shell and iframe may have different origins. The shell opens a temporary window on the user's activation, then asks the active iframe to run its existing native launcher. The launcher records the actual session; the bridge cancels only its navigation and returns the resulting URL. The shell validates the origin, source, request ID, route and target before navigating the window. A failed request closes that window. The old standalone Lab link remains available while viewing Gold. Apply/ACK remains the product's existing same-origin mechanism.

Build these files only after committing them and producing a matching Next build with the review Lab flag. `build_chrome.py` checks HEAD and each committed chrome file, and creates a fresh output directory containing the shell, injected Mono HTML, bridge and a separate hash manifest:

```
python deploy/review/build_chrome.py --mono <dist/server/app/mono.html> --gold <dist/server/app/gold.html> --source <full-commit-sha> --build-id <BUILD_ID> --origin <immutable-origin> --stable-origin <stable-origin> --output <new-directory>
```

The renderer outputs the replacement `index.html`, `mono.html`, `gold.html`, `review-overlay.js`, `review-gold.js` and `review-session-dock.js`. The packager adds the untouched `motion.html` from `dist/server/app/design-lab/motion.html`, the exact verified `dist/static` tree and approved files from the exact build's `public` snapshot. It must configure routes for those files and CSP for both the standalone shell and stable shell, without changing old immutable releases. Record the application commit, BUILD_ID, original HTML hashes, chrome manifest and separate shell hash. Verify the complete package before publishing it to a new immutable origin.

After starting a candidate, run `node deploy/review/menu-session.test.cjs <shell-url>`. This checks the actual iframe, keyboard launch, native session, and Apply/ACK; it does not intercept network responses. Exercise early input, blocked popups, navigation races, restored pages and mobile geometry as separate checks.
