/**
 * Practice Settings → Print Configuration.
 *
 * Letterheads for prescriptions, referrals, notes and invoices. The tests
 * concentrate on the two claims the screen makes that would be expensive if
 * false: that exactly one configuration is the default, and that the preview
 * shows what would actually print — the live preview in the editor and the
 * preview dialog come from one renderer, so a divergence between them would
 * mean one of the two is lying.
 *
 * THE LIST IS A TABLE, AND IT PAGES. It used to be one card per configuration,
 * each carrying a thumbnail of its own letterhead — which meant that answering
 * "which of these is the default" on a practice with fifty headers on file was
 * half a minute of scrolling. So the count assertions here read the pager's
 * range line rather than counting rows: only a page of rows is in the DOM at
 * any time, and a row count would be asserting the page size.
 */
import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations } from '../helpers/page-helpers.js';
import { PRINT_CONFIGS } from '../../data/print-config.js';

const PRINT = '/screens/practice-settings.html?tab=print';

/* Read from the seed rather than written down beside it. This was a literal 3
   from when the file held three headers by hand; fifty more were seeded later
   and the constant did not move, so every count assertion here was measuring
   against a number that had stopped being true. */
const SEEDED = PRINT_CONFIGS.length;

/** The rows currently on the open page. */
const rows = (page) => page.getByTestId('prn--table').locator('tbody tr');

/** How many the list holds in total, read off the pager rather than counted —
 *  the table only ever holds one page of them. */
const total = (page) => page.getByTestId('prn--range');

/** Sorting A → Z and reading the top row is how a "which one is first"
 *  assertion stays honest across a paged list. */
async function sortAZ(page) {
  await page.getByTestId('prn--sort').locator('select').selectOption('A → Z');
}

/**
 * Set as Default, Duplicate and Delete live behind the row's "⋮" — see
 * PRINT_COLUMNS in js/screens/practice-print-config.js. The panel the "⋮"
 * opens is parented to <body>, not to the row, so an item inside it is reached
 * from the page and never from the row locator.
 *
 * The row has to be ON the open page to be clicked, so the caller searches for
 * it by name after narrowing the list.
 */
async function openRowMenu(page, name) {
  await page.getByTestId('prn--search').locator('input').fill(name);
  await rows(page).filter({ hasText: name }).getByTestId('prn--card-menu').click();
  return page.locator('#ui-row-menu-panel');
}

