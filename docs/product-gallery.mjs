/** Put official product photos beside the existing model without replacing its controls or renderer. */
export function createProductGallery(container, model, item) {
  let selected = 0;
  const photo = document.createElement("figure");
  photo.className = "product-photo"; photo.hidden = true;
  photo.innerHTML = '<img decoding="async" alt=""><p role="status" hidden>This image failed to load.</p><figcaption></figcaption><a target="_blank" rel="noopener noreferrer">Official product image ↗</a>';
  const image = photo.querySelector("img"), error = photo.querySelector("p"), source = photo.querySelector("a"), caption = photo.querySelector("figcaption");
  image.addEventListener("load", () => { image.hidden = false; error.hidden = true; });
  image.addEventListener("error", () => { image.hidden = true; error.hidden = false; });
  const gallery = document.createElement("nav");
  gallery.className = "product-gallery"; gallery.setAttribute("aria-label", `${item.name} images`);
  const previous = document.createElement("button"), next = document.createElement("button");
  previous.type = next.type = "button";
  previous.className = next.className = "gallery-arrow";
  previous.textContent = "‹"; next.textContent = "›";
  previous.setAttribute("aria-label", `Previous ${item.name} image`);
  next.setAttribute("aria-label", `Next ${item.name} image`);
  const strip = document.createElement("div"); strip.className = "gallery-strip";
  const buttons = [null, ...item.images].map(entry => {
    const button = document.createElement("button"); button.type = "button";
    if (entry) {
      const thumb = document.createElement("img");
      thumb.src = new URL(`${entry.src}?v=__SITE_VERSION__`, import.meta.url).href;
      thumb.alt = ""; thumb.loading = "lazy"; thumb.decoding = "async";
      button.append(thumb); button.setAttribute("aria-label", `${item.name} — ${entry.angle}`);
    } else {
      button.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m16 3 12 7v13l-12 7-12-7V10Zm0 0v14m12-7-12 7-12-7m12 7v13"/></svg><span>3D</span>';
      button.setAttribute("aria-label", `${item.name} 3D model`);
    }
    strip.append(button); return button;
  });
  /** Select a photo or restore the same interactive model, keeping its orientation and simulator state. */
  function select(index, reveal = true) {
    selected = index;
    model.hidden = index !== 0; photo.hidden = index === 0;
    buttons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
    previous.disabled = index === 0; next.disabled = index === buttons.length - 1;
    if (index) {
      const entry = item.images[index - 1];
      error.hidden = true; image.hidden = true;
      image.alt = `${item.name} — ${entry.angle}`;
      caption.textContent = entry.angle;
      image.src = new URL(`${entry.src}?v=__SITE_VERSION__`, import.meta.url).href;
      source.href = entry.source;
    }
    if (reveal) { // Scroll only the thumbnails; scrollIntoView also moves the MacBook's taller dialog.
      const bounds = buttons[index].getBoundingClientRect(), viewport = strip.getBoundingClientRect();
      if (bounds.left < viewport.left) strip.scrollLeft += bounds.left - viewport.left;
      else if (bounds.right > viewport.right) strip.scrollLeft += bounds.right - viewport.right;
    }
  }
  buttons.forEach((button, index) => button.addEventListener("click", () => select(index)));
  previous.addEventListener("click", () => select(selected - 1));
  next.addEventListener("click", () => select(selected + 1));
  strip.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, selected + (event.key === "ArrowLeft" ? -1 : 1)));
    select(index); buttons[index].focus({ preventScroll: true });
  });
  strip.addEventListener("wheel", event => {
    if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY) || strip.scrollWidth <= strip.clientWidth) return;
    event.preventDefault(); strip.scrollLeft += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? strip.clientWidth : 1);
  }, { passive: false });
  gallery.append(previous, strip, next); container.append(photo, gallery);
  select(0, false); // Ethan wants every product to open in 3D, even after previously viewing its photos.
  return () => { model.hidden = false; photo.remove(); gallery.remove(); };
}
