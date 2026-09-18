import { test, expect } from '@playwright/test';
import { failOnConsoleErrors, expectNoA11yViolations } from '../helpers/page-helpers.js';

/**
 * THE PATIENT PORTAL — /patient/
 *
 * A standalone app: its own URL, its own sign-in, its own session key, and
 * none of the EHR's CSS or components. These tests hold that separation in
 * place as much as they check the screens, because the separation is the
 * thing that is easy to erode by accident later.
 */

const PORTAL = '/patient';

/** The storage key guard.js and lib/auth-store.js must agree on. */
const PATIENT_KEY = 'medinova.patient.auth.v1';
const EHR_KEY = 'medinova.auth.v1';

/** Sign in as the demo patient: an empty form is the reviewer's way in. */
async function signIn(page) {
  await page.goto(`${PORTAL}/login.html`);
  await page.getByTestId('login--submit').click();
  await page.waitForURL(`**${PORTAL}/home.html`);
}

test.describe('sign-in', () => {
  test('the portal has its own address and its own door', async ({ page }) => {
    const clean = failOnConsoleErrors(page);

    // /patient/ is the front door and it leads to the patient login, not the
    // EHR's. A regression here is the whole feature quietly undone.
    await page.goto(`${PORTAL}/`);
    await page.waitForURL(`**${PORTAL}/login.html`);

    await expect(page.getByRole('heading', { name: 'Login', level: 1 })).toBeVisible();
    await expect(page.getByTestId('login--email')).toBeVisible();
    await expect(page.getByTestId('login--password')).toBeVisible();
    clean();
  });

  test('an empty form signs the reviewer in', async ({ page }) => {
    const clean = failOnConsoleErrors(page);
    await signIn(page);
    // The top bar's account button names the signed-in patient in full; the
    // dashboard greets them by first name — see js/screens/home.js.
    await expect(page.getByTestId('topbar--account')).toHaveAttribute(
      'aria-label',
      'Account menu for Henna West'
    );
    clean();
  });

  test('a wrong password is refused and counted', async ({ page }) => {
    await page.goto(`${PORTAL}/login.html`);
    await page.getByTestId('login--email').fill('henna.west@example.com');
    await page.getByTestId('login--password').fill('nope');
    await page.getByTestId('login--submit').click();

    const error = page.getByTestId('login--error');
    await expect(error).toBeVisible();
    await expect(error).toContainText('incorrect');
    await expect(page).toHaveURL(/login\.html/);
  });

  test('the reveal button shows and re-hides the password', async ({ page }) => {
    await page.goto(`${PORTAL}/login.html`);
    const field = page.getByTestId('login--password');
    await field.fill('Portal!2026');

    await expect(field).toHaveAttribute('type', 'password');
    await page.getByTestId('login--reveal').click();
    await expect(field).toHaveAttribute('type', 'text');
    await page.getByTestId('login--reveal').click();
    await expect(field).toHaveAttribute('type', 'password');
  });
});

test.describe('session separation', () => {
  test('a signed-out visitor never sees a portal screen', async ({ page }) => {
    await page.goto(`${PORTAL}/login.html`); // establishes the origin
    await page.evaluate(() => localStorage.clear());

    await page.goto(`${PORTAL}/home.html`);
    await page.waitForURL(/login\.html\?reason=session-expired/);
    await expect(page.getByTestId('login--error')).toContainText('signed out');
  });

  /*
   * The one that matters most.
   *
   * A clinician's EHR session must grant nothing here. If someone ever
   * "simplifies" the two stores into one, this is the test that fails.
   */
  test('an EHR session does not open the portal', async ({ page }) => {
    await page.goto(`${PORTAL}/login.html`);
    await page.evaluate((key) => {
      localStorage.clear();
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          attempts: {},
          lockedUntil: {},
          session: {
            email: 'amara.mensah@medinovagi.example',
            name: 'Amara Mensah',
            role: 'Physician',
            startedAt: Date.now(),
            expiresAt: Date.now() + 3_600_000,
          },
          device: null,
        })
      );
    }, EHR_KEY);

    await page.goto(`${PORTAL}/home.html`);
    await page.waitForURL(/login\.html/);
  });

  test('signing into the portal writes only the patient key', async ({ page }) => {
    await signIn(page);

    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys).toContain(PATIENT_KEY);
    expect(keys).not.toContain(EHR_KEY);
  });

  test('signing out ends the session', async ({ page }) => {
    await signIn(page);
    await page.getByTestId('topbar--account').click();
    await page.getByTestId('topbar--sign-out').click();
    await page.waitForURL(/login\.html/);

    await page.goto(`${PORTAL}/home.html`);
    await page.waitForURL(/login\.html/);
  });
});

