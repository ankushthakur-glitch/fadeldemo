/**
 * Login and authentication.
 *
 * The authentication behind these screens is simulated (js/lib/auth-store.js),
 * so what is under test is the SCREEN: does each failure explain itself, does
 * the flow reach the workspace, and can it all be done from the keyboard.
 */
import { test, expect } from '@playwright/test';
import { expectNoA11yViolations } from '../helpers/page-helpers.js';

const LOGIN = '/screens/login.html';
const FORGOT = '/screens/forgot-password.html';
const RESET = '/screens/reset-password.html';
const KEY = 'medinova.auth.v1';

const GOOD = { email: 'amara.mensah@medinovagi.example', password: 'MediNova!2026' };

/** Lockouts and attempt counts persist, so each test starts from nothing. */
async function fresh(page, url = LOGIN) {
  await page.goto(url);
  await page.evaluate((key) => window.localStorage.removeItem(key), KEY);
  await page.reload();
}

/**
 * A sign-in page with the promo carousel held still.
 *
 * The panel advances on a six-second timer, which would make any assertion
 * about the caption a race. The carousel already stops advancing entirely
 * under prefers-reduced-motion — that is the accessibility behaviour, not a
 * test hook — so emulating the preference is how a layout test gets a stable
 * first slide without the page growing a mode it only has for tests.
 */
async function still(page, url = LOGIN) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fresh(page, url);
}

/**
 * One complete attempt, waiting for it to finish.
 *
 * The wait is not politeness. A failed attempt clears the password field when
 * its handler resumes — so typing the next attempt while the previous one is
 * still in flight gets wiped, and the form is submitted empty. Waiting for the
 * button to come back out of its loading state is the signal that the attempt
 * is done and the field is safe to fill again.
 */
async function signIn(page, { email, password }) {
  await page.getByTestId('login--email').locator('input').fill(email);
  await page.getByTestId('login--password').locator('input').fill(password);
  await page.getByTestId('login--submit').locator('button').click();

  // Settled means one of two things: the button came back out of its loading
  // state, or the attempt succeeded and took the page with it. waitForFunction
  // throws when navigation destroys the context, which is the second case.
  await page
    .waitForFunction(() => {
      const button = document.querySelector('[data-testid="login--submit"] button');
      return !button || !button.disabled;
    })
    .catch(() => {});
}

/*
 * The walk-through has an order — sign in, then the schedule — and the root
 * address is where it starts. This is the only test that asserts it, so if
 * index.html ever goes back to being a landing page of its own, this is what
 * says so.
 */
test.describe('the front door', () => {
  test('the root address starts the flow at sign-in', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/screens\/login\.html$/);
    await expect(page.getByTestId('login--submit')).toBeVisible();
  });

  test('signing in from the root lands on the scheduler', async ({ page }) => {
    await page.goto('/');
    await page.evaluate((key) => window.localStorage.removeItem(key), KEY);
    await page.reload();

    await signIn(page, GOOD);

    await expect(page).toHaveURL(/scheduler\.html/);
  });
});

