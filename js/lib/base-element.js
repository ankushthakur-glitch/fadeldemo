/**
 * UiElement — the small shared base every ui-* component extends.
 *
 * What it gives you, in plain language:
 *  - a tidy way to mirror HTML attributes onto JS properties, so
 *    <ui-button variant="primary"> and el.variant = 'primary' do the same thing
 *  - one helper for firing the documented ui-* events
 *  - a render() that only runs once the element is actually on the page
 *
 * No Shadow DOM anywhere. Everything renders into the light DOM so your
 * global tokens cascade in and developers can inspect and override styles.
 */
export class UiElement extends HTMLElement {
  connectedCallback() {
    // Progressive enhancement: markup authored by hand stays usable, and we
    // only upgrade it once the element is in the document.
    if (!this._upgraded) {
      this._upgraded = true;
      this.render();
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this._upgraded) return;
    this.render();
  }

  /** Subclasses override this. Default is a no-op so a bare tag never throws. */
  render() {}

  /** Read an attribute with a fallback, e.g. this.attr('size', 'md'). */
  attr(name, fallback = '') {
    return this.getAttribute(name) ?? fallback;
  }

  /** Read a boolean attribute — present means true, regardless of its value. */
  boolAttr(name) {
    return this.hasAttribute(name);
  }

  /** Set or remove a boolean attribute from a JS property setter. */
  setBoolAttr(name, value) {
    if (value) this.setAttribute(name, '');
    else this.removeAttribute(name);
  }

  /**
   * Fire one of the documented component events.
   * Always bubbles and crosses shadow boundaries, so a listener on a wrapper
   * (or on document) will hear it.
   */
  emit(type, detail = {}) {
    const event = new CustomEvent(type, {
      detail,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
    return event;
  }
}

/**
 * Define a set of attributes that should also work as JS properties.
 * Saves repeating the same getter/setter pair in every component.
 */
export function reflectProps(ClassRef, props) {
  for (const [name, kind] of Object.entries(props)) {
    Object.defineProperty(ClassRef.prototype, toCamel(name), {
      get() {
        return kind === 'boolean' ? this.boolAttr(name) : this.attr(name);
      },
      set(value) {
        if (kind === 'boolean') this.setBoolAttr(name, value);
        else if (value == null) this.removeAttribute(name);
        else this.setAttribute(name, value);
      },
      configurable: true,
    });
  }
}

function toCamel(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/** Register a custom element, ignoring a duplicate definition on hot reload. */
export function define(tag, ClassRef) {
  if (!customElements.get(tag)) customElements.define(tag, ClassRef);
}

/** Focus trap used by modal and drawer. Returns a teardown function. */
export function trapFocus(container, onEscape) {
  const SELECTOR =
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function onKeydown(event) {
    if (event.key === 'Escape') {
      onEscape?.();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = [...container.querySelectorAll(SELECTOR)].filter(
      (el) => el.offsetParent !== null
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Wrap around at both ends so focus never escapes the dialog.
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  container.addEventListener('keydown', onKeydown);
  return () => container.removeEventListener('keydown', onKeydown);
}