test.describe('the shell', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('the top bar carries the logo, the bell and the account', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'CustomEHR' })).toBeVisible();
    await expect(page.getByTestId('topbar--notifications')).toHaveAttribute(
      'aria-label',
      /2 unread/
    );
    await expect(page.getByTestId('topbar--account')).toBeVisible();
  });

  test('every section in the side nav is reachable', async ({ page }) => {
    for (const id of ['home', 'appointment', 'documents', 'education']) {
      await expect(page.getByTestId(`nav--${id}`)).toBeVisible();
    }

    // Groups start collapsed and open on click.
    const billing = page.getByTestId('nav--billing');
    await expect(billing).toHaveAttribute('aria-expanded', 'false');
    await billing.click();
    await expect(billing).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('nav--billing-statements')).toBeVisible();
  });

  test('a tab of a section lights that section in the nav', async ({ page }) => {
    // Card Details is a Profile tab, so the row the sidebar lights is Profile
    // — not Billing, which is where the screen used to live.
    await page.goto(`${PORTAL}/profile-cards.html`);
    await expect(page.getByTestId('nav--profile')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('profile--tab-cards')).toHaveAttribute('aria-current', 'page');
  });

  test('Home has no breadcrumb and the others do', async ({ page }) => {
    await expect(page.locator('#crumbs')).toHaveCount(0);

    await page.goto(`${PORTAL}/documents.html`);
    await expect(page.locator('#crumbs')).toContainText('Documents');
    await expect(page.locator('#crumbs')).toContainText('Not Completed');
  });
});

