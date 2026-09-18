/**
 * The Schedule Appointment menu, and the Instant Appointment behind it.
 *
 * Two ways to start a visit, and the point of the tests is that they stay two
 * DIFFERENT things: New Appointment books a slot for later through the full
 * form, Instant takes the patient standing at the desk straight into an
 * encounter. The second must not quietly become a shortcut that skips making
 * a booking — an encounter with no appointment behind it has nothing to bill,
 * nothing on the day list, and nothing for check-out to close.
 */
import { test, expect } from '@playwright/test';
import { expectNoA11yViolations } from '../helpers/page-helpers.js';

const SCHEDULER = '/screens/scheduler.html';

const errs = (page) => {
  const out = [];
  page.on('console', (m) => m.type() === 'error' && out.push(m.text()));
  page.on('pageerror', (e) => out.push(String(e)));
  return out;
};

const openMenu = async (page) => {
  await page.goto(SCHEDULER);
  await page.getByTestId('sch--new').click();
  await expect(page.locator('#schNewMenu')).toBeVisible();
};

async function openInstant(page) {
  await openMenu(page);
  await page.getByTestId('sch--menu-instant').click();
  await expect(page.locator('#instantModal')).toBeVisible();
}

/** Care type, then patient, then provider — the dialog's whole job. */
async function fillInstant(page, kind) {
  await page.getByTestId(`sch--instant-kind-${kind}`).click();
  await page.getByTestId('sch--instant-patient').locator('select').selectOption({ index: 1 });
  await page.getByTestId('sch--instant-provider').locator('select').selectOption({ index: 1 });
}

/* ===================== The menu ===================== */

