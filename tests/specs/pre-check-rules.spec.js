/**
 * The pre-procedure sheet's rules, without a sheet.
 *
 * Every reveal rule, every mutual exclusion and every derived score is a plain
 * function of the values (js/lib/pre-check-fields.js) so that the gate, the
 * rendered form and the PDF cannot disagree about them. This file tests them at
 * that level: no clicking, no layout, just "given these answers, what does the
 * sheet say".
 *
 * WHY THIS RUNS IN A BROWSER AT ALL
 * The prototype ships native ES modules with no build step and no test runner
 * beyond Playwright. So the page is a bare origin and the module is imported
 * into it — Playwright is the harness, not the subject. Nothing here touches
 * the DOM.
 */
import { test, expect } from '@playwright/test';

/** Import the rule modules once per test and run `fn` against them in-page. */
async function withRules(page, fn) {
  await page.goto('/gallery.html');
  return page.evaluate(async (source) => {
    const fields = await import('/js/lib/pre-check-fields.js');
    const data = await import('/data/pre-check.js');
    const form = await import('/js/lib/pre-check-form.js');
    // eslint-disable-next-line no-new-func
    return new Function('fields', 'data', 'form', `return (${source})(fields, data, form)`)(
      fields, data, form
    );
  }, fn.toString());
}

/** The seed with some answers overridden — the shape every rule reads. */
const withValues = (overrides) => (f, d, form) => ({ ...d.PRE_CHECK_SEED, ...overrides });

test.describe('pre-check rules — conditional reveals', () => {
  /**
   * Every "Other → say which" pair on the sheet.
   *
   * These are the reveals that used to have no validation at all: picking
   * Other opened a box that nobody had to fill, so "Other" was a complete
   * answer to a question whose whole point was that the list did not cover it.
   */
  test('picking Other requires the free-text that goes with it', async ({ page }) => {
    const result = await withRules(page, (fields, data, form) => {
      const seed = data.PRE_CHECK_SEED;
      const pairs = [
        ['sedationHistory', 'other', 'sedationHistoryOther'],
        ['weightLossType', 'Other', 'weightLossOther'],
        ['anticoagulantType', 'Other', 'anticoagulantOther'],
        ['preparation', 'Other', 'colonPrepOther'],
        ['colonPrepResults', 'other', 'colonPrepResultsOther'],
        ['npoStatus', 'other', 'npoOtherText'],
      ];

      return pairs.map(([trigger, value, companion]) => {
        const blank = form.preCheckOutstanding({ ...seed, [trigger]: value, [companion]: '' });
        const filled = form.preCheckOutstanding({
          ...seed, [trigger]: value, [companion]: 'stated',
        });
        return {
          trigger,
          blocksWhenBlank: blank.length > filled.length,
          clearsWhenFilled: filled.length === 0,
        };
      });
    });

    for (const row of result) {
      expect(row.blocksWhenBlank, `${row.trigger}=Other must require its text`).toBe(true);
      expect(row.clearsWhenFilled, `${row.trigger}=Other must clear once answered`).toBe(true);
    }
  });

  /**
   * Verified-OK behaviour that had to survive the rewrite: the prep follow-ups
   * are ABSENT when there was no prep, not greyed out. A disabled "Results"
   * reads as "not needed today"; an absent one cannot be misread.
   */
  test('no preparation hides completion, tolerance and effluent entirely', async ({ page }) => {
    const result = await withRules(page, (fields, data) => {
      const none = { ...data.PRE_CHECK_SEED, preparation: 'No preparation' };
      const some = { ...data.PRE_CHECK_SEED, preparation: 'MoviPrep' };
      return { none: fields.hasPrep(none), some: fields.hasPrep(some) };
    });

    expect(result.none).toBe(false);
    expect(result.some).toBe(true);
  });

  /**
   * A revealed field behind a No is not outstanding — it is not being asked.
   *
   * Driven by the two questions on the sheet that still gate a required
   * follow-up: a drug type is only wanted once the patient is on the drug.
   */
  test('a rule hidden behind a No is not asked for', async ({ page }) => {
    const result = await withRules(page, (fields, data, form) => {
      const seed = data.PRE_CHECK_SEED;
      const count = (extra) => form.preCheckOutstanding({ ...seed, ...extra }).length;
      return {
        noAnticoagulant: count({ anticoagulant: 'no', anticoagulantType: '' }),
        onAnticoagulant: count({ anticoagulant: 'yes', anticoagulantType: '' }),
        noWeightLoss: count({ weightLoss: 'no', weightLossType: '' }),
        onWeightLoss: count({ weightLoss: 'yes', weightLossType: '' }),
      };
    });

    expect(result.noAnticoagulant, 'not on one — nothing to ask').toBe(0);
    expect(result.onAnticoagulant, 'on one — which one?').toBeGreaterThan(0);
    expect(result.noWeightLoss).toBe(0);
    expect(result.onWeightLoss).toBeGreaterThan(0);
  });
});