test.describe('home', () => {
  test('all three cards are drawn', async ({ page }) => {
    const clean = failOnConsoleErrors(page);
    await signIn(page);

    await expect(page.getByTestId('home--appointment')).toContainText('Jane Cooper');
    await expect(page.getByTestId('home--medications')).toContainText('Coumadin');
    await expect(page.getByTestId('home--forms')).toContainText('Insurance Disclosure');
    clean();
  });

  test('the errand bands are gone from the dashboard', async ({ page }) => {
    await signIn(page);

    // The balance panel with its Pay Bill button and the attention tiles used
    // to sit above the cards. Each errand has a screen of its own in the nav
    // now, and the record starts at the top of the well.
    await expect(page.getByTestId('home--balance')).toHaveCount(0);
    await expect(page.getByTestId('home--pay')).toHaveCount(0);
    await expect(page.getByTestId('home--attention')).toHaveCount(0);

    // Messages came back as a CARD in the grid, not as the digest band of
    // quoted replies that ran across the foot: a list of threads with a
    // "More ↗" on it, the same shape as the cards beside it.
    const messages = page.getByTestId('home--messages');
    await expect(messages).toHaveClass(/pp-card/);
    await expect(messages.getByRole('link', { name: /More/ })).toHaveAttribute(
      'href',
      'messages.html'
    );
  });

  test('a thread row stays inside the Messages card', async ({ page }) => {
    await signIn(page);

    // The list is a flex item inside the card body, and a flex item's
    // automatic minimum is its MIN-CONTENT width — which, for a row whose
    // preview is `white-space: nowrap`, is the whole untruncated sentence.
    // Left at auto the row hairlines ran out past the card's right border and
    // the unread badge was drawn outside the card altogether. `min-width: 0`
    // on .pp-home__list .pp-list is what holds them in.
    const card = page.getByTestId('home--messages');
    const cardBox = await card.boundingBox();
    const badgeBox = await card.locator('.pp-badge').first().boundingBox();

    expect(badgeBox.x + badgeBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);

    // And the preview it was pushing out is cut with an ellipsis rather than
    // running to its full width.
    const preview = card.locator('.pp-home__preview').last();
    const cut = await preview.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(cut).toBe(true);
  });

  test('the greeting counts what is actually waiting', async ({ page }) => {
    const clean = failOnConsoleErrors(page);
    await signIn(page);

    // Every number in the sentence is taken from the fixtures at paint time —
    // the point of the line is that it cannot claim work that is not there.
    // Four upcoming visits, three forms still to do, two unread.
    const hello = page.getByTestId('home--hello');
    await expect(hello).toContainText('Welcome back, Henna');
    await expect(hello).toContainText('4 upcoming appointments');
    await expect(hello).toContainText('3 forms to complete');
    await expect(hello).toContainText('2 unread notifications');
    clean();
  });

  test('current medication is everything taken today, either source', async ({ page }) => {
    await signIn(page);

    const meds = page.getByTestId('home--medications');
    // Six rows: the four prescribed and the two the patient added themselves.
    // The heading no longer counts them — nothing in this portal states a
    // number on a label — so the rows themselves are what is checked. The
    // self-reported pair say so on the row; nothing stopped appears at all.
    await expect(meds.getByRole('heading')).toContainText('Current Medication');
    await expect(meds.locator('.pp-list__item')).toHaveCount(6);
    await expect(meds).toContainText('Vitamin D3');
    await expect(meds).toContainText('Self-reported');
    await expect(meds).not.toContainText('Famotidine');
  });

  test('the card actions say what they would do', async ({ page }) => {
    await signIn(page);
    await page.getByTestId('home--join').click();
    await expect(page.getByTestId('toast')).toContainText('video visit');
  });

  // The paperwork card is the one list in the grid whose rows carry a
  // control, because a form is a job rather than a fact — see the FORMS &
  // CONSENTS block in js/screens/home.js. The words on it are the Forms
  // screen's own, and pressing it opens THAT form rather than the list.
  test('a pending form is started from the dashboard', async ({ page }) => {
    await signIn(page);

    const card = page.getByTestId('home--forms');
    await expect(card).toContainText('Patient Interview Form');
    await expect(card).toContainText('Due 09/01/2026');
    // A consent asks to be reviewed, a questionnaire to be started.
    await expect(card.getByRole('link', { name: /Review & Consent — Insurance Disclosure/ }))
      .toBeVisible();

    await card.getByRole('link', { name: /Start Form/ }).click();
    await page.waitForURL('**/forms.html?form=form-interview');
    await expect(page.getByTestId('forms--submit')).toBeVisible();

    // And the way out of it is a real address, not a handler on its own: this
    // is now the ordinary way into a form, with no history behind it.
    await expect(page.getByTestId('forms--back')).toHaveAttribute('href', 'forms.html');
  });

  test('"More" leads somewhere real', async ({ page }) => {
    await signIn(page);
    await page.getByTestId('home--medications').getByRole('link', { name: /More/ }).click();
    await page.waitForURL('**/health-medications.html');
    await expect(page.getByTestId('meds--list')).toContainText('Coumadin');
  });
});