test.describe('schedule menu', () => {
  test('the primary action offers both ways to start', async ({ page }) => {
    await openMenu(page);
    await expect(page.locator('#schNewMenu [role="menuitem"]')).toHaveText([
      'New Appointment',
      'Instant Appointment',
    ]);
  });

  /* The menu opens from the real <button>, so that is where the state has to
     be announced — on the host it would sit on a wrapper nothing reads. */
  test('the trigger says it opens a menu, and whether it is open', async ({ page }) => {
    await page.goto(SCHEDULER);
    const control = page.getByTestId('sch--new').locator('button');

    await expect(control).toHaveAttribute('aria-haspopup', 'menu');
    await expect(control).toHaveAttribute('aria-expanded', 'false');

    await control.click();
    await expect(control).toHaveAttribute('aria-expanded', 'true');
  });

  test('Escape closes the menu and hands focus back', async ({ page }) => {
    await openMenu(page);
    await page.keyboard.press('Escape');

    await expect(page.locator('#schNewMenu')).toHaveCount(0);
    await expect(page.getByTestId('sch--new').locator('button')).toBeFocused();
    await expect(page.getByTestId('sch--new').locator('button')).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  test('clicking away closes the menu', async ({ page }) => {
    await openMenu(page);
    // The appointment count — visible, inert, and nowhere near the menu.
    await page.getByTestId('sch--count').click();
    await expect(page.locator('#schNewMenu')).toHaveCount(0);
  });

  /** The existing flow, unchanged behind its new first step. */
  test('New Appointment still opens the full booking form', async ({ page }) => {
    await openMenu(page);
    await page.getByTestId('sch--menu-new').click();

    await expect(page.locator('#apptModal')).toBeVisible();
    await expect(page.getByTestId('sch--m-kind')).toContainText('Care Type');
  });
});

/* ===================== The dialog ===================== */

test.describe('instant appointment — the form', () => {
  test('asks care type first, and offers the same three the booking form does', async ({
    page,
  }) => {
    await openInstant(page);

    await expect(page.locator('#instantKinds [data-kind] strong')).toHaveText([
      'Clinical',
      'Procedure',
      'Infusion',
    ]);
    // One choice with three answers, not three unrelated buttons.
    await expect(page.getByTestId('sch--instant-kinds')).toHaveAttribute('role', 'radiogroup');
  });

  /* The care type decides how long the visit is and where it happens, so
     asking who before asking what would be asking in the wrong order. */
  test('the patient step appears only once a care type is chosen', async ({ page }) => {
    await openInstant(page);
    await expect(page.locator('#instantWho')).toBeHidden();

    await page.getByTestId('sch--instant-kind-clinical').click();
    await expect(page.locator('#instantWho')).toBeVisible();
    await expect(page.getByTestId('sch--instant-kind-clinical')).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  /**
   * Choosing one grows the panel — the patient step appears — so everything
   * below shifts up and the NEXT option slides under the cursor. If hover and
   * chosen look the same, two of three read as chosen at the exact moment the
   * answer matters. The chosen one owns the fill and carries a tick; hover
   * gets the border only.
   */
  test('the chosen care type does not look like the merely hovered one', async ({
    page,
  }) => {
    await openInstant(page);
    await page.getByTestId('sch--instant-kind-procedure').click();
    await page.getByTestId('sch--instant-kind-infusion').hover();

    const fill = (testid) =>
      page.getByTestId(testid).evaluate((el) => getComputedStyle(el).backgroundColor);

    expect(await fill('sch--instant-kind-procedure')).not.toBe(
      await fill('sch--instant-kind-infusion')
    );

    // And not by colour alone.
    await expect(
      page.getByTestId('sch--instant-kind-procedure').locator('.sch__kind-tick')
    ).toBeVisible();
    await expect(
      page.getByTestId('sch--instant-kind-infusion').locator('.sch__kind-tick')
    ).toBeHidden();
  });

  test('arrow keys move through the care types', async ({ page }) => {
    await openInstant(page);
    await page.getByTestId('sch--instant-kind-clinical').click();
    await page.getByTestId('sch--instant-kind-clinical').focus();

    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('sch--instant-kind-procedure')).toHaveAttribute(
      'aria-checked',
      'true'
    );
    await expect(page.getByTestId('sch--instant-kind-clinical')).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });

  /** What is about to be created, said before the button that creates it. */
  test('states the booking it is about to make', async ({ page }) => {
    await openInstant(page);
    await expect(page.getByTestId('sch--instant-summary')).toBeHidden();

    await page.getByTestId('sch--instant-kind-procedure').click();
    const summary = page.getByTestId('sch--instant-summary');

    await expect(summary).toBeVisible();
    await expect(summary).toContainText('Procedure Visit');
    await expect(summary).toContainText('Red River ASC');
    await expect(summary).toContainText('today');
  });

  test('a care type is required before anything else', async ({ page }) => {
    await openInstant(page);
    await page.getByTestId('sch--instant-start').click();

    await expect(page.locator('#instantNotice')).toContainText('Choose a care type');
    await expect(page.locator('#instantModal')).toBeVisible();
  });

  /* Each missing field names itself. "Complete the form" makes the reader
     hunt for which one. */
  test('patient and provider are each required by name', async ({ page }) => {
    await openInstant(page);
    await page.getByTestId('sch--instant-kind-clinical').click();
    await page.getByTestId('sch--instant-start').click();

    await expect(page.getByTestId('sch--instant-patient')).toContainText(
      'Choose the patient in front of you'
    );
    await expect(page.getByTestId('sch--instant-provider')).toContainText(
      'Choose whose encounter this is'
    );
    expect(page.url()).toContain('scheduler.html');
  });

  /** A second instant appointment must not inherit the first one's answers. */
  test('reopening starts from nothing chosen', async ({ page }) => {
    await openInstant(page);
    await fillInstant(page, 'procedure');
    await page.getByTestId('sch--instant-cancel').click();

    await page.getByTestId('sch--new').click();
    await page.getByTestId('sch--menu-instant').click();

    await expect(page.locator('#instantWho')).toBeHidden();
    await expect(page.getByTestId('sch--instant-kind-procedure')).toHaveAttribute(
      'aria-checked',
      'false'
    );
    await expect(page.getByTestId('sch--instant-patient').locator('select')).toHaveValue('');
  });
});

/* ===================== Starting the encounter ===================== */

test.describe('instant appointment — starting', () => {
  test('goes straight into the encounter', async ({ page }) => {
    const errors = errs(page);
    await openInstant(page);
    await fillInstant(page, 'clinical');
    await page.getByTestId('sch--instant-start').click();

    await page.waitForURL(/encounter\.html\?appt=ap\d+/);
    expect(errors).toEqual([]);
  });

  /**
   * Every care type opens the SAME encounter.
   *
   * There used to be two: a staged workspace for a procedure and a single-note
   * screen for a clinic visit, and this spec proved the care type picked here
   * decided between them. The staged screen is gone — the step run took its
   * address and every flow lands on it — so what is worth proving now is the
   * opposite: no care type falls through to a different screen or to none.
   *
   * The step rail is the assertion because it is the thing the run IS. A
   * booking that opened the encounter with an empty rail would be a screen
   * that loaded and told the room nothing.
   */
  for (const kind of ['clinical', 'infusion', 'procedure']) {
    test(`${kind} opens the encounter's step run`, async ({ page }) => {
      await openInstant(page);
      await fillInstant(page, kind);
      await page.getByTestId('sch--instant-start').click();
      await page.waitForURL(/encounter\.html/);

      await expect(page.getByTestId('encv--step-checklist')).toBeVisible();
      await expect(page.locator('.encv__step')).toHaveCount(7);
    });
  }

  /**
   * The booking is real, not a shortcut around one. Without it there is
   * nothing to bill, nothing on the day list and nothing to check out.
   */
  test('the visit is booked, not just opened', async ({ page }) => {
    await openInstant(page);
    await fillInstant(page, 'clinical');
    await page.getByTestId('sch--instant-start').click();
    await page.waitForURL(/encounter\.html/);

    const id = new URL(page.url()).searchParams.get('appt');
    const record = await page.evaluate((key) => {
      const list = JSON.parse(sessionStorage.getItem('medinova.appointments') ?? '[]');
      return list.find((a) => a.id === key) ?? null;
    }, id);

    expect(record, 'the appointment should be in the store').not.toBeNull();
    expect(record.kind).toBe('clinical');
    expect(record.date).toBe('2026-08-04'); // today, in the fixed demo clock
    // Already here, already seen — there is nothing left to check in.
    expect(record.status).toBe('Checked In');
    expect(record.mrn).toBeTruthy();
    expect(record.providerId).toBeTruthy();
  });

  test('the booking shows up back on the schedule', async ({ page }) => {
    await openInstant(page);
    await fillInstant(page, 'clinical');
    await page.getByTestId('sch--instant-start').click();
    await page.waitForURL(/encounter\.html/);
    const id = new URL(page.url()).searchParams.get('appt');

    await page.goto(SCHEDULER);
    const survived = await page.evaluate((key) => {
      const list = JSON.parse(sessionStorage.getItem('medinova.appointments') ?? '[]');
      return list.some((a) => a.id === key);
    }, id);

    // The scheduler rewrites the whole list on every paint from its own copy,
    // so a booking made outside that copy is exactly what would vanish here.
    expect(survived, 'the schedule must not overwrite the new booking').toBe(true);
  });
});

test.describe('instant appointment — accessibility', () => {
  test('the menu has no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await openMenu(page);
    await expectNoA11yViolations(page);
  });

  test('the dialog has no WCAG 2.1 A/AA violations @a11y', async ({ page }) => {
    await openInstant(page);
    await page.getByTestId('sch--instant-kind-procedure').click();
    await expectNoA11yViolations(page);
  });
});