test.describe('pre-check rules — mutual exclusion', () => {
  /**
   * The defect this replaced: NKDA could be ticked alongside Soy, Egg and a
   * typed allergen, so one sheet could say both "no known drug allergies" and
   * "anaphylaxis to amoxicillin".
   *
   * The UI clears the rest when NKDA goes on, but the rule is asserted at the
   * gate too — values also arrive from a filed sheet, a template, or a
   * migrated record, and none of those go through a click.
   */
  test('NKDA cannot stand beside a named allergen', async ({ page }) => {
    const result = await withRules(page, (fields, data, form) => {
      const seed = data.PRE_CHECK_SEED;
      const check = (extra) =>
        form
          .preCheckOutstanding({ ...seed, ...extra })
          .some((line) => line.includes('NKDA contradicts'));

      return {
        alone: check({ allergyChecks: ['nkda', 'medications'] }),
        withSoy: check({ allergyChecks: ['nkda', 'soy', 'medications'] }),
        withEgg: check({ allergyChecks: ['nkda', 'egg', 'medications'] }),
        withRow: check({
          allergyChecks: ['nkda', 'medications'],
          allergies: [{ allergen: 'Amoxicillin', severity: 'Severe' }],
        }),
        withTyped: check({
          allergyChecks: ['nkda', 'medications'],
          otherAllergies: 'Morphine',
        }),
        allergenNoNkda: check({
          allergyChecks: ['soy', 'medications'],
        }),
      };
    });

    expect(result.alone, 'NKDA on its own is a valid answer').toBe(false);
    expect(result.withSoy).toBe(true);
    expect(result.withEgg).toBe(true);
    expect(result.withRow).toBe(true);
    expect(result.withTyped).toBe(true);
    expect(result.allergenNoNkda, 'an allergen without NKDA is fine').toBe(false);
  });

  /**
   * NPO was two checkboxes and both could be ticked, which is a fasting status
   * that says two things at once. It is one choice now, so the shape cannot
   * express the contradiction — this asserts the value is a single enum rather
   * than a list.
   */
  test('NPO is one answer, not a set', async ({ page }) => {
    const result = await withRules(page, (fields, data, form) => {
      const seed = data.PRE_CHECK_SEED;
      return {
        seedIsScalar: typeof seed.npoStatus,
        unanswered: form.preCheckOutstanding({ ...seed, npoStatus: '' })
          .some((line) => line === 'NPO status'),
      };
    });

    expect(result.seedIsScalar).toBe('string');
    expect(result.unanswered).toBe(true);
  });

  /* A test for "None is exclusive of the other GI symptoms" stood here. The
     sheet was cut back to what the paper form carries and the GLP-1 symptom
     checkboxes went with it, so the assertion had no subject left. The
     renderer's `exclusive` branch survives with no field using it — worth
     removing if nothing is going to. */
});