test.describe('health records', () => {
  const MEDS = `${PORTAL}/health-medications.html`;

  test('two records on top, current and past inside medications', async ({ page }) => {
    const clean = failOnConsoleErrors(page);
    await signIn(page);
    await page.goto(MEDS);

    // The top strip is the two RECORDS, not four flat panels. If a Pharmacy
    // tab ever reappears here, this is the line that says it was deliberate.
    await expect(page.getByTestId('meds--tab-medications')).toHaveAttribute(
      'aria-current',
      'page'
    );
    await expect(page.getByTestId('meds--tab-allergies')).toBeVisible();
    await expect(page.locator('[data-testid^="meds--tab-"]')).toHaveCount(2);

    // ...and the split by time is the second, nested strip.
    await expect(page.getByTestId('meds--view-current')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('meds--list')).toContainText('Pantoprazole');
    await expect(page.getByTestId('meds--list')).not.toContainText('Prednisone');

    await page.getByTestId('meds--view-past').click();
    await expect(page).toHaveURL(/tab=past/);
    await expect(page.getByTestId('meds--list')).toContainText('Prednisone');
    await expect(page.getByTestId('meds--list')).not.toContainText('Pantoprazole');

    clean();
  });

  test('the current/past control belongs to medications only', async ({ page }) => {
    await signIn(page);
    await page.goto(`${MEDS}?tab=allergies`);

    await expect(page.getByTestId('meds--tab-allergies')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('allergies--list')).toContainText('Sertraline');

    // "Current / Past" over a list of allergies is a question nobody can
    // answer, so the strip is not drawn at all.
    await expect(page.getByTestId('meds--view-current')).toHaveCount(0);
  });

  test('a medication row says where it is dispensed', async ({ page }) => {
    await signIn(page);
    await page.goto(MEDS);

    // The column exists on the table...
    await expect(page.getByTestId('meds--list')).toContainText('Pharmacy');

    // ...and the row carries the value, beside who prescribed it.
    const row = page.locator('[data-med="med-coumadin"]');
    await expect(row).toContainText('Meridian Mail Pharmacy');
    await expect(row).toContainText('Jane Cooper');
  });

  test('nothing on the screen writes', async ({ page }) => {
    await signIn(page);

    // The whole point of the screen as it now stands: it shows the record and
    // the patient amends it by telling the practice. Every one of these was a
    // real control once, and each is a separate way for one to come back.
    for (const tab of ['', '?tab=past', '?tab=allergies']) {
      await page.goto(`${MEDS}${tab}`);
      await expect(page.getByRole('button', { name: /^Add/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Stop|Resume|Remove/ })).toHaveCount(0);
      await expect(page.locator('dialog')).toHaveCount(0);
      await expect(page.locator('[data-edit-allergy]')).toHaveCount(0);
    }
  });

  test('download names the record it will take, not the panel', async ({ page }) => {
    await signIn(page);
    await page.goto(MEDS);

    // One button per RECORD. Current and Past are one download, so the label
    // does not change between them — it changes when the record does.
    const download = page.getByTestId('meds--download');
    await expect(download).toContainText('Download medications');

    await page.getByTestId('meds--view-past').click();
    await expect(download).toContainText('Download medications');

    await page.getByTestId('meds--tab-allergies').click();
    await expect(download).toContainText('Download allergies');
  });

  test('the downloaded sheet holds that record and no other', async ({ page }) => {
    await signIn(page);
    await page.goto(`${MEDS}?tab=allergies`);

    // window.print() would block the run, so it is stubbed — what is being
    // checked is what the document says, not that the dialog opened.
    await page.evaluate(() => {
      window.print = () => {};
    });
    await page.getByTestId('meds--download').click();

    const sheet = page.locator('#printDoc');
    await expect(sheet).toContainText('Allergies');
    await expect(sheet).toContainText('Sertraline');
    // The medications are a separate download. A patient asked for their
    // allergies on a form should not be handing over their drug history.
    await expect(sheet).not.toContainText('Pantoprazole');
    // ...and it still says whose sheet it is.
    await expect(sheet).toContainText('Date of birth');
  });

  test('the medication sheet holds current and past on one document', async ({ page }) => {
    await signIn(page);
    await page.goto(MEDS);

    await page.evaluate(() => {
      window.print = () => {};
    });
    await page.getByTestId('meds--download').click();

    // Pressed on Current, and the past list comes with it: one button, one
    // sheet, the whole medication record. Pressing it on Past does the same.
    const sheet = page.locator('#printDoc');
    await expect(sheet).toContainText('Current medications');
    await expect(sheet).toContainText('Pantoprazole');
    await expect(sheet).toContainText('Past medications');
    await expect(sheet).toContainText('Prednisone');
    // The other record still is not on it.
    await expect(sheet).not.toContainText('Sertraline');
  });
});

