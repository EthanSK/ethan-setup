/** Give an embedded page visible progress and a fresh browsing context on every retry. */
export function createFrameView(/** @type {HTMLElement} */ container, frameId = "") {
  const status = document.createElement("div");
  status.className = "frame-loading";
  status.hidden = true;
  status.innerHTML = '<span class="frame-spinner" aria-hidden="true"></span><p role="status" aria-live="polite"></p><div class="frame-actions"><button type="button" hidden>Try again</button><a target="_blank" rel="noopener noreferrer">Open in new tab ↗</a></div>';
  container.append(status);
  const message = status.querySelector("p"), retry = status.querySelector("button"), external = status.querySelector("a");
  /** @type {HTMLIFrameElement | undefined} */
  let frame;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  /** @type {(() => void) | undefined} */
  let reload;
  retry.addEventListener("click", () => reload?.());

  /** Stop pending page work when the dialog closes or changes to another item. */
  function clear() {
    clearTimeout(timer);
    frame?.remove(); frame = undefined;
    reload = undefined;
    status.hidden = true;
  }

  /** Show progress until the iframe load event; a slow response stays retryable without being declared failed. */
  function load(/** @type {string} */ url, /** @type {string} */ pageName, title = pageName) {
    clear();
    reload = () => load(url, pageName, title);
    const next = document.createElement("iframe"); // Reusing an iframe after removing src can deliver a stale about:blank load and hide the new page's indicator early.
    frame = next;
    if (frameId) next.id = frameId;
    next.title = title;
    next.loading = "eager";
    next.referrerPolicy = "no-referrer";
    next.setAttribute("aria-busy", "true");
    next.style.opacity = "0"; next.inert = true; // Keep the embedded page visible to its own layout and lazy-loading logic while its unfinished pixels are concealed.
    message.textContent = `Loading ${pageName}…`;
    status.hidden = false;
    retry.hidden = true;
    retry.setAttribute("aria-label", `Try again: ${pageName}`);
    external.href = url;
    external.setAttribute("aria-label", `Open in new tab: ${pageName}`);
    timer = setTimeout(() => {
      message.textContent = `Still loading ${pageName}…`;
      retry.hidden = false;
    }, 12000);
    next.addEventListener("load", () => {
      if (frame !== next) return; // A removed page may finish after a retry or dialog switch; only the current frame owns its loading state.
      clearTimeout(timer);
      next.style.opacity = "1"; next.inert = false;
      next.setAttribute("aria-busy", "false");
      status.hidden = true;
    }, { once: true });
    next.src = url;
    container.append(next);
  }

  return { load, clear };
}
