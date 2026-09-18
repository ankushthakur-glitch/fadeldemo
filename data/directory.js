/**
 * DEMO DATA for the patient directory.
 * Names, MRNs, numbers and dates are entirely invented. No real PHI.
 *
 * 36 records — 24 active, 12 inactive — so the table fills the viewport,
 * scrolls, and spans more than one page.
 *
 * The list carries INSURANCE rather than clinical tags. A directory is a
 * front-desk tool: the question asked of it is "who is this and can we bill
 * them", not "what conditions do they have". Carrier and coverage state come
 * straight off the Add Patient Insurance tab, so what the registrar entered
 * and what the front desk sees are the same fact.
 */

/** Carriers the practice sees. The last two are not contracted. */
const CARRIERS = {
  npn: 'Northern Plains Health Plan',
  prairie: 'Prairie Mutual',
  lakes: 'Great Lakes Choice',
  medicare: 'Medicare Part B',
  medicaid: 'ND Medicaid Expansion',
  summit: 'Summit Bridge PPO',
  cascade: 'Cascade Value HMO',
};

/**
 * Coverage state, as the eligibility check on the Add Patient form leaves it:
 *   active         verified against the payer and the plan is contracted
 *   pending        a policy is on file but has not been verified yet
 *   notContracted  verified, but the practice does not accept this plan
 *   selfPay        no policy — billed directly
 */
export const COVERAGE = {
  active: { label: 'Active', tone: 'success' },
  pending: { label: 'Not verified', tone: 'warning' },
  notContracted: { label: 'Not contracted', tone: 'critical' },
  selfPay: { label: 'Self-pay', tone: 'neutral' },
};

/** Compact row builder — keeps 36 records readable. */
function p(mrn, name, sex, dob, age, phone, lastAppt, carrier, coverage, portal, active) {
  return {
    id: `p${mrn}`,
    mrn: String(mrn),
    name,
    sex,
    dob,
    age,
    phone,
    lastAppt,
    carrier,
    coverage,
    portal,
    active,
  };
}