test.describe('appointment', () => {
  test('upcoming and past are separate lists', async ({ page }) => {
    const clean = failOnConsoleErrors(page);
    await signIn(page);
    await page.goto(`${PORTAL}/appointment.html`);

    await expect(page.getByTestId('appt--upcoming')).toContainText('February 21, 2027');
    await expect(page.getByTestId('appt--past')).toContainText('Cancelled');
    await expect(page.getByTestId('appt--past')).toContainText('Completed');

    // Cancel belongs only to upcoming visits.
    await expect(page.getByTestId('appt--past').getByText('Cancel Appointment')).toHaveCount(0);
    clean();
  });
});

test.describe('documents', () => {
  test('the table matches the design', async ({ page }) => {
    await signIn(page);
    await page.goto(`${PORTAL}/documents.html`);

    const rows = page.getByTestId('docs--table').locator('tbody tr');
    await expect(rows).toHaveCount(5);
    await expect(rows.first()).toContainText('Intake Form');
    await expect(rows.first()).toContainText('Arlene McCoy');
  });

  test('the upload dialog validates before it accepts', async ({ page }) => {
    await signIn(page);
    await page.goto(`${PORTAL}/documents.html`);
    await page.getByTestId('docs--upload-open').click();

    const dialog = page.locator('#uploadModal');
    await expect(dialog).toBeVisible();

    // Empty submit is refused and the dialog stays open.
    await page.getByTestId('docs--upload-submit').click();
    await expect(dialog).toBeVisible();
    await expect(page.locator('#docTypeError')).toBeVisible();
  });

  test('a completed upload adds a row', async ({ page }) => {
    await signIn(page);
    await page.goto(`${PORTAL}/documents.html`);
    await page.getByTestId('docs--upload-open').click();

    await page.getByTestId('docs--type').selectOption('Consent Form');
    await page.getByTestId('docs--date').fill('2026-08-14');
    await page.getByTestId('docs--file').setInputFiles({
      name: 'referral-letter.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test fixture'),
    });
    await page.getByTestId('docs--upload-submit').click();

    await expect(page.locator('#uploadModal')).toBeHidden();

    const rows = page.getByTestId('docs--table').locator('tbody tr');
    await expect(rows).toHaveCount(6);
    await expect(rows.first()).toContainText('referral-letter');
    await expect(rows.first()).toContainText('8/14/2026');
  });
});

test.describe('chat', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto(`${PORTAL}/chat.html`);
  });

  test('the thread list and the transcript both render', async ({ page }) => {
    await expect(page.getByTestId('chat--thread')).toHaveCount(9);
    await expect(page.locator('#threadLog')).toContainText('HbA1c: 7.4%');
  });

  test('the quick filters narrow the list', async ({ page }) => {
    await page.getByTestId('chat--filter-unread').click();
    await expect(page.getByTestId('chat--thread')).toHaveCount(3);

    await page.getByTestId('chat--filter-urgent').click();
    await expect(page.getByTestId('chat--thread')).toHaveCount(3);

    await page.getByTestId('chat--filter-unread').click();
    await expect(page.getByTestId('chat--thread')).toHaveCount(3);
  });

  test('search narrows the list', async ({ page }) => {
    await page.getByTestId('chat--search').fill('Jaxon');
    await expect(page.getByTestId('chat--thread')).toHaveCount(1);
  });

  test('a sent message appears in the transcript', async ({ page }) => {
    await page.getByTestId('chat--input').fill('Thank you, see you then.');
    await page.getByTestId('chat--send').click();

    await expect(page.locator('#threadLog')).toContainText('Thank you, see you then.');
    await expect(page.getByTestId('chat--input')).toHaveValue('');
  });

  /*
   * Typed text is escaped; only the authored fixture messages carry markup.
   * The bug this guards is a real one and easy to reintroduce: one
   * innerHTML on the composer path and the transcript executes what a
   * message says.
   */
  test('a typed message cannot inject markup', async ({ page }) => {
    await page.getByTestId('chat--input').fill('<img src=x onerror="window.__x=1">');
    await page.getByTestId('chat--send').click();

    await expect(page.locator('#threadLog img')).toHaveCount(0);
    await expect(page.locator('#threadLog')).toContainText('<img src=x');
    expect(await page.evaluate(() => window.__x)).toBeUndefined();
  });
});