test.describe('login — layout', () => {
  /* The centred card became the PATIENT PORTAL's full-bleed split: the form on
     white at the left, one inset promotional panel at the right. Both doors of
     the same practice now open the same way. */
  test('is a full-bleed split, panel beside the form', async ({ page }) => {
    await still(page);

    const card = page.locator('.auth__card');
    const promo = page.locator('.auth__promo');
    await expect(card).toBeVisible();
    await expect(promo).toBeVisible();

    const cardBox = await card.boundingBox();
    const promoBox = await promo.boundingBox();
    const viewport = await page.evaluate(() => document.documentElement.clientWidth);

    // Form left, panel right, and they do not overlap.
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(promoBox.x);

    /* Full bleed, not a card floating on a ground: the panel runs to within
       its own inset of the right edge rather than leaving a band of page
       behind it. This is the assertion the old centred-card layout failed. */
    expect(viewport - (promoBox.x + promoBox.width)).toBeLessThan(48);
  });

  /*
   * The gutter between the form and the panel.
   *
   * The panel is a solid dark block. A field ending the same distance from it
   * as it does from the white window edge reads as a collision rather than as
   * breathing room, so the space on the panel side has to be visibly larger —
   * which is what the asymmetric padding on .auth__side is for.
   */
  test('the form is not crowded against the panel', async ({ page }) => {
    await still(page);
    const card = await page.locator('.auth__card').boundingBox();
    const promo = await page.locator('.auth__promo').boundingBox();
    expect(promo.x - (card.x + card.width)).toBeGreaterThanOrEqual(64);
  });

  /* The form is the part of this screen with a job to do, and a sign-in button
     below the fold is a sign-in button nobody finds. */
  test('the form fits the viewport', async ({ page }) => {
    await still(page);
    await expect(page.getByTestId('login--submit')).toBeInViewport();
  });

  test('the card is capped at 480px', async ({ page }) => {
    await still(page);
    const box = await page.locator('.auth__card').boundingBox();
    expect(box.width).toBeLessThanOrEqual(480);
  });

  test('carries the product name and blurb', async ({ page }) => {
    await still(page);
    await expect(page.locator('#promoTitle')).toHaveText('MediNova Gastroenterology EHR');
    await expect(page.locator('#promoBody')).toContainText('Secure Electronic Health Record');
  });

  /* Federated sign-in, the admin contact line and the printed prototype
     credentials all came off this screen. The card is the sign-in form and
     nothing else — a login page that prints working credentials teaches the
     wrong habit even in a prototype. */
  test('carries no SSO, no admin line and no printed credentials', async ({ page }) => {
    await fresh(page);
    await expect(page.getByTestId('login--sso')).toHaveCount(0);
    await expect(page.getByTestId('login--admin')).toHaveCount(0);
    await expect(page.getByTestId('login--demo')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Continue with Microsoft');
  });

  test('offers a way to reset', async ({ page }) => {
    await fresh(page);
    await expect(page.getByTestId('login--forgot')).toBeVisible();
  });
});

/* ==========================================================================
   THE PROMO PANEL

   The right side is the patient portal's panel: four green gradients that
   cross-fade under a caption. It replaced a stock cover photograph. Three
   things have to stay true — it is on every auth screen, it is invisible to a
   screen reader, and the caption over it stays readable.
   ======================================================================== */

test.describe('login — the promo panel', () => {
  const AUTH_SCREENS = [
    ['login', LOGIN],
    ['forgot password', FORGOT],
    ['reset password', RESET],
  ];

  for (const [name, url] of AUTH_SCREENS) {
    /* All three auth screens share the panel. When only one of them had it,
       the other two rendered white caption text on a white gap. */
    test(`${name} carries the panel, and it is decorative`, async ({ page }) => {
      await still(page, url);
      const promo = page.locator('.auth__promo');

      await expect(promo).toBeVisible();

      /*
       * aria-hidden, and it means it.
       *
       * Every slide is decorative and its caption is marketing copy repeated
       * in no functional way anywhere else. Someone tabbing to sign in should
       * reach the email field, not four carousel dots and an advertisement.
       */
      await expect(promo).toHaveAttribute('aria-hidden', 'true');
      await expect(promo.locator('.auth__caption h2')).not.toBeEmpty();
    });
  }

  /* Sign-in rotates; the two detour screens do not. Nobody stands on a reset
     form long enough for a rotation to be anything but movement in the corner
     of the eye. */
  test('only sign-in carries the dot control', async ({ page }) => {
    await still(page);
    await expect(page.locator('.auth__dot')).toHaveCount(4);

    await still(page, FORGOT);
    await expect(page.locator('.auth__dot')).toHaveCount(0);
  });

  test('a dot changes the slide', async ({ page }) => {
    await still(page);
    const title = page.locator('#promoTitle');
    const first = await title.textContent();

    await page.locator('.auth__dot').nth(2).click();

    await expect(title).not.toHaveText(first);
    await expect(page.locator('.auth__dot').nth(2)).toHaveAttribute('aria-current', 'true');
  });

  /*
   * Reduced motion stops the advance entirely rather than speeding the fade.
   *
   * Someone who has asked their OS not to have things move on their own has
   * asked for exactly that. The dots still work, so all four slides stay
   * reachable by choice — which the test above covers.
   */
  test('reduced motion stops the carousel advancing', async ({ page }) => {
    await still(page);
    const title = page.locator('#promoTitle');
    const before = await title.textContent();

    await page.waitForTimeout(7000); // one full slide interval and then some

    await expect(title).toHaveText(before);
  });

  /**
   * The scrim, measured on real pixels.
   *
   * White text over a gradient is legible by luck unless something guarantees
   * it. The panel darkens towards the bottom where the caption sits, and this
   * is what says no if that scrim is ever thinned to show more of the ground.
   */
  test('the caption clears AA over the panel', async ({ page }) => {
    await still(page);

    // Where the text is, and what colour it renders as. Measured BEFORE the
    // text is hidden, because hiding it is what makes the background visible.
    const results = await page.evaluate(() => {
      const panel = document.querySelector('.auth__promo').getBoundingClientRect();
      const boxes = ['.auth__caption h2', '.auth__caption p'].map((selector) => {
        const el = document.querySelector(selector);
        const style = getComputedStyle(el);
        return {
          selector,
          rect: el.getBoundingClientRect().toJSON(),
          colour: style.color.match(/[\d.]+/g).map(Number),
          large:
            parseFloat(style.fontSize) >= 24 ||
            (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700),
        };
      });
      return { boxes, panel: panel.toJSON() };
    });

    /* Hide the glyphs, keep the boxes. Sampling with the text still painted
       finds the white text itself as the "lightest background" and reports a
       flawless 1.00:1. */
    await page.addStyleTag({
      content: '.auth__caption h2,.auth__caption p{color:transparent !important}',
    });

    // Sampling has to happen on real pixels, so screenshot the panel and read
    // the lightest background under each text block — the worst case for white.
    const shot = await page.locator('.auth__promo').screenshot();
    const worst = await page.evaluate(
      async ({ dataUrl, boxes, panel }) => {
        const image = new Image();
        image.src = dataUrl;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        const { data } = context.getImageData(0, 0, image.width, image.height);
        const scale = image.width / panel.width;

        const luminance = (r, g, b) => {
          const channel = (v) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
        };

        return boxes.map((box) => {
          const x0 = Math.round((box.rect.x - panel.x) * scale);
          const y0 = Math.round((box.rect.y - panel.y) * scale);
          const x1 = Math.round(x0 + box.rect.width * scale);
          const y1 = Math.round(y0 + box.rect.height * scale);

          let lightest = -1;
          let pixel = [0, 0, 0];
          for (let y = Math.max(0, y0); y < Math.min(image.height, y1); y += 2) {
            for (let x = Math.max(0, x0); x < Math.min(image.width, x1); x += 2) {
              const i = (y * image.width + x) * 4;
              const value = luminance(data[i], data[i + 1], data[i + 2]);
              if (value > lightest) {
                lightest = value;
                pixel = [data[i], data[i + 1], data[i + 2]];
              }
            }
          }

          // Caption text is semi-transparent white in places, so composite it
          // over the background before measuring.
          const [r, g, b, alpha = 1] = box.colour;
          const composited = [r, g, b].map((c, k) => c * alpha + pixel[k] * (1 - alpha));
          const textLuminance = luminance(...composited);
          const hi = Math.max(textLuminance, lightest);
          const lo = Math.min(textLuminance, lightest);

          return {
            selector: box.selector,
            ratio: (hi + 0.05) / (lo + 0.05),
            needs: box.large ? 3 : 4.5,
          };
        });
      },
      {
        dataUrl: `data:image/png;base64,${shot.toString('base64')}`,
        boxes: results.boxes,
        panel: results.panel,
      }
    );

    for (const { selector, ratio, needs } of worst) {
      expect(ratio, `${selector} over the panel is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(needs);
    }
  });
});

/* ==========================================================================
   HOW MUCH GREEN

   The ground, the side panel and the button were once all brand green, which
   left the one action on the screen nothing to stand out against. A primary
   colour only reads as primary when it is rare, so this pins it: the button
   wears the product's green and no surface behind it does. The promo panel is
   green, but every value in it is mixed below the darkest step of the ramp.
   ======================================================================== */

test.describe('login — the primary colour is rare', () => {
  /** #097000 and its two darker steps. */
  const GREENS = ['rgb(9, 112, 0)', 'rgb(7, 96, 0)', 'rgb(5, 78, 0)'];

  test('the page ground is neutral, not brand green', async ({ page }) => {
    await fresh(page);
    const ground = await page
      .locator('body.auth')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(GREENS).not.toContain(ground);
  });

  /* The promo panel IS green now — but a green no interface element can be.
     Every slide is mixed below the darkest step of the ramp, so it reads as a
     photograph's place rather than as a very large button, and the Sign In
     button is still the only thing on screen wearing the product's primary. */
  test('the promo panel uses no interface green', async ({ page }) => {
    await still(page);
    const grounds = await page
      .locator('.auth__promo, .auth__slide')
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
    for (const ground of grounds) expect(GREENS).not.toContain(ground);
  });

  test('the submit button is the one green thing', async ({ page }) => {
    await fresh(page);
    const button = await page
      .getByTestId('login--submit')
      .locator('button')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(GREENS).toContain(button);
  });
});

test.describe('login — the empty-form shortcut', () => {
  /*
   * A prototype's sign-in screen is a door in front of the thing being
   * reviewed, so pressing Sign In with nothing typed goes straight through as
   * the demo physician.
   */
  test('pressing Sign In on an empty form signs you in', async ({ page }) => {
    await fresh(page);
    await page.getByTestId('login--submit').locator('button').click();

    // HOME in js/screens/login.js — the same place a typed sign-in lands.
    await page.waitForURL(/scheduler\.html/);
    await expect(page.getByTestId('login--submit')).toHaveCount(0);
  });



  /*
   * Scoped to a completely empty form on purpose. Anything typed gets the real
   * behaviour, which is what keeps inactive / expired / wrong-password /
   * lockout reachable — they are half the value of this screen.
   */
  test('a half-filled form still validates rather than shortcutting', async ({ page }) => {
    await fresh(page);
    await page.getByTestId('login--password').locator('input').fill('something');
    await page.getByTestId('login--submit').locator('button').click();

    await expect(page.getByTestId('login--email')).toContainText('Enter your work email address');
  });
});

test.describe('login — validation', () => {

  test('a malformed email is named as such', async ({ page }) => {
    await fresh(page);
    await signIn(page, { email: 'not-an-email', password: 'x' });
    await expect(page.getByTestId('login--email')).toContainText('does not look like an email');
  });

  test('an empty password is caught', async ({ page }) => {
    await fresh(page);
    await page.getByTestId('login--email').locator('input').fill(GOOD.email);
    await page.getByTestId('login--submit').locator('button').click();
    await expect(page.getByTestId('login--password')).toContainText('Enter your password');
  });

  /* A wrong address and a wrong password must be indistinguishable, or the
     form becomes a way to discover who works at the practice. */
  test('a wrong password and an unknown address give the same answer', async ({ page }) => {
    await fresh(page);
    await signIn(page, { email: GOOD.email, password: 'wrong-password' });
    const wrongPassword = await page.getByTestId('login--error').textContent();

    await fresh(page);
    await signIn(page, { email: 'nobody@medinovagi.example', password: 'wrong-password' });
    const unknownUser = await page.getByTestId('login--error').textContent();

    expect(unknownUser).toBe(wrongPassword);
    expect(wrongPassword).toContain('Your email or password is incorrect.');
  });
});

test.describe('login — account states', () => {
  test('locks the account after five failures and says for how long', async ({ page }) => {
    await fresh(page);

    for (let i = 0; i < 5; i += 1) {
      // From the fourth attempt on, the challenge gates the form — answering it
      // is part of the path to a lockout, not a way around one.
      const captcha = page.getByTestId('login--captcha');
      if (await captcha.isVisible().catch(() => false)) {
        await captcha.locator('input').check();
      }
      await signIn(page, { email: GOOD.email, password: 'wrong' });
    }

    const error = page.getByTestId('login--error');
    await expect(error).toContainText('locked after multiple unsuccessful login attempts');
    await expect(error).toContainText('15 minutes');
  });

  test('warns how many attempts are left before the lock', async ({ page }) => {
    await fresh(page);
    for (let i = 0; i < 3; i += 1) {
      await signIn(page, { email: GOOD.email, password: 'wrong' });
    }
    await expect(page.getByTestId('login--error')).toContainText('attempts remaining');
  });

  test('a challenge appears after repeated failures and gates the next attempt', async ({ page }) => {
    await fresh(page);
    for (let i = 0; i < 3; i += 1) {
      await signIn(page, { email: GOOD.email, password: 'wrong' });
    }

    const captcha = page.getByTestId('login--captcha');
    await expect(captcha).toBeVisible();

    // Correct credentials are not enough while the challenge is unanswered.
    await signIn(page, GOOD);
    await expect(page.getByTestId('login--error')).toContainText('not a robot');

    await captcha.locator('input').check();
    await signIn(page, GOOD);
    await expect(page).toHaveURL(/scheduler\.html/);
  });

  test('a deactivated account is told to contact the administrator', async ({ page }) => {
    await fresh(page);
    await signIn(page, { email: 'inactive@medinovagi.example', password: GOOD.password });
    const error = page.getByTestId('login--error');
    await expect(error).toContainText('no longer active');
    await expect(error).toContainText('practice administrator');
  });

  test('an expired password sends the user to set a new one', async ({ page }) => {
    await fresh(page);
    await signIn(page, { email: 'expired@medinovagi.example', password: GOOD.password });
    await expect(page).toHaveURL(/reset-password\.html.*reason=expired/);
    await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeVisible();
  });

  test('a timed-out session explains itself on arrival', async ({ page }) => {
    await page.goto(`${LOGIN}?reason=session-expired`);
    await expect(page.getByTestId('login--error')).toContainText('signed out after a period of inactivity');
  });

  test('network and server failures read differently', async ({ page }) => {
    await page.goto(`${LOGIN}?simulate=network`);
    await signIn(page, GOOD);
    await expect(page.getByTestId('login--error')).toContainText("can't reach the server");

    await page.goto(`${LOGIN}?simulate=server`);
    await signIn(page, GOOD);
    await expect(page.getByTestId('login--error')).toContainText('wrong at our end');
  });
});

test.describe('login — success', () => {
  test('lands on the scheduling workspace', async ({ page }) => {
    await fresh(page);
    await signIn(page, GOOD);
    await expect(page).toHaveURL(/scheduler\.html/);
  });

  test('shows a loading state while it works', async ({ page }) => {
    await fresh(page);
    await page.getByTestId('login--email').locator('input').fill(GOOD.email);
    await page.getByTestId('login--password').locator('input').fill(GOOD.password);

    const button = page.getByTestId('login--submit').locator('button');
    await button.click();
    await expect(button).toContainText('Signing you in…');
    await expect(button).toBeDisabled();
  });

  /* Remember-me returns the ADDRESS, never the password. */
  test('remember this device pre-fills the email only', async ({ page }) => {
    await fresh(page);
    await page.getByTestId('login--remember').locator('input').check();
    await signIn(page, GOOD);
    await expect(page).toHaveURL(/scheduler\.html/);

    await page.goto(LOGIN);
    await expect(page.getByTestId('login--email').locator('input')).toHaveValue(GOOD.email);
    await expect(page.getByTestId('login--password').locator('input')).toHaveValue('');
  });
});

test.describe('login — password field', () => {
  test('the reveal toggle shows and hides without losing what was typed', async ({ page }) => {
    await fresh(page);
    const input = page.getByTestId('login--password').locator('input');
    await input.fill('MediNova!2026');

    const toggle = page.getByTestId('login--password').locator('[data-reveal]');
    await expect(input).toHaveAttribute('type', 'password');

    await toggle.click();
    await expect(input).toHaveAttribute('type', 'text');
    await expect(input).toHaveValue('MediNova!2026');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await toggle.click();
    await expect(input).toHaveAttribute('type', 'password');
    await expect(input).toHaveValue('MediNova!2026');
  });

  /*
   * Driven by synthetic events on purpose.
   *
   * page.keyboard.press('CapsLock') sends the key but does NOT flip the
   * modifier state Chromium reports to getModifierState — verified, it stays
   * false. Typing through Playwright therefore cannot reach this state, so the
   * event the browser would really deliver is constructed directly.
   */
  test('Caps Lock is warned about while it is on', async ({ page }) => {
    await fresh(page);
    const warning = page.getByTestId('login--caps');
    await expect(warning).toBeHidden();

    const key = (capsOn) =>
      page.evaluate((on) => {
        document
          .querySelector('[data-testid="login--password"] input')
          .dispatchEvent(
            new KeyboardEvent('keydown', { key: 'a', bubbles: true, modifierCapsLock: on })
          );
      }, capsOn);

    await key(true);
    await expect(warning).toBeVisible();

    await key(false);
    await expect(warning).toBeHidden();
  });
});

test.describe('forgot password', () => {
  test('asks for an address and confirms without confirming the account exists', async ({ page }) => {
    await page.goto(FORGOT);
    await page.getByTestId('forgot--email').locator('input').fill('nobody@medinovagi.example');
    await page.getByTestId('forgot--submit').locator('button').click();

    const sent = page.getByTestId('forgot--sent');
    await expect(sent).toBeVisible();
    await expect(sent).toContainText('Check your email');
    // Nothing here reveals whether that address is on file.
    await expect(sent).not.toContainText(/no account|not found|unknown/i);
  });

  test('a malformed address is refused before sending', async ({ page }) => {
    await page.goto(FORGOT);
    await page.getByTestId('forgot--email').locator('input').fill('nope');
    await page.getByTestId('forgot--submit').locator('button').click();
    await expect(page.getByTestId('forgot--email')).toContainText('does not look like an email');
    await expect(page.getByTestId('forgot--sent')).toBeHidden();
  });

  test('resend is rate-limited, and says how long for', async ({ page }) => {
    await page.goto(FORGOT);
    await page.getByTestId('forgot--email').locator('input').fill(GOOD.email);
    await page.getByTestId('forgot--submit').locator('button').click();

    await expect(page.getByTestId('forgot--resend').locator('button')).toBeDisabled();
    // The countdown is in the status line, so the button keeps saying what it
    // does rather than becoming a timer.
    await expect(page.locator('#resendNote')).toHaveText(/You can resend in \d+s\./);
  });

  test('back returns to sign in', async ({ page }) => {
    await page.goto(FORGOT);
    await page.getByTestId('forgot--back').click();
    await expect(page).toHaveURL(/login\.html/);
  });
});

test.describe('reset password', () => {
  test('the checklist ticks off in real time', async ({ page }) => {
    await page.goto(RESET);
    const input = page.getByTestId('reset--password').locator('input');
    const met = page.locator('.auth__rule--met');

    await expect(met).toHaveCount(0);

    await input.fill('abc');
    await expect(met).toHaveCount(1); // lowercase only

    await input.fill('Abcdefg1!');
    await expect(met).toHaveCount(5);
    await expect(page.locator('#strengthLabel')).toHaveText('Strong password');
  });

  test('a password that misses a rule is refused', async ({ page }) => {
    await page.goto(RESET);
    await page.getByTestId('reset--password').locator('input').fill('alllowercase');
    await page.getByTestId('reset--confirm').locator('input').fill('alllowercase');
    await page.getByTestId('reset--submit').locator('button').click();

    await expect(page.getByTestId('reset--password')).toContainText(
      'does not meet all the requirements'
    );
    await expect(page.getByTestId('reset--done')).toBeHidden();
  });

  test('a mismatched confirmation is caught', async ({ page }) => {
    await page.goto(RESET);
    await page.getByTestId('reset--password').locator('input').fill('Abcdefg1!');
    await page.getByTestId('reset--confirm').locator('input').fill('Abcdefg2!');
    await page.getByTestId('reset--submit').locator('button').click();

    await expect(page.getByTestId('reset--confirm')).toContainText('must match');
  });

  test('a good password succeeds and offers the way back', async ({ page }) => {
    await page.goto(`${RESET}?email=${encodeURIComponent(GOOD.email)}`);
    await page.getByTestId('reset--password').locator('input').fill('Abcdefg1!');
    await page.getByTestId('reset--confirm').locator('input').fill('Abcdefg1!');
    await page.getByTestId('reset--submit').locator('button').click();

    await expect(page.getByTestId('reset--done')).toBeVisible();
    await expect(page.getByTestId('reset--done')).toContainText('Password Updated Successfully');

    await page.getByTestId('reset--to-login').locator('button').click();
    await expect(page).toHaveURL(/login\.html/);
  });

  test('arriving with an expired password says why', async ({ page }) => {
    await page.goto(`${RESET}?reason=expired`);
    await expect(page.locator('#resetSubtitle')).toContainText('Your password has expired');
  });
});

test.describe('authentication — accessibility', () => {
  test('the whole login form is reachable by keyboard', async ({ page }) => {
    await fresh(page);
    await page.getByTestId('login--email').locator('input').focus();

    await page.keyboard.type(GOOD.email);
    await page.keyboard.press('Tab'); // → password
    await page.keyboard.type(GOOD.password);
    await page.keyboard.press('Tab'); // → reveal
    await page.keyboard.press('Tab'); // → remember
    await page.keyboard.press('Tab'); // → forgot link
    await page.keyboard.press('Tab'); // → submit
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/scheduler\.html/);
  });

  for (const [name, url] of [
    ['login', LOGIN],
    ['forgot password', FORGOT],
    ['reset password', RESET],
  ]) {
    test(`${name} has no WCAG 2.1 A/AA violations @a11y`, async ({ page }) => {
      await page.goto(url);
      await expectNoA11yViolations(page);
    });
  }

  test('an error is announced, not just coloured', async ({ page }) => {
    await fresh(page);
    await signIn(page, { email: GOOD.email, password: 'wrong' });
    /* The message is a toast now, and politeness is a property of the REGION
       it lands in rather than of the card — see js/lib/toast.js. A failure
       goes to the assertive one, so it interrupts rather than waiting for a
       gap in whatever is being read out. */
    const error = page.getByTestId('login--error');
    await expect(error).toBeVisible();
    await expect(page.locator('[data-live="assertive"][role="alert"]')).toContainText(
      'Your email or password is incorrect.'
    );
  });
});