export const DIRECTORY = [
  p(326486, 'Henna West', 'F', '20-02-1961', 65, '202-555-0188', 'Sun, 23-10-2025', CARRIERS.medicare, 'active', 'active', true),
  p(326480, 'Phoenix Baker', 'M', '25-03-1962', 66, '512-555-9393', 'Sat, 15-10-2025', CARRIERS.npn, 'pending', 'inactive', false),
  p(326478, 'Lana Steiner', 'F', '30-04-1963', 67, '303-555-8374', 'Fri, 21-10-2025', CARRIERS.prairie, 'active', 'active', true),
  p(326483, 'Demi Wilkinson', 'F', '05-05-1964', 68, '718-555-2929', 'Thu, 20-10-2025', CARRIERS.medicare, 'active', 'inactive', false),
  p(326479, 'Candice Wu', 'F', '10-06-1965', 65, '617-555-0385', 'Fri, 14-10-2025', CARRIERS.lakes, 'active', 'inactive', false),
  p(326477, 'Natali Craig', 'F', '15-07-1966', 66, '949-555-7564', 'Wed, 19-10-2025', CARRIERS.summit, 'notContracted', 'pending', true),
  p(326475, 'Drew Cano', 'M', '20-08-1967', 67, '404-555-4738', 'Tue, 11-10-2025', CARRIERS.npn, 'pending', 'active', true),
  p(326485, 'Orlando Diggs', 'M', '25-09-1968', 68, '212-555-8473', 'Tue, 18-10-2025', CARRIERS.medicare, 'active', 'inactive', false),
  p(326474, 'Andi Lane', 'F', '30-10-1969', 69, '602-555-3857', 'Sun, 16-10-2025', CARRIERS.prairie, 'active', 'active', true),
  p(326473, 'Kate Mcmannis', 'F', '04-11-1970', 70, '312-555-9583', 'Sat, 22-10-2025', CARRIERS.medicaid, 'active', 'pending', true),
  p(326481, 'Liam Rodriguez', 'M', '09-12-1971', 71, '415-555-0198', 'Mon, 17-10-2025', null, 'selfPay', 'inactive', false),
  p(326482, 'Sofia Baker', 'F', '14-01-1972', 72, '202-555-0142', 'Thu, 13-10-2025', CARRIERS.lakes, 'pending', 'pending', true),
  p(326476, 'Ethan Kim', 'M', '19-02-1973', 73, '503-555-0184', 'Wed, 12-10-2025', CARRIERS.npn, 'active', 'active', true),
  p(326484, 'Maya Johnson', 'F', '26-03-1974', 74, '212-555-0345', 'Mon, 10-10-2025', CARRIERS.cascade, 'notContracted', 'pending', true),
  p(245638, 'Naomi Samuelson', 'F', '26-03-1974', 74, '212-555-0345', 'Mon, 10-10-2025', CARRIERS.prairie, 'pending', 'pending', true),
  p(326490, 'Marcus Adeyemi', 'M', '11-05-1975', 51, '206-555-0117', 'Fri, 24-10-2025', CARRIERS.npn, 'active', 'active', true),
  p(326491, 'Priya Raman', 'F', '02-09-1976', 49, '408-555-0163', 'Thu, 23-10-2025', CARRIERS.lakes, 'active', 'active', true),
  p(326492, 'Tomas Herrera', 'M', '17-01-1977', 49, '305-555-0129', 'Wed, 22-10-2025', CARRIERS.prairie, 'active', 'active', true),
  p(326493, 'Aisha Bello', 'F', '28-06-1978', 48, '646-555-0192', 'Tue, 21-10-2025', CARRIERS.medicaid, 'active', 'active', true),
  p(326494, 'Henryk Duszynski', 'M', '03-02-1979', 47, '713-555-0148', 'Mon, 20-10-2025', CARRIERS.npn, 'pending', 'pending', true),
  p(326495, 'Fatima Al-Rashid', 'F', '19-11-1980', 45, '702-555-0175', 'Fri, 17-10-2025', CARRIERS.summit, 'notContracted', 'inactive', false),
  p(326496, 'Callum Fraser', 'M', '07-04-1981', 45, '971-555-0136', 'Thu, 16-10-2025', CARRIERS.prairie, 'active', 'active', true),
  p(326497, 'Ingrid Solberg', 'F', '22-08-1982', 43, '303-555-0154', 'Wed, 15-10-2025', CARRIERS.lakes, 'active', 'active', true),
  p(326498, 'Daniel Okafor', 'M', '14-12-1983', 42, '404-555-0181', 'Tue, 14-10-2025', CARRIERS.npn, 'pending', 'pending', true),
  p(326499, 'Mei-Ling Chen', 'F', '30-03-1984', 42, '415-555-0107', 'Mon, 13-10-2025', CARRIERS.prairie, 'active', 'active', true),
  p(326500, 'Rafael Duarte', 'M', '08-07-1985', 41, '786-555-0122', 'Fri, 10-10-2025', null, 'selfPay', 'inactive', false),
  p(326501, 'Sinead O’Malley', 'F', '25-10-1986', 39, '617-555-0169', 'Thu, 09-10-2025', CARRIERS.medicaid, 'pending', 'pending', true),
  p(326502, 'Kofi Mensah', 'M', '12-02-1987', 39, '404-555-0193', 'Wed, 08-10-2025', CARRIERS.npn, 'active', 'active', true),
  p(326503, 'Elena Petrova', 'F', '05-06-1988', 38, '212-555-0158', 'Tue, 07-10-2025', CARRIERS.lakes, 'active', 'active', true),
  p(326504, 'Jonas Lindqvist', 'M', '18-09-1989', 36, '503-555-0114', 'Mon, 06-10-2025', CARRIERS.cascade, 'notContracted', 'inactive', false),
  p(326505, 'Amara Nwosu', 'F', '01-01-1990', 36, '646-555-0177', 'Fri, 03-10-2025', CARRIERS.prairie, 'active', 'active', true),
  p(326506, 'Viktor Novak', 'M', '23-05-1991', 35, '312-555-0141', 'Thu, 02-10-2025', CARRIERS.medicaid, 'pending', 'pending', true),
  p(326507, 'Leila Haddad', 'F', '09-08-1992', 33, '702-555-0186', 'Wed, 01-10-2025', CARRIERS.npn, 'active', 'active', true),
  p(326508, 'Sam Whitfield', 'M', '16-11-1993', 32, '971-555-0132', 'Tue, 30-09-2025', CARRIERS.prairie, 'pending', 'inactive', false),
  p(326509, 'Nadia Karimi', 'F', '27-02-1994', 32, '206-555-0195', 'Mon, 29-09-2025', CARRIERS.lakes, 'active', 'active', true),
  p(326510, 'Oliver Grant', 'M', '13-07-1995', 31, '713-555-0126', 'Fri, 26-09-2025', null, 'selfPay', 'inactive', false),
];

/** Patient-portal state → badge tone. */
export const PORTAL_TONE = {
  active: { label: 'Active', tone: 'success' },
  inactive: { label: 'Inactive', tone: 'critical' },
  pending: { label: 'Pending', tone: 'neutral' },
};