test.describe('billing', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('statements opens on the designed five, a page at a time', async ({ page }) => {
    await page.goto(`${PORTAL}/billing-statements.html`);
    const rows = page.getByTestId('statements--table').locator('tbody tr');

    // Ten to a page, and the first five are still the design's five so the
    // reference screenshot can be laid beside page one.
    await expect(rows).toHaveCount(10);
    await expect(rows.first()).toContainText('Cameron Williamson');
    await expect(rows.first()).toContainText('$ 526.00');

    await expect(page.getByTestId('statements--range')).toHaveText('1–10 of 23 statements');
  });

  test('the pager moves the statements table and clamps at the end', async ({ page }) => {
    await page.goto(`${PORTAL}/billing-statements.html`);
    const rows = page.getByTestId('statements--table').locator('tbody tr');
    const pages = page.getByTestId('statements--pages');

    await expect(pages.getByLabel('Previous page')).toBeDisabled();

    await pages.getByRole('button', { name: '3', exact: true }).click();
    // 23 statements, ten to a page: the last page is the remainder, not a
    // full one padded out.
    await expect(rows).toHaveCount(3);
    await expect(page.getByTestId('statements--range')).toHaveText('21–23 of 23 statements');
    await expect(pages.getByLabel('Next page')).toBeDisabled();
  });

  test('a bigger page size drops the page run', async ({ page }) => {
    await page.goto(`${PORTAL}/billing-statements.html`);

    await page.getByTestId('statements--rows-per-page').selectOption('50');

    await expect(page.getByTestId('statements--table').locator('tbody tr')).toHaveCount(23);
    // One page is not a choice — the numbered run goes rather than standing
    // there greyed out.
    await expect(page.getByTestId('statements--pages')).toBeEmpty();
  });

  test('payment history pages through the whole history', async ({ page }) => {
    await page.goto(`${PORTAL}/billing-payment-history.html`);

    await expect(page.getByTestId('payments--table').locator('tbody tr')).toHaveCount(10);
    await expect(page.getByTestId('payments--range')).toHaveText('1–10 of 26 payments');
  });

  test('payment history shows both outcomes', async ({ page }) => {
    await page.goto(`${PORTAL}/billing-payment-history.html`);
    const table = page.getByTestId('payments--table');
    await expect(table.getByText('Paid').first()).toBeVisible();
    await expect(table.getByText('Failed').first()).toBeVisible();
  });

  test('no card number is ever fully rendered', async ({ page }) => {
    await page.goto(`${PORTAL}/profile-cards.html`);
    const text = await page.getByTestId('cards--table').innerText();

    await expect(page.getByTestId('cards--table')).toContainText('9090');
    // Sixteen consecutive digits would mean an unmasked number reached the DOM.
    expect(text).not.toMatch(/\d{13,}/);
  });

  test('the Add Card popup keeps the last four and nothing else', async ({ page }) => {
    await page.goto(`${PORTAL}/profile-cards.html`);
    const rows = page.getByTestId('cards--table').locator('tbody tr');
    await expect(rows).toHaveCount(5);

    await page.getByTestId('cards--add').click();
    await page.getByTestId('cards--name').fill('Alexander Chen');
    await page.getByTestId('cards--number').fill('5555444433332222');
    await page.getByTestId('cards--expiry').fill('2028-03');
    await page.getByTestId('cards--cvv').fill('123');
    await page.getByTestId('cards--submit').click();

    await expect(rows).toHaveCount(6);
    const added = rows.last();
    await expect(added).toContainText('MASTERCARD');
    await expect(added).toContainText('2222');
    await expect(added).toContainText('Mar-28');

    // The number the form took does not survive the submit that read it.
    const text = await page.getByTestId('cards--table').innerText();
    expect(text).not.toContain('5555');
    expect(text).not.toMatch(/\d{13,}/);
  });

  test('the Add Card popup refuses a number that is too short', async ({ page }) => {
    await page.goto(`${PORTAL}/profile-cards.html`);

    await page.getByTestId('cards--add').click();
    await page.getByTestId('cards--name').fill('Alexander Chen');
    await page.getByTestId('cards--number').fill('4111');
    await page.getByTestId('cards--expiry').fill('2028-03');
    await page.getByTestId('cards--cvv').fill('123');
    await page.getByTestId('cards--submit').click();

    await expect(page.getByTestId('cards--number')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByTestId('cards--table').locator('tbody tr')).toHaveCount(5);
  });

  test('making the secondary plan primary moves both headings', async ({ page }) => {
    await page.goto(`${PORTAL}/billing-insurance.html`);
    const plans = page.getByTestId('insurance--plan');
    await expect(plans).toHaveCount(2);
    await expect(plans.first()).toContainText('Primary');

    // Selected by value, not by position: choosing it reorders the panels,
    // so a positional locator would resolve to the other plan on the retry.
    await page.locator('input[value="ins-secondary"]').check();

    // Exactly one plan is primary afterwards — not both, not neither.
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(1);
    await expect(plans.first()).toContainText('Primary');
    await expect(plans.nth(1)).toContainText('Secondary');
  });
});

