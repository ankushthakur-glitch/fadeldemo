/**
 * Add / edit a location — a full page rather than a dialog.
 *
 * The Location Form is long (four panels on the left, seven on the right),
 * and a dialog forced two scrollbars: one for the page behind and one inside
 * the dialog. On its own page it gets the whole viewport and a sticky footer.
 *
 * ?id=<locationId> edits an existing location; without it, a blank one.
 */
import { LOCATIONS, LOCATION_COLOURS } from '../../data/practice.js';
import {
  locationFormMarkup,
  wireLocationForm,
  blankLocation,
} from './location-form.js';
import { registerSwatches } from '../lib/swatches.js';

const BACK = 'practice-settings.html?tab=locations';

customElements.whenDefined('ui-input').then(() => {
  const form = document.getElementById('locationForm');
  const title = document.querySelector('[data-testid="loc--title"]');
  const status = document.getElementById('formStatus');
  const save = document.querySelector('[data-testid="loc--save"]');
  const cancel = document.querySelector('[data-testid="loc--cancel"]');
  if (!form) return;

  registerSwatches([...LOCATIONS.map((l) => l.colour), ...LOCATION_COLOURS]);

  const id = new URLSearchParams(window.location.search).get('id');
  const existing = id ? LOCATIONS.find((l) => l.id === id) : null;

  if (existing) {
    title.textContent = `Edit ${existing.name}`;
    document.title = `GastroEMR — ${existing.name}`;
  }

  form.innerHTML = locationFormMarkup(existing || blankLocation());
  wireLocationForm(form);

  save?.addEventListener('ui-click', () => {
    const name = form.querySelector('[data-testid="loc--name"]');
    if (!name.value.trim()) {
      name.setAttribute('error', 'Location name is required');
      status.textContent = 'A location name is required before saving.';
      name.focus();
      return;
    }
    name.removeAttribute('error');
    status.textContent = '';
    window.location.href = BACK;
  });

  cancel?.addEventListener('ui-click', () => {
    window.location.href = BACK;
  });
});
