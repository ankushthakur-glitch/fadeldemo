/**
 * SPECIMENS — THE JARS A CASE PRODUCES.
 *
 * A biopsy is not a fact about a report. It is a physical jar that leaves the
 * room, travels to a laboratory and comes back days later as the answer that
 * sets the patient's next surveillance interval. Everything in this module
 * exists because that jar has to be findable at both ends of that journey.
 *
 * WHY THE JAR IS LINKED TO A FINDING RATHER THAN TYPED WITH A SITE.
 *
 * The site is already recorded. The endoscopist pressed a segment on the
 * diagram and described what was there — see data/colon-findings.js — so a
 * specimen form that asked "site?" again would be asking a question the report
 * has already answered, and inviting a second answer that disagrees with the
 * first. "Jar 2, ascending colon" and a finding in the transverse are a
 * mislabelled jar, and a mislabelled jar is a wrong diagnosis on the right
 * patient.
 *
 * So a specimen names the finding it came off, and its site is read through
 * that link. The one thing it cannot be given is a site of its own. The dialog
 * that opens a jar therefore asks which finding first, and cannot be saved
 * without one.
 *
 * WHAT IS NOT HERE. No pathology result and no diagnosis: those come back from
 * the laboratory days later and belong to the Pathology step, not to the report
 * written while the patient is still on the table. This module covers the jar
 * from the moment the tissue enters it to the moment it is handed over.
 */

/**
 * How the tissue was taken, as the table writes it.
 *
 * Short. The column has to be readable at a glance across eight other columns,
 * and "Cold snare" is what the endoscopist says out loud; "Cold snare
 * polypectomy (single piece)" is what a claim form wants and is three times the
 * width. The long forms still exist on the finding itself — see
 * INTERVENTION_TECHNIQUES for how one becomes the other — so nothing is lost by
 * writing the short one here.
 */
export const SPECIMEN_TECHNIQUES = [
  'Cold forceps',
  'Cold snare',
  'Hot snare',
  'Hot forceps',
  'EMR',
  'Brush cytology',
  'FNA',
];

/**
 * The intervention recorded on a finding, as the technique on its jar.
 *
 * The finding forms speak the long form because that is the language of the
 * report and of the claim. The jar speaks the short one. This is the one place
 * the two are mapped, so a technique cannot quietly become a different
 * technique on the way from a finding to the pot beside it.
 */
export const INTERVENTION_TECHNIQUES = {
  'Cold biopsy forceps': 'Cold forceps',
  'Cold snare polypectomy': 'Cold snare',
  'Cold snare polypectomy (single piece)': 'Cold snare',
  'Hot snare polypectomy': 'Hot snare',
  'Hot biopsy forceps': 'Hot forceps',
  'Endoscopic mucosal resection (EMR)': 'EMR',
};

/**
 * The interventions that produce a jar.
 *
 * Read off the mapping above rather than listed again, because a technique that
 * can be written on a jar is exactly a technique that produces one. Used to
 * decide whether a finding is offering "+ Add biopsy" or already wearing a jar
 * chip: a polyp taken off with a snare has tissue in a pot by definition; a
 * haemorrhoid that was looked at and graded has not.
 *
 * Anything not on this list can still be given a jar by hand — the endoscopist
 * knows something the list does not — but nothing on it should be able to leave
 * the room with the tissue unaccounted for.
 */
export const TISSUE_TAKING_INTERVENTIONS = Object.keys(INTERVENTION_TECHNIQUES);

/**
 * What the jar is filled with.
 *
 * Formalin for anything going to histology, which is nearly everything, so it
 * is the default a new jar opens with. The others are here because a jar filled
 * with the wrong one is a specimen that cannot be read: tissue for culture must
 * not be fixed, and a cytology brush goes into its own medium.
 */
export const SPECIMEN_FIXATIVES = [
  'Formalin',
  'Saline (fresh — microbiology)',
  'CytoLyt (cytology)',
  'Dry / no fixative',
];

export const SPECIMEN_DEFAULT_FIXATIVE = SPECIMEN_FIXATIVES[0];

/**
 * Where a jar is in the handover, and why this is only three states.
 *
 * The temptation is to model the whole journey — labelled, logged, collected,
 * received, reported — and every one of those after "handed over" is a fact the
 * laboratory owns and this prototype would be inventing. What the room can
 * honestly know is: the jar is being filled and labelled, the jar is labelled,
 * and the jar has left with a requisition. That is what these are.
 */
export const SPECIMEN_STATUSES = {
  labelling: { label: 'Labelling', tone: 'warning' },
  labelled: { label: 'Labelled', tone: 'success' },
  sent: { label: 'With requisition', tone: 'info' },
};

/** The laboratory the practice sends to, as the requisition heads itself. */
export const PATHOLOGY_LAB = {
  name: 'Red River Pathology Associates',
  address: '1820 Broadway N, Fargo, ND 58102',
  phone: '(701) 555-0179',
  account: 'MEDINOVA-GI-04',
};

/**
 * The clock reading a jar is labelled at, as the table writes it.
 *
 * Seconds are dropped deliberately. The interval anybody cares about between a
 * specimen and its neighbour is minutes, and a table of four jars three seconds
 * apart reads as precision that the room does not actually have.
 */
export const specimenTime = (date = new Date()) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