test.describe('print configuration — the list', () => {
  test('lists the saved configurations with their metadata', async ({ page }) => {
    const assertClean = failOnConsoleErrors(page);
    await page.goto(PRINT);

    await expect(page.getByRole('tab', { name: 'Print Configuration' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(total(page)).toContainText(`of ${SEEDED} configurations`);

    /* The columns a person scans: what it is, how it is laid out, what it
       prints on, and when it last moved. */
    const first = rows(page).first();
    await expect(first).toContainText('version');
    await expect(first).toContainText('aligned');
    await expect(first).toContainText('Portrait');

    assertClean();
  });

  /**
   * The letterhead is judged full size, behind Preview, and nowhere else.
   *
   * Each card used to carry a postage-stamp rendering of its own header, which
   * was never proof that it prints correctly and competed with the real
   * preview one button away. The dialog shows it on every sample document.
   */
  test('Preview renders the header it would print', async ({ page }) => {
    await page.goto(PRINT);
    await page.getByTestId('prn--search').locator('input').fill('GastroEMR Practice Header');
    await rows(page).first().getByRole('button', { name: 'Preview' }).click();

    const dialog = page.locator('#prnPreviewModal');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.prn__header-logo img').first()).toBeVisible();
    await expect(dialog.locator('.prn__header-text').first()).toContainText(
      'GastroEMR Gastroenterology Clinic'
    );
    // Practice facts are pulled from the profile, not retyped.
    await expect(dialog.locator('.prn__header-facts').first()).toContainText('NPI: 1962748503');
  });

  test('exactly one configuration is the default', async ({ page }) => {
    await page.goto(PRINT);
    await page.getByTestId('prn--filter').locator('select').selectOption('Default');
    await expect(total(page)).toContainText('of 1 configuration');
  });

  /**
   * The rule that matters: promoting one demotes the other. Two defaults means
   * the practice does not know what its own documents look like.
   */
  test('setting a new default removes it from the previous one', async ({ page }) => {
    await page.goto(PRINT);

    const menu = await openRowMenu(page, 'Centered Referral Header');
    await menu.getByTestId('prn--set-default').click();

    await expect(
      rows(page).filter({ hasText: 'Centered Referral Header' }).getByTestId('prn--default-badge')
    ).toBeVisible();

    await page.getByTestId('prn--search').locator('input').fill('GastroEMR Practice Header');
    await expect(
      rows(page).filter({ hasText: 'GastroEMR Practice Header' }).getByTestId('prn--default-badge')
    ).toHaveCount(0);

    // And still only one of them anywhere.
    await page.getByTestId('prn--search').locator('input').fill('');
    await page.getByTestId('prn--filter').locator('select').selectOption('Default');
    await expect(total(page)).toContainText('of 1 configuration');
  });

  test('the default cannot be deleted', async ({ page }) => {
    await page.goto(PRINT);
    const menu = await openRowMenu(page, 'GastroEMR Practice Header');
    await menu.getByTestId('prn--delete').click();

    await expect(page.locator('#rolesFlash')).toContainText('default header');
    await expect(page.locator('#prnDeleteModal')).toBeHidden();

    await page.getByTestId('prn--search').locator('input').fill('');
    await expect(total(page)).toContainText(`of ${SEEDED} configurations`);
  });

  test('a non-default is deleted through a confirmation', async ({ page }) => {
    await page.goto(PRINT);
    const menu = await openRowMenu(page, 'Billing Statement Header');
    await menu.getByTestId('prn--delete').click();

    await expect(page.locator('#prnDeleteModal')).toContainText('no longer be available');
    await page.getByTestId('prn--delete-confirm').click();

    await expect(rows(page)).toHaveCount(0);
    await page.getByTestId('prn--search').locator('input').fill('');
    await expect(total(page)).toContainText(`of ${SEEDED - 1} configurations`);
  });

  test('duplicating names the copy rather than colliding', async ({ page }) => {
    await page.goto(PRINT);
    const menu = await openRowMenu(page, 'Centered Referral Header');
    await menu.getByRole('menuitem', { name: 'Duplicate' }).click();

    await expect(
      rows(page).filter({ hasText: 'Centered Referral Header (copy)' })
    ).toHaveCount(1);

    await page.getByTestId('prn--search').locator('input').fill('');
    await expect(total(page)).toContainText(`of ${SEEDED + 1} configurations`);

    // A duplicate must never inherit the default flag.
    await page.getByTestId('prn--filter').locator('select').selectOption('Default');
    await expect(total(page)).toContainText('of 1 configuration');
  });

  test('search, filter and sort narrow the list', async ({ page }) => {
    await page.goto(PRINT);

    await page.getByTestId('prn--search').locator('input').fill('billing');
    await expect(total(page)).toContainText('of 1 configuration');

    await page.getByTestId('prn--search').locator('input').fill('');
    await expect(total(page)).toContainText(`of ${SEEDED} configurations`);

    await page.getByTestId('prn--filter').locator('select').selectOption('Default');
    await expect(total(page)).toContainText('of 1 configuration');

    await page.getByTestId('prn--filter').locator('select').selectOption('Custom');
    await expect(total(page)).toContainText(`of ${SEEDED - 1} configurations`);

    await page.getByTestId('prn--filter').locator('select').selectOption('All');
    await sortAZ(page);
    await expect(rows(page).first()).toContainText('Appeal Letter Header');
  });

  test('a search with no matches says so', async ({ page }) => {
    await page.goto(PRINT);
    await page.getByTestId('prn--search').locator('input').fill('zzzz');
    await expect(page.getByTestId('prn--table')).toHaveAttribute('state', 'empty');
    await expect(page.getByTestId('prn--table')).toContainText('No print configuration matches.');
  });
});

test.describe('print configuration — the editor', () => {
  test('Add New opens an empty form beside a live preview', async ({ page }) => {
    await page.goto(PRINT);
    await page.getByTestId('prc--add-print-config').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('New Print Configuration');
    await expect(page.getByTestId('prn--name').locator('input')).toHaveValue('');
    await expect(page.locator('.prn__editor-preview')).toBeVisible();
    await expect(page.getByTestId('prn--page')).toBeVisible();
  });

  test('a header name is required and cannot duplicate an existing one', async ({ page }) => {
    await page.goto(PRINT);
    await page.getByTestId('prc--add-print-config').click();

    await page.getByTestId('prn--save').click();
    await expect(page.getByTestId('prn--name')).toContainText('Enter a header name');

    await page.getByTestId('prn--name').locator('input').fill('GastroEMR Practice Header');
    await page.getByTestId('prn--save').click();
    await expect(page.getByTestId('prn--name')).toContainText('already exists');
  });

  /** The preview is the whole point, so it has to follow the typing. */
  test('the live preview updates as the header text is typed', async ({ page }) => {
    await page.goto(PRINT);
    await page.getByTestId('prc--add-print-config').click();

    await page.getByTestId('prn--rte').click();
    await page.keyboard.type('GastroEMR GI — Endoscopy Unit');

    await expect(page.locator('#prnLivePreview')).toContainText('GastroEMR GI — Endoscopy Unit');
  });

  test('ticking a practice field adds that line to the preview', async ({ page }) => {
    await page.goto(PRINT);
    await page.getByTestId('prc--add-print-config').click();

    await expect(page.locator('#prnLivePreview')).not.toContainText('NPI:');
    await page.getByTestId('prn--fields').locator('input[value="npi"]').check();
    await expect(page.locator('#prnLivePreview')).toContainText('NPI: 1962748503');
  });

  test('a footer option adds its line to the preview', async ({ page }) => {
    await page.goto(PRINT);
    await page.getByTestId('prc--add-print-config').click();

    await page.getByTestId('prn--footer').locator('input[value="hipaa"]').check();
    await expect(page.locator('#prnLivePreview .prn__footer')).toContainText('HIPAA');
  });

  test('changing the sample document changes what is previewed', async ({ page }) => {
    await page.goto(PRINT);
    await page.getByTestId('prc--add-print-config').click();

    await expect(page.locator('#prnLivePreview')).toContainText('Prescribed');
    await page.getByTestId('prn--sample').locator('select').selectOption('Invoice');
    await expect(page.locator('#prnLivePreview')).toContainText('Balance due');
  });

  test('the line counter tracks the six-line limit', async ({ page }) => {
    await page.goto(PRINT);
    await page.getByTestId('prc--add-print-config').click();

    await expect(page.locator('#prnLineCount')).toHaveText('0');
    await page.getByTestId('prn--rte').click();
    await page.keyboard.type('One');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Two');

    await expect(page.locator('#prnLineCount')).toHaveText('2');
  });

  /**
   * A layout that prints a logo but has none would silently produce a blank
   * band at the top of every prescription.
   */
  test('a logo layout with no logo is refused', async ({ page }) => {
    await page.goto(PRINT);
    await page.getByTestId('prc--add-print-config').click();

    /* A name no seeded header already uses. "Logo Only Header" is one of them,
       and validateDraft() checks uniqueness before it checks the logo — so the
       test was watching the name collision it had caused rather than the rule
       it meant to exercise. */
    await page.getByTestId('prn--name').locator('input').fill('Endoscopy Logo Header');
    await page.getByTestId('prn--layout').locator('input[value="logo-only"]').check();
    await page.getByTestId('prn--save').click();

    await expect(page.locator('#rolesFlash')).toContainText('upload one or switch to Text Only');
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('an oversized logo is rejected with its actual size', async ({ page }) => {
    await page.goto(PRINT);
    await page.getByTestId('prc--add-print-config').click();

    await page.getByTestId('prn--logo-input').setInputFiles({
      name: 'huge.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(4 * 1024 * 1024),
    });

    await expect(page.locator('#prnLogoError')).toContainText('The limit is 3 MB');
  });

  test('a wrong logo format is rejected', async ({ page }) => {
    await page.goto(PRINT);
    await page.getByTestId('prc--add-print-config').click();

    await page.getByTestId('prn--logo-input').setInputFiles({
      name: 'letterhead.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4'),
    });

    await expect(page.locator('#prnLogoError')).toContainText('PNG, SVG or JPEG');
  });

  test('a text-only configuration saves and appears in the list', async ({ page }) => {
    await page.goto(PRINT);
    await page.getByTestId('prc--add-print-config').click();

    await page.getByTestId('prn--name').locator('input').fill('Endoscopy Unit Header');
    await page.getByTestId('prn--layout').locator('input[value="text-only"]').check();
    await page.getByTestId('prn--rte').click();
    await page.keyboard.type('GastroEMR GI — Endoscopy Unit');
    await page.getByTestId('prn--save').click();

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(total(page)).toContainText(`of ${SEEDED + 1} configurations`);
    await expect(rows(page).first()).toContainText('Endoscopy Unit Header');

    // New configurations never steal the default.
    await page.getByTestId('prn--filter').locator('select').selectOption('Default');
    await expect(total(page)).toContainText('of 1 configuration');
  });

  test('Edit loads the saved values', async ({ page }) => {
    await page.goto(PRINT);
    await page.getByTestId('prn--search').locator('input').fill('GastroEMR Practice Header');
    await rows(page)
      .filter({ hasText: 'GastroEMR Practice Header' })
      .getByRole('button', { name: 'Edit' })
      .click();

    await expect(page.getByTestId('prn--name').locator('input')).toHaveValue(
      'GastroEMR Practice Header'
    );
    await expect(page.getByTestId('prn--rte')).toContainText('GastroEMR Gastroenterology Clinic');
    await expect(page.getByTestId('prn--fields').locator('input[value="npi"]')).toBeChecked();
    await expect(page.getByTestId('prn--paper').locator('select')).toHaveValue(/Letter/);
  });

  test('Save As New branches instead of overwriting', async ({ page }) => {
    await page.goto(PRINT);
    await page.getByTestId('prn--search').locator('input').fill('GastroEMR Practice Header');
    await rows(page)
      .filter({ hasText: 'GastroEMR Practice Header' })
      .getByRole('button', { name: 'Edit' })
      .click();

    await page.getByTestId('prn--name').locator('input').fill('GastroEMR Header — Procedures');
    await page.getByTestId('prn--save-as-new').click();

    await page.getByTestId('prn--search').locator('input').fill('GastroEMR');
    await expect(rows(page).filter({ hasText: 'GastroEMR Header — Procedures' })).toHaveCount(1);
    await expect(rows(page).filter({ hasText: 'GastroEMR Practice Header' })).toHaveCount(1);

    await page.getByTestId('prn--search').locator('input').fill('');
    await expect(total(page)).toContainText(`of ${SEEDED + 1} configurations`);
  });

  test('Save As New is offered only when editing an existing header', async ({ page }) => {
    await page.goto(PRINT);
    await page.getByTestId('prc--add-print-config').click();
    await expect(page.getByTestId('prn--save-as-new')).toBeHidden();
  });
});

test.describe('print configuration — preview dialog', () => {
  test('shows every sample document with the chosen header', async ({ page }) => {
    await page.goto(PRINT);
    await page.getByTestId('prn--search').locator('input').fill('GastroEMR Practice Header');
    await rows(page)
      .filter({ hasText: 'GastroEMR Practice Header' })
      .getByRole('button', { name: 'Preview' })
      .click();

    const stage = page.locator('#prnPreviewStage');
    await expect(stage.locator('.prn__page')).toHaveCount(5);
    await expect(stage).toContainText('Prescription');
    await expect(stage).toContainText('Referral');
    await expect(stage).toContainText('Invoice');
  });

  test('zoom in, out and fit width move the level', async ({ page }) => {
    await page.goto(PRINT);
    await rows(page).first().getByRole('button', { name: 'Preview' }).click();

    await expect(page.getByTestId('prn--zoom-level')).toHaveText('100%');
    await page.getByTestId('prn--zoom-in').click();
    await expect(page.getByTestId('prn--zoom-level')).toHaveText('110%');
    await page.getByTestId('prn--zoom-out').click();
    await page.getByTestId('prn--zoom-out').click();
    await expect(page.getByTestId('prn--zoom-level')).toHaveText('90%');
    await page.getByTestId('prn--zoom-fit').click();
    await expect(page.getByTestId('prn--zoom-level')).toHaveText('100%');
  });

  /** A button that cannot do the thing says so rather than doing nothing. */
  test('Download PDF explains the prototype has no renderer', async ({ page }) => {
    await page.goto(PRINT);
    await rows(page).first().getByRole('button', { name: 'Preview' }).click();
    await page.getByTestId('prn--preview-pdf').click();

    await expect(page.locator('#rolesFlash')).toContainText('Save as PDF');
  });
});

test.describe('print configuration — quality', () => {
  test('no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await page.goto(PRINT);
    await expect(rows(page).first()).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('no WCAG 2.1 A/AA violations in the editor @a11y', async ({ page }) => {
    await page.goto(PRINT);
    await page.getByTestId('prc--add-print-config').click();
    await expect(page.getByTestId('prn--page')).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('visual — configuration list', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1400 });
    await page.goto(PRINT);
    await expect(rows(page).first()).toBeVisible();
    await expect(page.getByTestId('prn--list')).toHaveScreenshot('print-config-list.png');
  });
});
