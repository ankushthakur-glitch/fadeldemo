/**
 * The signed-in patient.
 *
 * Fixture data, taken from the supplied design screenshots so the built
 * screens can be compared against them line for line. Every name, address,
 * date and identifier here is invented.
 *
 * ⚠ Two things in this record are reproduced from the design AS DRAWN and are
 * flagged rather than silently corrected — see the notes on `ssn` and on the
 * insurance expiry in data/billing.js.
 */

export const PATIENT = {
  name: 'Henna West',
  email: 'henna.west@example.com',
  mrn: 'DG-104882',
  phone: '(808) 555-0111',
  dob: '12/10/1978',
  gender: 'Female',
  languages: 'English',
  race: 'American',
  ethnicity: 'Central American',
  address: '8502 Preston Rd. Inglewood, Maine 98380',
  /*
   * ⚠ The design prints the full nine digits on a page any signed-in session
   * can reach. Real portals show the last four at most, behind a reveal. The
   * value is fake and it is rendered exactly as drawn so the decision is
   * visible for review — it should not survive into a real build.
   */
  ssn: '585-94-0973',
};

export const EMERGENCY_CONTACT = {
  name: 'Frankie Francis',
  phone: '(543) 568-6547',
  email: 'frankiefrancist@example.com',
  relationship: 'Sister',
};

/** The fallback sentence under Home's greeting, shown when nothing is due. */
export const WELCOME = {
  body:
    'Welcome to our secure patient portal! Enjoy convenient 24/7 access to ' +
    'your healthcare journey, right from the comfort of your home or office.',
  emergency: 'If you are having an emergency please dial 911',
};

/**
 * What is owed.
 *
 * ⚠ NOTHING READS THIS ANY MORE. The Balance Due panel it was written for sat
 * beside the dashboard greeting and is gone; the billing screens carry their
 * own statement and payment fixtures. It is kept because the amount is the
 * practice's figure rather than this file's invention, and a balance belongs
 * on the account whenever a screen wants one again.
 */
export const BALANCE = {
  amount: 56,
  body:
    'To continue accessing services smoothly, please complete your payment.',
};
