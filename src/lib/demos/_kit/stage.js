/* ── A demo's stage: one shadow root per mounted demo ────────────
   Every demo in the collection renders inside its own shadow root, so

     · components.css cannot leak INTO it (its 83 unscoped classes —
       .thumb, .plate, .note — would silently restyle a demo), and the
       demo's own CSS cannot leak OUT into the slide or the app
     · ids inside the demo stay unique without renaming them

   The design system is injected into each root because a shadow root
   inherits no stylesheets. `:root` in tokens.css is rewritten to `:host`
   so the tokens land on the demo's host element; the app already loads
   fonts.css at document level, and @font-face is document-scoped, so the
   faces resolve inside the root without being repeated here. */
import tokens from '../../../../design/system/tokens.css?raw';
import components from '../../../../design/system/components.css?raw';

const SYSTEM = (tokens + '\n' + components).replace(/:root\b/g, ':host').replace(/\bhtml\s*,\s*body\b/g, ':host');

/**
 * @param {HTMLElement} host   element the demo mounts into
 * @param {{ css?: string, html?: string, system?: boolean }} opts
 *   css: the demo's own stylesheet text · html: its markup ·
 *   system: inject tokens + components (default true)
 */
export function stage(host, { css = '', html = '', system = true } = {}) {
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  root.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = (system ? SYSTEM + '\n' : '') + ':host { display: block; position: relative; }\n' + css;
  root.append(style);
  const body = document.createElement('div');
  body.className = 'demo-root';
  body.innerHTML = html;
  root.append(body);
  /** query by data-testid inside this demo only */
  const $ = (/** @type {string} */ id) => /** @type {HTMLElement | null} */ (root.querySelector(`[data-testid="${id}"]`));
  return { root, body, $ };
}