test.describe('pre-check rules — derived scores', () => {
  test('Apfel counts its four factors', async ({ page }) => {
    const result = await withRules(page, (fields) => [
      fields.ponvScore({}),
      fields.ponvScore({ ponvFemale: true, ponvNonSmoker: true }),
      fields.ponvScore({
        ponvFemale: true, ponvNonSmoker: true, ponvHistory: true, ponvPostopOpioids: true,
      }),
    ]);

    expect(result).toEqual([0, 2, 4]);
  });

  test('STOP-BANG counts its eight, and 5 is the threshold that matters', async ({ page }) => {
    const result = await withRules(page, (fields) => {
      const all = {};
      ['Snoring', 'Tired', 'ObservedApnea', 'Pressure', 'Bmi'].forEach((k) => {
        all[`stopBang${k}`] = true;
      });
      return { five: fields.stopBangScore(all), none: fields.stopBangScore({}) };
    });

    expect(result.five).toBe(5);
    expect(result.none).toBe(0);
  });

  test('BMI is blank until both halves are there', async ({ page }) => {
    const result = await withRules(page, (fields) => ({
      partial: fields.bmiOf({ heightIn: '66', weightLb: '' }),
      both: fields.bmiOf({ heightIn: '66', weightLb: '186' }),
    }));

    expect(result.partial).toBeNull();
    expect(result.both).toBeCloseTo(30.0, 1);
  });

  /**
   * The alert keys off the agents that delay gastric emptying, not off "a
   * weight-loss drug was recorded" — phentermine and orlistat are neither an
   * aspiration risk nor a reason to hold the case.
   */
  test('only the GLP-1/GIP agents count as an aspiration risk', async ({ page }) => {
    const result = await withRules(page, (fields) => ({
      ozempic: fields.isGlp1({ weightLoss: 'yes', weightLossType: 'Ozempic (Semaglutide)' }),
      mounjaro: fields.isGlp1({ weightLoss: 'yes', weightLossType: 'Mounjaro (Tirzepatide)' }),
      phentermine: fields.isGlp1({ weightLoss: 'yes', weightLossType: 'Phentermine' }),
      orlistat: fields.isGlp1({ weightLoss: 'yes', weightLossType: 'Xenical (Orlistat)' }),
      notTaking: fields.isGlp1({ weightLoss: 'no', weightLossType: 'Ozempic (Semaglutide)' }),
    }));

    expect(result.ozempic).toBe(true);
    expect(result.mounjaro).toBe(true);
    expect(result.phentermine).toBe(false);
    expect(result.orlistat).toBe(false);
    expect(result.notTaking).toBe(false);
  });

  /** Measured to the scheduled start, not to now: waiting does not make a
   *  patient safer, and a window that satisfies itself while the list runs
   *  late is the bug worth naming. */
  test('the NPO window is measured against the scheduled start', async ({ page }) => {
    const result = await withRules(page, (fields) => {
      const at = '2026-08-14T08:00';
      return {
        tooRecent: fields.npoViolations(
          { lastSolidIntake: '2026-08-14T05:00', lastClearLiquidIntake: '' }, { scheduledAt: at }
        ).length,
        fine: fields.npoViolations(
          { lastSolidIntake: '2026-08-13T19:00', lastClearLiquidIntake: '2026-08-14T04:00' },
          { scheduledAt: at }
        ).length,
        unanswered: fields.npoViolations(
          { lastSolidIntake: '', lastClearLiquidIntake: '' }, { scheduledAt: at }
        ).length,
      };
    });

    expect(result.tooRecent).toBe(1);
    expect(result.fine).toBe(0);
    expect(result.unanswered, 'no answer is not a violation').toBe(0);
  });
});

/* A block asserting that an impossible number — a systolic of 700, a glucose
   of 9000 — holds the sheet open stood here. Every numeric field on the sheet
   (baseline vitals, blood sugar, INR, platelets) was removed when it was cut
   back to the paper form, so there is nothing left to put out of range.

   NUMERIC_RANGES in data/pre-check.js and rangeError() in pre-check-form.js
   both survive with no field using them. If numbers are not coming back, the
   pair is dead code; if they are, this block is the test to restore. */