test.describe('settings', () => {
  test('the profile tab shows the record', async ({ page }) => {
    await signIn(page);
    await page.goto(`${PORTAL}/settings-profile.html`);

    await expect(page.getByTestId('settings--profile')).toContainText('Henna West');
    await expect(page.getByTestId('settings--profile')).toContainText('Frankie Francis');
  });

  test('the password tab is its own address', async ({ page }) => {
    await signIn(page);
    await page.goto(`${PORTAL}/settings-profile.html`);
    await page.getByTestId('settings--tab-password').click();

    await page.waitForURL('**/settings-profile.html?tab=password');
    await expect(page.getByTestId('settings--security')).toContainText('Security Details');
    await expect(page.getByTestId('settings--edit')).toContainText('Change Password');
    await expect(page.locator('#crumbs')).toContainText('Password');
  });
});

test.describe('undesigned sections', () => {
  test('say so rather than dead-ending', async ({ page }) => {
    await signIn(page);
    await page.getByTestId('nav--education').click();
    await page.waitForURL(/placeholder\.html/);

    await expect(page.getByTestId('placeholder')).toContainText('Education Material');
    await expect(page.getByTestId('nav--education')).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('@a11y', () => {
  const SCREENS = [
    ['login', `${PORTAL}/login.html`],
    ['home', `${PORTAL}/home.html`],
    ['appointment', `${PORTAL}/appointment.html`],
    ['documents', `${PORTAL}/documents.html`],
    ['medications', `${PORTAL}/health-medications.html`],
    ['allergies', `${PORTAL}/health-medications.html?tab=allergies`],
    ['chat', `${PORTAL}/chat.html`],
    ['statements', `${PORTAL}/billing-statements.html`],
    ['insurance', `${PORTAL}/billing-insurance.html`],
    ['settings', `${PORTAL}/settings-profile.html`],
  ];

  for (const [name, url] of SCREENS) {
    test(`${name} has no WCAG A/AA violations`, async ({ page }) => {
      if (name !== 'login') await signIn(page);
      await page.goto(url);
      // Park the pointer so no row sits in :hover while contrast is measured.
      await page.mouse.move(0, 0);
      await expectNoA11yViolations(page);
    });
  }
});