test.describe('pre-check rules — migration', () => {
  /**
   * Sheets filed before this revision are still in the store, and they are the
   * ones a nurse is most likely to open in a hurry. Loading one must not lose
   * an answer or invent one.
   */
  test('the old two-boolean and capitalised shapes still load', async ({ page }) => {
    const result = await withRules(page, (fields, data) => ({
      pair: data.migratePreCheck({ diabetesYes: true, aicdNo: true }),
      capitalised: data.migratePreCheck({ diabetes: 'Yes', weightLoss: 'No' }),
      longLabel: data.migratePreCheck({ anticoagulant: 'Taking Anticoagulant' }),
      sedation: data.migratePreCheck({ sedationHistory: 'Nausea or vomiting' }),
      npo: data.migratePreCheck({ npo: ['standard', 'extended'] }),
      npoOther: data.migratePreCheck({ npo: ['other'] }),
      unknown: data.migratePreCheck({ diabetes: 'Borderline' }),
    }));

    expect(result.pair.diabetes).toBe('yes');
    expect(result.pair.aicd).toBe('no');
    expect(result.capitalised.diabetes).toBe('yes');
    expect(result.capitalised.weightLoss).toBe('no');
    expect(result.longLabel.anticoagulant).toBe('yes');
    expect(result.sedation.sedationHistory).toBe('nausea_vomiting');

    // The NPO array became one choice plus a separate tick.
    expect(result.npo.npoStatus).toBe('standard');
    expect(result.npo.npoExtended).toBe(true);
    expect(result.npo.npo).toBeUndefined();
    expect(result.npoOther.npoStatus).toBe('other');

    // Something unrecognised is left alone rather than defaulted away.
    expect(result.unknown.diabetes).toBe('Borderline');
  });

  test('a migrated sheet gains an empty allergy list, not undefined', async ({ page }) => {
    const result = await withRules(page, (fields, data) =>
      Array.isArray(data.migratePreCheck({ diabetes: 'No' }).allergies)
    );

    expect(result).toBe(true);
  });
});

test.describe('pre-check rules — the gate', () => {
  /* The encounter reads this before the sheet has ever been on screen, so the
     seeded sheet has to answer everything it insists on. A seed that left the
     gate open would show the room a checklist it could never close. */
  test('the practice seed answers every line the sheet gates on', async ({ page }) => {
    const outstanding = await withRules(page, (fields, data, form) =>
      form.preCheckOutstanding(null)
    );

    expect(outstanding).toEqual([]);
  });

  test('a blocking alert holds the sheet open until it is answered', async ({ page }) => {
    const result = await withRules(page, (fields, data, form) => {
      const seed = data.PRE_CHECK_SEED;
      return {
        noEscort: form.preCheckOutstanding({ ...seed, escortPresent: 'no' })
          .some((line) => line.includes('Responsible adult')),
        notHeld: form.preCheckOutstanding({
          ...seed, anticoagulantHeld: 'no', anticoagulantAcknowledged: false,
        }).some((line) => line.includes('Acknowledge anticoagulant')),
        acknowledged: form.preCheckOutstanding({
          ...seed, anticoagulantHeld: 'no', anticoagulantAcknowledged: true,
        }).some((line) => line.includes('Acknowledge anticoagulant')),
      };
    });

    expect(result.noEscort).toBe(true);
    expect(result.notHeld).toBe(true);
    expect(result.acknowledged, 'acknowledging it clears the block').toBe(false);
  });

  /* Advisory alerts deliberately do NOT gate. The call to proceed belongs to
     anaesthesia; the sheet's job is to make sure they were told. */
  test('advisory alerts warn without blocking', async ({ page }) => {
    const result = await withRules(page, (fields, data, form) => {
      const seed = data.PRE_CHECK_SEED;
      return {
        mh: form.preCheckOutstanding({ ...seed, mhFamilyHistory: 'yes' }).length,
        difficultAirway: form.preCheckOutstanding({
          ...seed, difficultAirwayHistory: 'yes', difficultAirwayDetail: 'Grade 3 view in 2019',
        }).length,
        highOsa: form.preCheckOutstanding({
          ...seed, stopBangNeck: true, stopBangGender: true, stopBangBmi: true,
        }).length,
      };
    });

    expect(result.mh).toBe(0);
    expect(result.difficultAirway).toBe(0);
    expect(result.highOsa).toBe(0);
  });
});
