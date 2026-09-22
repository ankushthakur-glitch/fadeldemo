/**
 * DEMO DATA — Settings ▸ Master.
 *
 * The reference lists a practice keeps its own copy of: diagnosis codes,
 * procedure codes, payers, endoscopy instruments, the clinician directory,
 * pharmacies and recall types. Every list has the same two facts the
 * Master screen relies on:
 *
 *   id         stable key for the row
 *   active     Active / Inactive, the status pill
 *
 * ICD-10 and CPT identifiers are real; the descriptions are shortened. Every
 * name, payer ID, serial number and address below is invented. No real
 * records.
 */

/* --- ICD-10 diagnosis codes ------------------------------------------------ */

export const ICD_CODES = [
  { id: 'icd-1', code: 'K21.9', description: 'Gastro-esophageal reflux disease without esophagitis', active: true },
  { id: 'icd-2', code: 'K50.90', description: "Crohn's disease, unspecified, without complications", active: true },
  { id: 'icd-3', code: 'K51.90', description: 'Ulcerative colitis, unspecified, without complications', active: true },
  { id: 'icd-4', code: 'K57.30', description: 'Diverticulosis of large intestine without perforation or abscess', active: true },
  { id: 'icd-5', code: 'K64.0', description: 'First degree hemorrhoids', active: false },
  { id: 'icd-6', code: 'R10.13', description: 'Right lower quadrant pain', active: true },
  { id: 'icd-7', code: 'K92.2', description: 'Gastrointestinal hemorrhage, unspecified', active: true },
  { id: 'icd-8', code: 'K29.70', description: 'Gastritis, unspecified, without bleeding', active: false },
  { id: 'icd-9', code: 'K59.00', description: 'Constipation, unspecified', active: true },
  { id: 'icd-10', code: 'Z12.11', description: 'Encounter for screening for malignant neoplasm of colon', active: true },
  { id: 'icd-11', code: 'K21.00', description: 'Gastro-esophageal reflux disease with esophagitis, without bleeding', active: true },
  { id: 'icd-12', code: 'K20.0', description: 'Eosinophilic esophagitis', active: true },
  { id: 'icd-13', code: 'K20.90', description: 'Esophagitis, unspecified, without bleeding', active: true },
  { id: 'icd-14', code: 'K22.10', description: 'Ulcer of esophagus without bleeding', active: true },
  { id: 'icd-15', code: 'K22.2', description: 'Esophageal obstruction', active: true },
  { id: 'icd-16', code: 'K22.4', description: 'Dyskinesia of esophagus', active: true },
  { id: 'icd-17', code: 'K22.70', description: "Barrett's esophagus without dysplasia", active: true },
  { id: 'icd-18', code: 'K22.710', description: "Barrett's esophagus with low grade dysplasia", active: true },
  { id: 'icd-19', code: 'K25.9', description: 'Gastric ulcer, unspecified, without hemorrhage or perforation', active: true },
  { id: 'icd-20', code: 'K26.9', description: 'Duodenal ulcer, unspecified, without hemorrhage or perforation', active: true },
  { id: 'icd-21', code: 'K29.00', description: 'Acute gastritis without bleeding', active: true },
  { id: 'icd-22', code: 'K29.60', description: 'Other gastritis without bleeding', active: true },
  { id: 'icd-23', code: 'K30', description: 'Functional dyspepsia', active: true },
  { id: 'icd-24', code: 'K31.84', description: 'Gastroparesis', active: true },
  { id: 'icd-25', code: 'K44.9', description: 'Diaphragmatic hernia without obstruction or gangrene', active: true },
  { id: 'icd-26', code: 'K50.00', description: "Crohn's disease of small intestine without complications", active: true },
  { id: 'icd-27', code: 'K50.10', description: "Crohn's disease of large intestine without complications", active: true },
  { id: 'icd-28', code: 'K50.80', description: "Crohn's disease of both small and large intestine", active: true },
  { id: 'icd-29', code: 'K51.00', description: 'Ulcerative pancolitis without complications', active: true },
  { id: 'icd-30', code: 'K51.20', description: 'Ulcerative proctitis without complications', active: true },
  { id: 'icd-31', code: 'K51.30', description: 'Ulcerative rectosigmoiditis without complications', active: false },
  { id: 'icd-32', code: 'K52.1', description: 'Toxic gastroenteritis and colitis', active: true },
  { id: 'icd-33', code: 'K52.9', description: 'Noninfective gastroenteritis and colitis, unspecified', active: true },
  { id: 'icd-34', code: 'K55.20', description: 'Angiodysplasia of colon without hemorrhage', active: true },
  { id: 'icd-35', code: 'K56.600', description: 'Partial intestinal obstruction, unspecified as to cause', active: true },
  { id: 'icd-36', code: 'K57.32', description: 'Diverticulitis of large intestine without perforation or bleeding', active: true },
  { id: 'icd-37', code: 'K58.0', description: 'Irritable bowel syndrome with diarrhea', active: true },
  { id: 'icd-38', code: 'K58.1', description: 'Irritable bowel syndrome with constipation', active: true },
  { id: 'icd-39', code: 'K58.2', description: 'Mixed irritable bowel syndrome', active: true },
  { id: 'icd-40', code: 'K59.04', description: 'Chronic idiopathic constipation', active: true },
  { id: 'icd-41', code: 'K59.1', description: 'Functional diarrhea', active: true },
  { id: 'icd-42', code: 'K62.5', description: 'Haemorrhage of anus and rectum', active: true },
  { id: 'icd-43', code: 'K63.5', description: 'Polyp of colon', active: true },
  { id: 'icd-44', code: 'K64.1', description: 'Second degree haemorrhoids', active: true },
  { id: 'icd-45', code: 'K70.30', description: 'Alcoholic cirrhosis of liver without ascites', active: true },
  { id: 'icd-46', code: 'K74.60', description: 'Unspecified cirrhosis of liver', active: true },
  { id: 'icd-47', code: 'K75.4', description: 'Autoimmune hepatitis', active: true },
  { id: 'icd-48', code: 'K75.81', description: 'Nonalcoholic steatohepatitis (NASH)', active: true },
  { id: 'icd-49', code: 'K80.00', description: 'Calculus of gallbladder with acute cholecystitis, without obstruction', active: true },
  { id: 'icd-50', code: 'K81.1', description: 'Chronic cholecystitis', active: false },
  { id: 'icd-51', code: 'K85.90', description: 'Acute pancreatitis without necrosis or infection, unspecified', active: true },
  { id: 'icd-52', code: 'K86.1', description: 'Other chronic pancreatitis', active: true },
  { id: 'icd-53', code: 'K90.0', description: 'Celiac disease', active: true },
  { id: 'icd-54', code: 'K91.1', description: 'Postgastric surgery syndromes', active: false },
  { id: 'icd-55', code: 'K92.0', description: 'Hematemesis', active: true },
  { id: 'icd-56', code: 'K92.1', description: 'Melena', active: true },
  { id: 'icd-57', code: 'B96.81', description: 'Helicobacter pylori as the cause of diseases classified elsewhere', active: true },
  { id: 'icd-58', code: 'R10.11', description: 'Right upper quadrant pain', active: true },
  { id: 'icd-59', code: 'R10.9', description: 'Unspecified abdominal pain', active: true },
  { id: 'icd-60', code: 'R11.2', description: 'Nausea with vomiting, unspecified', active: true },
  { id: 'icd-61', code: 'R13.10', description: 'Dysphagia, unspecified', active: true },
  { id: 'icd-62', code: 'R14.0', description: 'Abdominal distension (gaseous)', active: true },
  { id: 'icd-63', code: 'R19.7', description: 'Diarrhea, unspecified', active: true },
  { id: 'icd-64', code: 'R63.4', description: 'Abnormal weight loss', active: true },
  { id: 'icd-65', code: 'R93.3', description: 'Abnormal findings on diagnostic imaging of other parts of digestive tract', active: false },
  { id: 'icd-66', code: 'D12.6', description: 'Benign neoplasm of colon, unspecified', active: true },
  { id: 'icd-67', code: 'D50.0', description: 'Iron deficiency anemia secondary to blood loss (chronic)', active: true },
  { id: 'icd-68', code: 'C18.9', description: 'Malignant neoplasm of colon, unspecified', active: true },
  { id: 'icd-69', code: 'Z80.0', description: 'Family history of malignant neoplasm of digestive organs', active: true },
  { id: 'icd-70', code: 'Z86.010', description: 'Personal history of colonic polyps', active: true },
  { id: 'icd-71', code: 'Z98.890', description: 'Other specified postprocedural states', active: false },
];

/* --- CPT procedure codes ---------------------------------------------------

   MEDICATION CODES ARE PROCEDURE CODES, AND THEY CARRY THREE THINGS MORE.

   A drug given in the clinic is billed as a line on the claim like any other
   procedure, under a HCPCS J-code. It is priced differently, though: the code
   is defined as a quantity of drug — "infliximab, 10 mg", "propofol, 10 mg" —
   so what the practice charges is a rate PER UNIT, and what goes on the claim
   is that rate times however many units the patient was actually given. A
   400 mg infusion of a code defined in 10 mg units is forty units, not one.

   So a medication code carries, beside the description every code has:

     ndc     the National Drug Code for the product dispensed
     units   how many units of the code a standard administration comes to
     fee     what one unit is charged at

   and the amount on the claim is fee × units — see medicationTotal() below,
   which is the one place that multiplication is written.

   THE NDC BELONGS TO THE CODE, NOT TO A MODIFIER.
   One product, one NDC. A modifier on a claim line says something about how
   the service was delivered — which side, which provider, whether it was
   repeated — and none of that changes which vial came out of the cupboard.
   Hanging the NDC off the modifier instead would mean the same drug had as
   many NDCs as it had ways of being billed, and a claim would name whichever
   one the modifier happened to reach for.

   Codes with no ndc/units/fee are ordinary procedure codes. Most of the list
   is those, and nothing makes them carry three empty fields.
   -------------------------------------------------------------------------- */

const CPT_SEED = [
  { id: 'cpt-1', code: '45378', description: 'Colonoscopy, flexible; diagnostic', active: true },
  { id: 'cpt-2', code: '45380', description: 'Colonoscopy, flexible; with biopsy, single or multiple', active: true },
  { id: 'cpt-3', code: '45385', description: 'Colonoscopy, flexible; with removal of lesion by snare technique', active: true },
  { id: 'cpt-4', code: '43235', description: 'Esophagogastroduodenoscopy, flexible; diagnostic', active: true },
  { id: 'cpt-5', code: '43239', description: 'Esophagogastroduodenoscopy, flexible; with biopsy', active: true },
  { id: 'cpt-6', code: '91110', description: 'Gastrointestinal tract imaging, intraluminal (capsule endoscopy)', active: true },
  { id: 'cpt-7', code: '43450', description: 'Dilation of esophagus, by unguided sound or bougie', active: false },
  { id: 'cpt-8', code: '99213', description: 'Office visit, established patient, 20–29 minutes', active: true },
  { id: 'cpt-9', code: '99214', description: 'Office visit, established patient, 30–39 minutes', active: true },
  { id: 'cpt-10', code: '45331', description: 'Sigmoidoscopy, flexible; with biopsy', active: false },
  { id: 'cpt-11', code: '45379', description: 'Colonoscopy, flexible; with removal of foreign body', active: true },
  { id: 'cpt-12', code: '45381', description: 'Colonoscopy, flexible; with directed submucosal injection', active: true },
  { id: 'cpt-13', code: '45382', description: 'Colonoscopy, flexible; with control of bleeding', active: true },
  { id: 'cpt-14', code: '45384', description: 'Colonoscopy, flexible; with removal of lesion by hot biopsy forceps', active: true },
  { id: 'cpt-15', code: '45386', description: 'Colonoscopy, flexible; with transendoscopic balloon dilation', active: true },
  { id: 'cpt-16', code: '45388', description: 'Colonoscopy, flexible; with ablation of tumor, polyp or other lesion', active: true },
  { id: 'cpt-17', code: '45389', description: 'Colonoscopy, flexible; with endoscopic stent placement', active: false },
  { id: 'cpt-18', code: '45390', description: 'Colonoscopy, flexible; with endoscopic mucosal resection', active: true },
  { id: 'cpt-19', code: '45391', description: 'Colonoscopy, flexible; with endoscopic ultrasound examination', active: true },
  { id: 'cpt-20', code: '45398', description: 'Colonoscopy, flexible; with band ligation', active: true },
  { id: 'cpt-21', code: '44388', description: 'Colonoscopy through stoma; diagnostic', active: true },
  { id: 'cpt-22', code: '44380', description: 'Ileoscopy through stoma; diagnostic', active: false },
  { id: 'cpt-23', code: '44385', description: 'Endoscopic evaluation of small intestinal pouch; diagnostic', active: true },
  { id: 'cpt-24', code: '45330', description: 'Sigmoidoscopy, flexible; diagnostic', active: true },
  { id: 'cpt-25', code: '45333', description: 'Sigmoidoscopy, flexible; with removal of lesion by hot biopsy forceps', active: true },
  { id: 'cpt-26', code: '45338', description: 'Sigmoidoscopy, flexible; with removal of lesion by snare technique', active: true },
  { id: 'cpt-27', code: '46600', description: 'Anoscopy; diagnostic', active: true },
  { id: 'cpt-28', code: '43200', description: 'Esophagoscopy, flexible, transoral; diagnostic', active: true },
  { id: 'cpt-29', code: '43202', description: 'Esophagoscopy, flexible, transoral; with biopsy', active: true },
  { id: 'cpt-30', code: '43215', description: 'Esophagoscopy, flexible, transoral; with removal of foreign body', active: true },
  { id: 'cpt-31', code: '43220', description: 'Esophagoscopy, flexible; with balloon dilation (less than 30 mm)', active: false },
  { id: 'cpt-32', code: '43226', description: 'Esophagoscopy, flexible; with insertion of guide wire and dilation', active: true },
  { id: 'cpt-33', code: '43236', description: 'Esophagogastroduodenoscopy; with directed submucosal injection', active: true },
  { id: 'cpt-34', code: '43237', description: 'Esophagogastroduodenoscopy; with endoscopic ultrasound, esophagus to duodenum', active: true },
  { id: 'cpt-35', code: '43238', description: 'Esophagogastroduodenoscopy; with transmural fine needle aspiration', active: true },
  { id: 'cpt-36', code: '43241', description: 'Esophagogastroduodenoscopy; with insertion of intraluminal tube or catheter', active: true },
  { id: 'cpt-37', code: '43243', description: 'Esophagogastroduodenoscopy; with injection sclerosis of esophageal varices', active: true },
  { id: 'cpt-38', code: '43244', description: 'Esophagogastroduodenoscopy; with band ligation of esophageal varices', active: true },
  { id: 'cpt-39', code: '43245', description: 'Esophagogastroduodenoscopy; with dilation of gastric outlet', active: false },
  { id: 'cpt-40', code: '43246', description: 'Esophagogastroduodenoscopy; with percutaneous gastrostomy tube placement', active: true },
  { id: 'cpt-41', code: '43247', description: 'Esophagogastroduodenoscopy; with removal of foreign body', active: true },
  { id: 'cpt-42', code: '43248', description: 'Esophagogastroduodenoscopy; with guide wire insertion and dilation', active: true },
  { id: 'cpt-43', code: '43249', description: 'Esophagogastroduodenoscopy; with balloon dilation of esophagus', active: true },
  { id: 'cpt-44', code: '43250', description: 'Esophagogastroduodenoscopy; with removal of lesion by hot biopsy forceps', active: true },
  { id: 'cpt-45', code: '43251', description: 'Esophagogastroduodenoscopy; with removal of lesion by snare technique', active: true },
  { id: 'cpt-46', code: '43254', description: 'Esophagogastroduodenoscopy; with endoscopic mucosal resection', active: true },
  { id: 'cpt-47', code: '43255', description: 'Esophagogastroduodenoscopy; with control of bleeding', active: true },
  { id: 'cpt-48', code: '43259', description: 'Esophagogastroduodenoscopy; with endoscopic ultrasound, including duodenum', active: true },
  { id: 'cpt-49', code: '43453', description: 'Dilation of esophagus, over guide wire', active: true },
  { id: 'cpt-50', code: '91010', description: 'Esophageal motility study, with interpretation and report', active: true },
  { id: 'cpt-51', code: '91013', description: 'Esophageal motility study; with stimulation or perfusion', active: false },
  { id: 'cpt-52', code: '91034', description: 'Esophagus, gastro-esophageal reflux test; with nasal catheter pH electrode', active: true },
  { id: 'cpt-53', code: '91035', description: 'Gastro-esophageal reflux test; with mucosal attached telemetry pH electrode', active: true },
  { id: 'cpt-54', code: '91037', description: 'Esophageal function test; gastro-esophageal reflux test with impedance', active: true },
  { id: 'cpt-55', code: '91065', description: 'Breath hydrogen or methane test', active: true },
  { id: 'cpt-56', code: '91111', description: 'Gastrointestinal tract imaging, intraluminal; esophagus with interpretation', active: true },
  { id: 'cpt-57', code: '91112', description: 'Gastrointestinal transit and pressure measurement, stomach through colon', active: false },
  { id: 'cpt-58', code: '91122', description: 'Anorectal manometry', active: true },
  { id: 'cpt-59', code: '99202', description: 'Office visit, new patient, 15–29 minutes', active: true },
  { id: 'cpt-60', code: '99203', description: 'Office visit, new patient, 30–44 minutes', active: true },
  { id: 'cpt-61', code: '99204', description: 'Office visit, new patient, 45–59 minutes', active: true },
  { id: 'cpt-62', code: '99205', description: 'Office visit, new patient, 60–74 minutes', active: true },
  { id: 'cpt-63', code: '99211', description: 'Office visit, established patient, minimal presenting problem', active: true },
  { id: 'cpt-64', code: '99212', description: 'Office visit, established patient, 10–19 minutes', active: true },
  { id: 'cpt-65', code: '99215', description: 'Office visit, established patient, 40–54 minutes', active: true },
  { id: 'cpt-66', code: '99417', description: 'Prolonged outpatient service, each additional 15 minutes', active: false },
  { id: 'cpt-67', code: '88304', description: 'Level III surgical pathology, gross and microscopic examination', active: true },
  { id: 'cpt-68', code: '88305', description: 'Level IV surgical pathology, gross and microscopic examination', active: true },
  { id: 'cpt-69', code: '88312', description: 'Special stain including interpretation; group I for micro-organisms', active: true },
  { id: 'cpt-70', code: '88342', description: 'Immunohistochemistry, each separately identifiable antibody', active: true },
  { id: 'cpt-71', code: '00731', description: 'Anesthesia for upper gastrointestinal endoscopic procedures', active: true },
  { id: 'cpt-72', code: '00732', description: 'Anesthesia for endoscopic retrograde cholangiopancreatography', active: true },
  { id: 'cpt-73', code: '00811', description: 'Anesthesia for lower intestinal endoscopy, not otherwise specified', active: true },
  { id: 'cpt-74', code: '00812', description: 'Anesthesia for screening colonoscopy', active: true },
  { id: 'cpt-75', code: '00813', description: 'Anesthesia for combined upper and lower endoscopy', active: true },
  { id: 'cpt-76', code: '96360', description: 'Intravenous infusion, hydration; initial 31 minutes to 1 hour', active: true },
  { id: 'cpt-77', code: '96365', description: 'Intravenous infusion, for therapy or diagnosis; initial up to 1 hour', active: true },
  { id: 'cpt-78', code: '96366', description: 'Intravenous infusion, therapy; each additional hour', active: true },
  { id: 'cpt-79', code: '96413', description: 'Chemotherapy administration, intravenous infusion; up to 1 hour', active: false },
  { id: 'cpt-80', code: '76700', description: 'Ultrasound, abdominal, real time with image documentation; complete', active: true },
  { id: 'cpt-81', code: '74177', description: 'Computed tomography, abdomen and pelvis; with contrast material', active: true },
  { id: 'cpt-82', code: '74183', description: 'Magnetic resonance imaging, abdomen; without and with contrast', active: false },

  /* --- Medication codes ----------------------------------------------------
     The drugs this practice actually gives: the biologics its IBD clinic
     infuses, the iron its anaemia patients come in for, and the sedation and
     antiemetics every endoscopy list uses. Each is priced per unit of the
     code, which is why the fees look small next to the procedures above — a
     unit of propofol is 10 mg, and a case takes fifty of them. -------------- */

  { id: 'cpt-83', code: 'J1745', description: 'Injection, infliximab, 10 mg', ndc: '57894-030-01', ndcQty: 1, ndcUnit: 'UN', units: 40, active: true },
  { id: 'cpt-84', code: 'J3380', description: 'Injection, vedolizumab, 1 mg', ndc: '64764-300-20', ndcQty: 1, ndcUnit: 'UN', units: 300, active: true },
  { id: 'cpt-85', code: 'J3358', description: 'Injection, ustekinumab, intravenous, 1 mg', ndc: '57894-054-03', ndcQty: 26, ndcUnit: 'ML', units: 390, active: true },
  { id: 'cpt-86', code: 'J1756', description: 'Injection, iron sucrose, 1 mg', ndc: '00517-2340-01', ndcQty: 5, ndcUnit: 'ML', units: 200, active: true },
  // Fifty units at fifty cents — the worked example the practice asked for,
  // and the shape of every sedation line on an endoscopy claim.
  { id: 'cpt-87', code: 'J2704', description: 'Injection, propofol, 10 mg', ndc: '63323-269-20', ndcQty: 20, ndcUnit: 'ML', units: 50, active: true },
  { id: 'cpt-88', code: 'J2250', description: 'Injection, midazolam hydrochloride, 1 mg', ndc: '00409-2596-05', ndcQty: 5, ndcUnit: 'ML', units: 5, active: true },
  { id: 'cpt-89', code: 'J2405', description: 'Injection, ondansetron hydrochloride, 1 mg', ndc: '63323-014-02', ndcQty: 2, ndcUnit: 'ML', units: 4, active: true },
  { id: 'cpt-90', code: 'J1200', description: 'Injection, diphenhydramine hydrochloride, up to 50 mg', ndc: '00641-0376-25', ndcQty: 1, ndcUnit: 'ML', units: 1, active: false },
];

/* --- The charge master ------------------------------------------------------

   A PRICE HAS A DATE, AND THE OLD ONE DOES NOT STOP BEING TRUE.

   A fee is not one number a practice keeps rewriting. It is a dated schedule:
   the amount that took effect on a day, and under it the amount that was in
   effect before it. A claim is priced by what the schedule said on the DATE OF
   SERVICE, so a colonoscopy done last March is still billed at last March's
   fee however many times the list has been raised since. Overwriting a single
   field would make every re-bill, every appeal and every corrected claim
   quietly wrong, and nobody could say what the practice had charged.

   TWO COLUMNS, BECAUSE TWO PARTIES ARE PAID FOR ONE PROCEDURE. The
   PROFESSIONAL fee is the physician's work — it follows the doctor whoever
   owns the room. The FACILITY fee is the room, the staff and the equipment,
   billed by the ASC. A code done in a clinic room has no facility side at all,
   and that is a null rather than a zero: "we bill no facility fee for this"
   and "we bill nothing for it" are different statements, and only one of them
   should ever print as $0.00.

   Drug codes are priced PER UNIT — see the medication note above — so their
   professional figure is what ONE unit costs, not what a dose comes to.

   Newest first is the convention here, but currentFee() does not trust it: it
   picks the newest row that has actually taken effect, so a rise dated for
   next quarter can sit on the list without being charged early.
   -------------------------------------------------------------------------- */

/** code → [[effective date, professional fee, facility fee or null], …] */
const CPT_FEES = {
  // Colonoscopy — the practice's own work, and the ASC's room around it.
  45378: [['2025-01-01', 495, 1310], ['2023-01-01', 450, 1180], ['2021-04-01', 415, 1075]],
  45380: [['2025-01-01', 560, 1465], ['2023-01-01', 505, 1320]],
  45385: [['2025-01-01', 675, 1720], ['2023-01-01', 610, 1545]],
  45379: [['2025-01-01', 640, 1655]],
  45381: [['2025-01-01', 580, 1490]],
  45382: [['2025-01-01', 720, 1840]],
  45384: [['2025-01-01', 610, 1540]],
  45386: [['2025-01-01', 690, 1755]],
  45388: [['2025-01-01', 745, 1880]],
  45389: [['2025-01-01', 890, 2240]],
  45390: [['2025-01-01', 985, 2410]],
  45391: [['2025-01-01', 830, 2050]],
  45398: [['2025-01-01', 640, 1620]],
  44388: [['2025-01-01', 505, 1330]],
  44380: [['2025-01-01', 430, 1155]],
  44385: [['2025-01-01', 455, 1210]],

  // Sigmoidoscopy, and an anoscopy that never leaves the clinic room.
  45330: [['2025-01-01', 265, 720]],
  45331: [['2025-01-01', 310, 835]],
  45333: [['2025-01-01', 345, 905]],
  45338: [['2025-01-01', 395, 1020]],
  46600: [['2025-01-01', 145, null]],

  // Upper endoscopy.
  43200: [['2025-01-01', 375, 995]],
  43202: [['2025-01-01', 425, 1105]],
  43215: [['2025-01-01', 590, 1495]],
  43220: [['2025-01-01', 480, 1240]],
  43226: [['2025-01-01', 505, 1290]],
  43235: [['2025-01-01', 445, 1180], ['2023-01-01', 400, 1060]],
  43236: [['2025-01-01', 545, 1385]],
  43237: [['2025-01-01', 795, 1960]],
  43238: [['2025-01-01', 860, 2115]],
  43239: [['2025-01-01', 510, 1325], ['2023-01-01', 460, 1195]],
  43241: [['2025-01-01', 555, 1400]],
  43243: [['2025-01-01', 810, 2020]],
  43244: [['2025-01-01', 775, 1930]],
  43245: [['2025-01-01', 640, 1610]],
  43246: [['2025-01-01', 725, 1815]],
  43247: [['2025-01-01', 605, 1525]],
  43248: [['2025-01-01', 570, 1440]],
  43249: [['2025-01-01', 545, 1370]],
  43250: [['2025-01-01', 575, 1455]],
  43251: [['2025-01-01', 630, 1585]],
  43254: [['2025-01-01', 940, 2295]],
  43255: [['2025-01-01', 700, 1780]],
  43259: [['2025-01-01', 845, 2085]],
  43450: [['2025-01-01', 285, 760]],
  43453: [['2025-01-01', 330, 875]],

  // Motility, pH and capsule work, read in the clinic rather than the ASC.
  // The Bravo study is the exception — its capsule is placed endoscopically.
  91010: [['2025-01-01', 385, null]],
  91013: [['2025-01-01', 175, null]],
  91034: [['2025-01-01', 320, null]],
  91035: [['2025-01-01', 640, 1180]],
  91037: [['2025-01-01', 415, null]],
  91065: [['2025-01-01', 195, null]],
  91110: [['2025-01-01', 985, null], ['2023-01-01', 900, null]],
  91111: [['2025-01-01', 745, null]],
  91112: [['2025-01-01', 1080, null]],
  91122: [['2025-01-01', 425, null]],

  // Office visits: all clinic, no facility side. The two the practice bills
  // most often carry their history, because those are the two anybody asks
  // about when a patient queries a statement from two years ago.
  99202: [['2025-01-01', 135, null]],
  99203: [['2025-01-01', 195, null]],
  99204: [['2025-01-01', 290, null]],
  99205: [['2025-01-01', 375, null]],
  99211: [['2025-01-01', 55, null]],
  99212: [['2025-01-01', 105, null]],
  99213: [['2025-01-01', 155, null], ['2023-01-01', 140, null], ['2021-04-01', 125, null]],
  99214: [['2025-01-01', 220, null], ['2023-01-01', 198, null], ['2021-04-01', 175, null]],
  99215: [['2025-01-01', 305, null]],
  99417: [['2025-01-01', 65, null]],

  // Pathology, read by the lab the practice sends to.
  88304: [['2025-01-01', 85, null]],
  88305: [['2025-01-01', 145, null]],
  88312: [['2025-01-01', 175, null]],
  88342: [['2025-01-01', 195, null]],

  // Anesthesia is the CRNA's own line: professional only, whoever owns the room.
  '00731': [['2025-01-01', 385, null]],
  '00732': [['2025-01-01', 465, null]],
  '00811': [['2025-01-01', 375, null]],
  '00812': [['2025-01-01', 340, null], ['2023-01-01', 305, null]],
  '00813': [['2025-01-01', 425, null]],

  // Infusion chair time.
  96360: [['2025-01-01', 165, 310]],
  96365: [['2025-01-01', 245, 445]],
  96366: [['2025-01-01', 95, 165]],
  96413: [['2025-01-01', 320, 580]],

  // Imaging, read elsewhere and billed back.
  76700: [['2025-01-01', 265, 480]],
  74177: [['2025-01-01', 620, 1150]],
  74183: [['2025-01-01', 985, 1840]],

  // The drugs, per unit of the code. A figure here is what ONE unit costs —
  // medicationTotal() is what a dose of them comes to.
  J1745: [['2025-01-01', 92.5, null], ['2024-01-01', 88.4, null]],
  J3380: [['2025-01-01', 0.5, null]],
  J3358: [['2025-01-01', 1.05, null], ['2024-01-01', 0.98, null]],
  J1756: [['2025-01-01', 0.55, null]],
  J2704: [['2025-01-01', 0.5, null], ['2023-01-01', 0.46, null]],
  J2250: [['2025-01-01', 0.62, null]],
  J2405: [['2025-01-01', 0.35, null]],
  J1200: [['2025-01-01', 4.2, null]],
};

/* --- Default modifiers -------------------------------------------------------

   WHAT A CODE GOES OUT WITH UNLESS THE CLAIM SAYS OTHERWISE.

   Most codes carry none: a colonoscopy is a colonoscopy, and what qualifies
   one on a particular claim — which side, whether it was repeated, whether it
   was a screening that turned diagnostic — is a fact about that day, not about
   the code. Those are set on the line, not here.

   What IS about the code is how this practice is set up to bill it, and there
   are two of those:

     26   THE PROFESSIONAL COMPONENT. The pathology and imaging codes cover
          both reading the specimen and owning the machine that produced it.
          This practice does neither: slides go to a lab and scans are read
          elsewhere, so every one of these lines bills the read alone. Without
          the 26 the claim asks for the equipment as well, and comes back.

     QZ   A CRNA WITHOUT MEDICAL DIRECTION. Sedation here is a CRNA's job and
          no anaesthesiologist directs it — see the note about who this
          practice actually hires. QZ is what says so, and an anesthesia line
          without it is claiming supervision that did not happen.

   Both are true of every claim these codes appear on, which is what makes them
   defaults rather than something a coder should be retyping.
   -------------------------------------------------------------------------- */

const CPT_MODIFIERS = {
  // Pathology and imaging: the read, not the equipment.
  88304: ['26'],
  88305: ['26'],
  88312: ['26'],
  88342: ['26'],
  76700: ['26'],
  74177: ['26'],
  74183: ['26'],
  // The capsule studies are read the same way — the recorder is the vendor's.
  91110: ['26'],
  91111: ['26'],
  91112: ['26'],

  // Anesthesia, by the CRNA who gave it.
  '00731': ['QZ'],
  '00732': ['QZ'],
  '00811': ['QZ'],
  '00812': ['QZ'],
  '00813': ['QZ'],
};

/**
 * The code list as the rest of the app reads it: every code carrying its own
 * dated schedule and whatever modifiers it goes out with.
 *
 * Both live in their own tables above rather than inline on each row, for the
 * same reason. A charge master IS one document, revised on a date, that a
 * coder reads down; "which of our codes bill the professional component only"
 * is likewise one question with one answer, and spread across ninety rows
 * neither could be read at all. The day the practice raises its endoscopy fees
 * the edit is one place instead of ninety.
 */
export const CPT_CODES = CPT_SEED.map((row) => ({
  ...row,
  modifiers: CPT_MODIFIERS[row.code] ?? [],
  fees: (CPT_FEES[row.code] ?? []).map(([effective, professional, facility]) => ({
    effective,
    professional,
    facility,
  })),
}));

/** Every unit of measure a payer accepts beside an NDC quantity. The code is
 *  what goes on the claim; the name is what a person reads while choosing it. */
export const NDC_UNITS = [
  { code: 'GR', name: 'Gram' },
  { code: 'ME', name: 'Milligram' },
  { code: 'ML', name: 'Milliliter' },
  { code: 'UN', name: 'Unit' },
  { code: 'F2', name: 'International Unit' },
];

/**
 * The schedule row in force on a date — the newest one that has actually
 * taken effect.
 *
 * A schedule may hold a rise dated for next quarter; it is on the list because
 * someone has agreed it, not because it is being billed yet. Reading the top
 * of the list regardless would start charging it early. A code priced only
 * from a future date is NOT PRICED today rather than priced at zero.
 *
 * The list is kept newest-first by convention and this does not rely on it:
 * an edit that appends a row, or a file loaded in whatever order it came in,
 * must not change what a code costs.
 */
export function currentSchedule(row, asOf = new Date().toISOString().slice(0, 10)) {
  const live = (row?.fees ?? []).filter((entry) => entry.effective <= asOf);
  if (!live.length) return null;
  return live.reduce((best, entry) => (entry.effective > best.effective ? entry : best));
}

/** The professional side of that row — what the practice charges today, which
 *  is the figure every screen but the fee editor actually wants. */
export function currentFee(row, asOf) {
  return currentSchedule(row, asOf)?.professional ?? null;
}

/**
 * What a medication code comes to on a claim: the per-unit fee times the
 * units given.
 *
 *   $0.50 a unit × 50 units = $25.00
 *
 * Written once, here, and read by both the Master screen's own preview and
 * the claim that bills it — a second copy of one multiplication is how the
 * price list and the claim come to disagree about the same drug.
 *
 * The per-unit figure comes off the dated schedule rather than a field of its
 * own, so a drug re-priced in January bills at January's rate from January and
 * at last year's rate on a claim re-sent for last year's infusion.
 *
 * Coerced rather than trusted: the numbers come back off a form as strings,
 * and a code with nothing filled in is not a medication code at all, so it
 * has no total rather than a total of zero.
 */
export function medicationTotal(row, asOf) {
  const priced = currentFee(row, asOf);
  // Explicitly, because Number(null) is 0 and a drug with no schedule on it
  // has no price at all — not a free one.
  if (priced === null) return null;
  const fee = Number(priced);
  const units = Number(row?.units);
  if (!Number.isFinite(fee) || !Number.isFinite(units)) return null;
  return Math.round(fee * units * 100) / 100;
}

/** A code is a medication code when it has an NDC. That is the fact that
 *  makes it one — a drug that was dispensed — and units and the schedule are
 *  how it is priced once it is. */
export const isMedicationCode = (row) => Boolean(row?.ndc);

/* --- Payers ---------------------------------------------------------------- */

export const PAYER_TYPES = [
  'Commercial',
  'Medicare',
  'Medicare Advantage',
  'Medicaid',
  'Managed Medicaid',
  'TRICARE / VA',
  'Workers Compensation',
  'Auto / Liability',
  'Self Pay',
];

export const PAYERS = [
  { id: 'pay-1', name: 'Blue Cross Blue Shield of North Dakota', payerId: 'BCBSND', payerType: 'Commercial', active: true },
  { id: 'pay-2', name: 'Sanford Health Plan', payerId: 'SHP001', payerType: 'Commercial', active: true },
  { id: 'pay-3', name: 'Medicare Part B — North Dakota', payerId: 'MCRND', payerType: 'Medicare', active: true },
  { id: 'pay-4', name: 'North Dakota Medicaid', payerId: 'NDMED', payerType: 'Medicaid', active: true },
  { id: 'pay-5', name: 'Medica', payerId: 'MEDICA', payerType: 'Commercial', active: true },
  { id: 'pay-6', name: 'UnitedHealthcare', payerId: '87726', payerType: 'Commercial', active: true },
  { id: 'pay-7', name: 'Aetna', payerId: '60054', payerType: 'Commercial', active: false },
  { id: 'pay-8', name: 'WSI North Dakota', payerId: 'WSIND', payerType: 'Workers Compensation', active: false },
  { id: 'pay-9', name: 'Blue Cross Blue Shield of Minnesota', payerId: 'BCBSMN', payerType: 'Commercial', active: true },
  { id: 'pay-10', name: 'Blue Cross Blue Shield of South Dakota (Wellmark)', payerId: 'WELLSD', payerType: 'Commercial', active: true },
  { id: 'pay-11', name: 'Blue Cross Blue Shield of Montana', payerId: 'BCBSMT', payerType: 'Commercial', active: true },
  { id: 'pay-12', name: 'Blue Cross Blue Shield Federal Employee Program', payerId: 'BCBSFEP', payerType: 'Commercial', active: true },
  { id: 'pay-13', name: 'Cigna Healthcare', payerId: '62308', payerType: 'Commercial', active: true },
  { id: 'pay-14', name: 'Cigna HealthSpring', payerId: '52192', payerType: 'Medicare Advantage', active: true },
  { id: 'pay-15', name: 'Humana', payerId: '61101', payerType: 'Commercial', active: true },
  { id: 'pay-16', name: 'Humana Gold Plus (HMO)', payerId: 'HUMGP', payerType: 'Medicare Advantage', active: true },
  { id: 'pay-17', name: 'UnitedHealthcare Medicare Solutions', payerId: '87726MA', payerType: 'Medicare Advantage', active: true },
  { id: 'pay-18', name: 'UnitedHealthcare Community Plan — North Dakota', payerId: '87726CP', payerType: 'Managed Medicaid', active: true },
  { id: 'pay-19', name: 'Aetna Better Health', payerId: '60054BH', payerType: 'Managed Medicaid', active: true },
  { id: 'pay-20', name: 'Aetna Medicare Advantage', payerId: '60054MA', payerType: 'Medicare Advantage', active: true },
  { id: 'pay-21', name: 'Sanford Health Plan — Medica Choice', payerId: 'SHP002', payerType: 'Commercial', active: true },
  { id: 'pay-22', name: 'Medica Prime Solution', payerId: 'MEDICAPS', payerType: 'Medicare Advantage', active: true },
  { id: 'pay-23', name: 'HealthPartners', payerId: '94267', payerType: 'Commercial', active: true },
  { id: 'pay-24', name: 'PreferredOne', payerId: '41147', payerType: 'Commercial', active: true },
  { id: 'pay-25', name: 'UCare Minnesota', payerId: '52629', payerType: 'Managed Medicaid', active: true },
  { id: 'pay-26', name: 'Avera Health Plans', payerId: 'AVERA1', payerType: 'Commercial', active: true },
  { id: 'pay-27', name: 'Essentia Health Plan', payerId: 'ESSHP', payerType: 'Commercial', active: false },
  { id: 'pay-28', name: 'Altru Health System Plan', payerId: 'ALTRU1', payerType: 'Commercial', active: true },
  { id: 'pay-29', name: 'Medicare Part A — North Dakota', payerId: 'MCRNDA', payerType: 'Medicare', active: true },
  { id: 'pay-30', name: 'Medicare Part B — Minnesota', payerId: 'MCRMN', payerType: 'Medicare', active: true },
  { id: 'pay-31', name: 'Medicare Part B — South Dakota', payerId: 'MCRSD', payerType: 'Medicare', active: true },
  { id: 'pay-32', name: 'Railroad Medicare (Palmetto GBA)', payerId: 'RRMCR', payerType: 'Medicare', active: true },
  { id: 'pay-33', name: 'Minnesota Medical Assistance', payerId: 'MNMED', payerType: 'Medicaid', active: true },
  { id: 'pay-34', name: 'South Dakota Medicaid', payerId: 'SDMED', payerType: 'Medicaid', active: true },
  { id: 'pay-35', name: 'Montana Healthcare Programs', payerId: 'MTMED', payerType: 'Medicaid', active: false },
  { id: 'pay-36', name: 'North Dakota Medicaid Expansion', payerId: 'NDMEDX', payerType: 'Managed Medicaid', active: true },
  { id: 'pay-37', name: 'TRICARE East (Humana Military)', payerId: 'TREAST', payerType: 'TRICARE / VA', active: true },
  { id: 'pay-38', name: 'TRICARE For Life', payerId: 'TRFL', payerType: 'TRICARE / VA', active: true },
  { id: 'pay-39', name: 'VA Community Care Network — Region 2', payerId: 'VACCN2', payerType: 'TRICARE / VA', active: true },
  { id: 'pay-40', name: 'Indian Health Service — Great Plains Area', payerId: 'IHSGP', payerType: 'TRICARE / VA', active: true },
  { id: 'pay-41', name: 'WSI Minnesota', payerId: 'WSIMN', payerType: 'Workers Compensation', active: true },
  { id: 'pay-42', name: 'Sedgwick Claims Management', payerId: 'SEDGW', payerType: 'Workers Compensation', active: true },
  { id: 'pay-43', name: 'Travelers Workers Compensation', payerId: 'TRVWC', payerType: 'Workers Compensation', active: false },
  { id: 'pay-44', name: 'Liberty Mutual Insurance', payerId: 'LIBMUT', payerType: 'Auto / Liability', active: true },
  { id: 'pay-45', name: 'State Farm Medical Payments', payerId: 'STFRM', payerType: 'Auto / Liability', active: true },
  { id: 'pay-46', name: 'Progressive Casualty Insurance', payerId: 'PROGCI', payerType: 'Auto / Liability', active: false },
  { id: 'pay-47', name: 'Allstate Insurance Company', payerId: 'ALLST', payerType: 'Auto / Liability', active: true },
  { id: 'pay-48', name: 'GastroEMR Gastroenterology Self Pay', payerId: 'SELFPAY', payerType: 'Self Pay', active: true },
  { id: 'pay-49', name: 'GastroEMR Gastroenterology Prompt Pay Discount', payerId: 'PROMPT', payerType: 'Self Pay', active: true },
  { id: 'pay-50', name: 'Charity Care — Financial Assistance Programme', payerId: 'CHARITY', payerType: 'Self Pay', active: true },
  { id: 'pay-51', name: 'MultiPlan / PHCS Network', payerId: 'MULTIPL', payerType: 'Commercial', active: true },
  { id: 'pay-52', name: 'First Health Network', payerId: 'FIRSTH', payerType: 'Commercial', active: true },
  { id: 'pay-53', name: 'Golden Rule Insurance', payerId: 'GOLDR', payerType: 'Commercial', active: false },
  { id: 'pay-54', name: 'Meritain Health', payerId: '64157', payerType: 'Commercial', active: true },
  { id: 'pay-55', name: 'Trustmark Health Benefits', payerId: '35182', payerType: 'Commercial', active: true },
  { id: 'pay-56', name: 'Gravie Administrative Services', payerId: 'GRAVIE', payerType: 'Commercial', active: true },
  { id: 'pay-57', name: 'Christian Brothers Employee Benefit Trust', payerId: 'CBEBT', payerType: 'Commercial', active: false },
  { id: 'pay-58', name: 'GastroEMR Public Employees Health Plan', payerId: 'NDPERS', payerType: 'Commercial', active: true },
  { id: 'pay-59', name: 'Prairie Ridge Employer Trust', payerId: 'PRET01', payerType: 'Commercial', active: true },
  { id: 'pay-60', name: 'Red River Valley Teachers Benefit Fund', payerId: 'RRVTBF', payerType: 'Commercial', active: true },
];

/* --- Instruments ------------------------------------------------------------
   The scopes and recorders a GI unit tracks by serial number, so a procedure
   note can name the exact instrument used and reprocessing stays auditable. */

/* NO INSTRUMENT_TYPES LIST. Type has gone from the instrument form and from
   the record — see the note above INSTRUMENTS. */


/**
 * Instruments, matching the staging system's record.
 *
 * The name IS the asset tag — "CF-HQ190L #0123" — because that is what is
 * written on the scope and what a nurse reads out when one comes back from
 * repair. Model is carried separately for the ones where the tag has been
 * shortened.
 *
 * NO `type`. There was a required dropdown of nine kinds — Colonoscope,
 * Video Processor, Insufflator and the rest — asked of every record and
 * answered by the asset tag two fields above it: "UCR CO₂ Insufflator #0111"
 * and "OER-Elite AER #0091" have already said what they are, and "CF-HQ190L"
 * is a colonoscope and cannot be anything else. What the field actually
 * bought was a second place for the same fact to be wrong in, on a register
 * whose whole point is that it agrees with the label on the box.
 *
 * `dateInService` and `repairs` are the two facts that make this a register
 * rather than a list: how long the scope has been in use, and what has been
 * done to it. A scope's repair history is the thing an infection-control
 * audit asks for, so each repair records when it went, when it was worked on,
 * when it came back, and what was done.
 */
export const INSTRUMENTS = [
  { id: 'ins-1', name: 'CF-HQ190L #0123', model: 'CF-HQ190L', manufacturer: 'Olympus', serial: '2510717', dateInService: '2022-12-01', repairs: [], active: true },
  { id: 'ins-2', name: 'CF-HQ190L #0132', model: 'CF-HQ190L', manufacturer: 'Olympus', serial: '2773354', dateInService: '2025-11-03', repairs: [], active: true },
  { id: 'ins-3', name: 'CF-HQ190L #131', model: 'CF-HQ190L', manufacturer: 'Olympus', serial: '2979513', dateInService: '2025-11-03', repairs: [], active: true },
  {
    id: 'ins-4',
    name: 'GIF-HQ190 #0119',
    model: 'GIF-HQ190',
    manufacturer: 'Olympus',
    serial: '2611456',
    dateInService: '2022-12-01',
    repairs: [
      {
        id: 'rep-1',
        sentOn: '2026-03-02',
        repairedOn: '2026-03-09',
        returnedOn: '2026-03-18',
        detail: 'Bending section replaced; angulation wires re-tensioned. Leak test passed on return.',
        file: 'olympus-rma-88213.pdf',
      },
    ],
    active: true,
  },
  { id: 'ins-5', name: 'GIF-HQ190 #0122', model: 'GIF-HQ190', manufacturer: 'Olympus', serial: '2611460', dateInService: '2022-12-01', repairs: [], active: true },
  { id: 'ins-6', name: 'GIF-HQ190 #0125', model: 'GIF-HQ190', manufacturer: 'Olympus', serial: '2611468', dateInService: '2022-12-01', repairs: [], active: true },
  { id: 'ins-7', name: 'GIF-XP190N #0221', model: 'GIF-XP190N', manufacturer: 'Olympus', serial: '2034924', dateInService: '2025-11-03', repairs: [], active: true },
  { id: 'ins-8', name: 'PCF-H190AL #0126', model: 'PCF-H190AL', manufacturer: 'Olympus', serial: '2726742', dateInService: '2022-12-01', repairs: [], active: true },
  { id: 'ins-9', name: 'PCF-H190DL #0124', model: 'PCF-H190DL', manufacturer: 'Olympus', serial: '2727136', dateInService: '2022-12-01', repairs: [], active: true },
  {
    id: 'ins-10',
    name: 'PCF-H190DL #0128',
    model: 'PCF-H190DL',
    manufacturer: 'Olympus',
    serial: '2726733',
    dateInService: '2022-12-01',
    repairs: [
      {
        id: 'rep-2',
        sentOn: '2025-09-15',
        repairedOn: '2025-09-22',
        returnedOn: '2025-10-01',
        detail: 'CCD replaced after image degradation reported. Full reprocessing before return to service.',
        file: '',
      },
      {
        id: 'rep-3',
        sentOn: '2026-06-04',
        repairedOn: '2026-06-11',
        returnedOn: '',
        detail: 'Suction channel obstruction — sent for channel replacement. Awaiting return.',
        file: '',
      },
    ],
    active: true,
  },
  { id: 'ins-11', name: 'PCF-H190DL #0130', model: 'PCF-H190DL', manufacturer: 'Olympus', serial: '2726676', dateInService: '2022-12-01', repairs: [], active: true },
  { id: 'ins-12', name: 'TJF-Q190V #0031', model: 'TJF-Q190V', manufacturer: 'Olympus', serial: '2451190', dateInService: '2023-04-18', repairs: [], active: true },
  { id: 'ins-13', name: 'PillCam SB3', model: 'SB3', manufacturer: 'Medtronic', serial: '1180', dateInService: '2021-06-30', repairs: [], active: true },
  { id: 'ins-14', name: 'ZepHr Impedance Recorder', model: 'ZepHr', manufacturer: 'Diversatek', serial: '7742', dateInService: '2019-02-11', repairs: [], active: false },
  { id: 'ins-15', name: 'ManoScan ESO', model: 'ESO', manufacturer: 'Medtronic', serial: '3320', dateInService: '2018-08-20', repairs: [], active: false },
  { id: 'ins-16', name: 'CF-HQ190L #0134', model: 'CF-HQ190L', manufacturer: 'Olympus', serial: '2979640', dateInService: '2026-01-19', repairs: [], active: true },
  { id: 'ins-17', name: 'CF-HQ190L #0136', model: 'CF-HQ190L', manufacturer: 'Olympus', serial: '2979712', dateInService: '2026-01-19', repairs: [], active: true },
  { id: 'ins-18', name: 'CF-H190L #0141', model: 'CF-H190L', manufacturer: 'Olympus', serial: '2812004', dateInService: '2024-05-02', repairs: [], active: true },
  { id: 'ins-19', name: 'CF-H190L #0142', model: 'CF-H190L', manufacturer: 'Olympus', serial: '2812118', dateInService: '2024-05-02', repairs: [], active: true },
  {
    id: 'ins-20',
    name: 'CF-H190L #0145',
    model: 'CF-H190L',
    manufacturer: 'Olympus',
    serial: '2812240',
    dateInService: '2024-05-02',
    repairs: [
      {
        id: 'rep-4',
        sentOn: '2026-01-12',
        repairedOn: '2026-01-20',
        returnedOn: '2026-01-29',
        detail: 'Insertion tube kinked in transport; tube replaced and leak test passed on return.',
        file: 'olympus-rma-90114.pdf',
      },
    ],
    active: true,
  },
  { id: 'ins-21', name: 'PCF-H190TL #0151', model: 'PCF-H190TL', manufacturer: 'Olympus', serial: '2726990', dateInService: '2023-09-11', repairs: [], active: true },
  { id: 'ins-22', name: 'PCF-H190TL #0152', model: 'PCF-H190TL', manufacturer: 'Olympus', serial: '2727011', dateInService: '2023-09-11', repairs: [], active: true },
  { id: 'ins-23', name: 'EC-3890Li #0201', model: 'EC-3890Li', manufacturer: 'Pentax Medical', serial: 'A118840', dateInService: '2021-03-15', repairs: [], active: true },
  { id: 'ins-24', name: 'EC-3890Li #0202', model: 'EC-3890Li', manufacturer: 'Pentax Medical', serial: 'A118902', dateInService: '2021-03-15', repairs: [], active: false },
  { id: 'ins-25', name: 'EC-760R-V/M #0210', model: 'EC-760R-V/M', manufacturer: 'Fujifilm', serial: 'F2K4471', dateInService: '2024-11-08', repairs: [], active: true },
  { id: 'ins-26', name: 'EC-760ZP-V/M #0211', model: 'EC-760ZP-V/M', manufacturer: 'Fujifilm', serial: 'F2K4502', dateInService: '2024-11-08', repairs: [], active: true },
  { id: 'ins-27', name: 'GIF-HQ190 #0161', model: 'GIF-HQ190', manufacturer: 'Olympus', serial: '2611702', dateInService: '2024-02-20', repairs: [], active: true },
  { id: 'ins-28', name: 'GIF-HQ190 #0162', model: 'GIF-HQ190', manufacturer: 'Olympus', serial: '2611744', dateInService: '2024-02-20', repairs: [], active: true },
  { id: 'ins-29', name: 'GIF-H190 #0166', model: 'GIF-H190', manufacturer: 'Olympus', serial: '2530118', dateInService: '2023-06-14', repairs: [], active: true },
  { id: 'ins-30', name: 'GIF-H190 #0167', model: 'GIF-H190', manufacturer: 'Olympus', serial: '2530156', dateInService: '2023-06-14', repairs: [], active: true },
  {
    id: 'ins-31',
    name: 'GIF-XP190N #0225',
    model: 'GIF-XP190N',
    manufacturer: 'Olympus',
    serial: '2034998',
    dateInService: '2025-11-03',
    repairs: [
      {
        id: 'rep-5',
        sentOn: '2026-05-18',
        repairedOn: '2026-05-27',
        returnedOn: '2026-06-08',
        detail: 'Angulation control stiff after 400 cases; control body serviced and wires replaced.',
        file: '',
      },
    ],
    active: true,
  },
  { id: 'ins-32', name: 'EG-2990i #0231', model: 'EG-2990i', manufacturer: 'Pentax Medical', serial: 'A230114', dateInService: '2022-08-30', repairs: [], active: true },
  { id: 'ins-33', name: 'EG-760R #0234', model: 'EG-760R', manufacturer: 'Fujifilm', serial: 'F2K5088', dateInService: '2025-04-22', repairs: [], active: true },
  { id: 'ins-34', name: 'TJF-Q190V #0033', model: 'TJF-Q190V', manufacturer: 'Olympus', serial: '2451244', dateInService: '2023-04-18', repairs: [], active: true },
  { id: 'ins-35', name: 'TJF-Q190V #0035', model: 'TJF-Q190V', manufacturer: 'Olympus', serial: '2451301', dateInService: '2024-10-07', repairs: [], active: true },
  {
    id: 'ins-36',
    name: 'ED34-i10T2 #0041',
    model: 'ED34-i10T2',
    manufacturer: 'Pentax Medical',
    serial: 'A551120',
    dateInService: '2024-10-07',
    repairs: [
      {
        id: 'rep-6',
        sentOn: '2026-07-02',
        repairedOn: '',
        returnedOn: '',
        detail: 'Elevator mechanism failed post-reprocessing check. Quarantined and sent to manufacturer.',
        file: 'pentax-rma-11204.pdf',
      },
    ],
    active: false,
  },
  { id: 'ins-37', name: 'GF-UCT180 #0051', model: 'GF-UCT180', manufacturer: 'Olympus', serial: '2810041', dateInService: '2023-01-24', repairs: [], active: true },
  { id: 'ins-38', name: 'GF-UE190 #0053', model: 'GF-UE190', manufacturer: 'Olympus', serial: '2810188', dateInService: '2025-02-11', repairs: [], active: true },
  { id: 'ins-39', name: 'EG-3870UTK #0055', model: 'EG-3870UTK', manufacturer: 'Pentax Medical', serial: 'A660210', dateInService: '2021-09-30', repairs: [], active: false },
  { id: 'ins-40', name: 'SIF-H190 #0061', model: 'SIF-H190', manufacturer: 'Olympus', serial: '2920104', dateInService: '2024-03-19', repairs: [], active: true },
  { id: 'ins-41', name: 'EN-580T #0063', model: 'EN-580T', manufacturer: 'Fujifilm', serial: 'F3K1077', dateInService: '2022-07-05', repairs: [], active: true },
  { id: 'ins-42', name: 'CF-H190L Sigmoid #0071', model: 'CF-H190L', manufacturer: 'Olympus', serial: '2812390', dateInService: '2023-11-28', repairs: [], active: true },
  { id: 'ins-43', name: 'PCF-PH190L #0073', model: 'PCF-PH190L', manufacturer: 'Olympus', serial: '2727208', dateInService: '2023-11-28', repairs: [], active: true },
  { id: 'ins-44', name: 'CV-1500 Processor #0081', model: 'EVIS X1 CV-1500', manufacturer: 'Olympus', serial: '7100221', dateInService: '2025-11-03', repairs: [], active: true },
  { id: 'ins-45', name: 'CV-1500 Processor #0082', model: 'EVIS X1 CV-1500', manufacturer: 'Olympus', serial: '7100248', dateInService: '2025-11-03', repairs: [], active: true },
  { id: 'ins-46', name: 'CV-190 Processor #0084', model: 'EVIS EXERA III CV-190', manufacturer: 'Olympus', serial: '6440118', dateInService: '2019-05-16', repairs: [], active: true },
  { id: 'ins-47', name: 'EPK-i7010 Processor #0086', model: 'EPK-i7010', manufacturer: 'Pentax Medical', serial: 'A770044', dateInService: '2020-02-27', repairs: [], active: false },
  { id: 'ins-48', name: 'OER-Elite AER #0091', model: 'OER-Elite', manufacturer: 'Olympus', serial: '5510088', dateInService: '2022-04-12', repairs: [], active: true },
  { id: 'ins-49', name: 'OER-Elite AER #0092', model: 'OER-Elite', manufacturer: 'Olympus', serial: '5510094', dateInService: '2022-04-12', repairs: [], active: true },
  {
    id: 'ins-50',
    name: 'Advantage Plus AER #0094',
    model: 'Advantage Plus',
    manufacturer: 'Medivators',
    serial: 'MD330140',
    dateInService: '2020-10-19',
    repairs: [
      {
        id: 'rep-7',
        sentOn: '2025-12-01',
        repairedOn: '2025-12-04',
        returnedOn: '2025-12-04',
        detail: 'Field service: disinfectant pump seal replaced. Cycle validation repeated and passed.',
        file: '',
      },
    ],
    active: true,
  },
  { id: 'ins-51', name: 'ESG-410 Generator #0101', model: 'ESG-410', manufacturer: 'Olympus', serial: '4410122', dateInService: '2024-06-25', repairs: [], active: true },
  { id: 'ins-52', name: 'VIO 300 D Generator #0103', model: 'VIO 300 D', manufacturer: 'Erbe', serial: 'ER880210', dateInService: '2019-08-14', repairs: [], active: true },
  { id: 'ins-53', name: 'APC 2 Argon Unit #0105', model: 'APC 2', manufacturer: 'Erbe', serial: 'ER880314', dateInService: '2019-08-14', repairs: [], active: false },
  { id: 'ins-54', name: 'UCR CO₂ Insufflator #0111', model: 'UCR', manufacturer: 'Olympus', serial: '3320480', dateInService: '2021-11-09', repairs: [], active: true },
  { id: 'ins-55', name: 'UCR CO₂ Insufflator #0112', model: 'UCR', manufacturer: 'Olympus', serial: '3320512', dateInService: '2021-11-09', repairs: [], active: true },
  { id: 'ins-56', name: 'PillCam SB3 #2', model: 'SB3', manufacturer: 'Medtronic', serial: '1204', dateInService: '2024-01-31', repairs: [], active: true },
  { id: 'ins-57', name: 'PillCam Colon 2', model: 'Colon 2', manufacturer: 'Medtronic', serial: '1388', dateInService: '2025-06-17', repairs: [], active: true },
  { id: 'ins-58', name: 'ManoScan AR', model: 'AR', manufacturer: 'Medtronic', serial: '3418', dateInService: '2022-02-08', repairs: [], active: true },
  { id: 'ins-59', name: 'InSIGHT Ultima HRM', model: 'InSIGHT Ultima', manufacturer: 'Diversatek', serial: '9042', dateInService: '2023-05-23', repairs: [], active: true },
  { id: 'ins-60', name: 'Bravo Reflux Recorder', model: 'Bravo', manufacturer: 'Medtronic', serial: '7801', dateInService: '2023-05-23', repairs: [], active: true },
];

/* --- Clinician directory -----------------------------------------------------
   Referring and affiliated clinicians the practice corresponds with — not
   necessarily MediNova's own staff, so most have no clinic on file and many
   have no address or number at all. A name is composed at save time from
   its parts (see formatClinicianName in js/screens/master.js): Last, First
   Middle, Title Suffix — e.g. "Abbasi, Sadeea, MD" or "Adamson, Joseph
   ROLAND" (a middle name with no title). Source directory kept its address
   casing as exported; carried through as found rather than normalised. */

export const CREDENTIALS = ['MD', 'DO', 'NP', 'PA', 'RN', 'DPM', 'DDS', 'PharmD'];

export const CLINICIANS = [
  { id: 'cln-1', npi: '1043284971', lastName: 'Abbasi', firstName: 'Sadeea', credential: 'MD', clinicName: '', addressLine1: '1919 Santa Monica Blvd', addressLine2: 'Suite 200', city: 'Santa Monica', state: 'CA', zip: '90404', phone: '(310) 453-1871', fax: '(310) 453-3910', name: 'Abbasi, Sadeea, MD', active: true },
  { id: 'cln-2', npi: '1558392047', lastName: 'Abdelfattah', firstName: 'Ramy', credential: '', clinicName: '', addressLine1: '1300 Anne St NW', addressLine2: '', city: 'Bemidji', state: 'MN', zip: '56601', phone: '(218) 233-4946', fax: '(218) 233-5282', name: 'Abdelfattah, Ramy', active: true },
  { id: 'cln-3', npi: '1730118826', lastName: 'Aberle', firstName: 'Carla', credential: 'MD', clinicName: '', addressLine1: '', addressLine2: '', city: '', state: '', zip: '', phone: '', fax: '', name: 'Aberle, Carla, MD', active: true },
  { id: 'cln-4', npi: '', lastName: 'Abler', firstName: 'Kristi', credential: '', clinicName: '', addressLine1: '', addressLine2: '', city: '', state: '', zip: '', phone: '', fax: '', name: 'Abler, Kristi', active: true },
  { id: 'cln-5', npi: '1861749003', lastName: 'Adamson', firstName: 'Joseph', middleName: 'ROLAND', credential: '', clinicName: '', addressLine1: '1599 JONES ST', addressLine2: '', city: 'GRAND FORKS AFB', state: 'ND', zip: '58204', phone: '(701) 747-5560', fax: '(701) 747-2680', name: 'Adamson, Joseph ROLAND', active: true },
  { id: 'cln-6', npi: '1275639184', lastName: 'Aesoph', firstName: 'Cassandra', middleName: 'JEAN', credential: '', clinicName: '', addressLine1: '1321 15TH AVE NE', addressLine2: '', city: 'ABERDEEN', state: 'SD', zip: '57401', phone: '(605) 725-3900', fax: '(866) 423-6811', name: 'Aesoph, Cassandra JEAN', active: true },
  { id: 'cln-7', npi: '1497026558', lastName: 'Affield', firstName: 'Carrie', credential: '', clinicName: 'Lake Region Healthcare', addressLine1: 'PO BOX 737', addressLine2: '', city: 'PELICAN RAPIDS', state: 'MN', zip: '56572', phone: '(218) 863-6100', fax: '(218) 863-6173', name: 'Affield, Carrie', active: true },
  { id: 'cln-8', npi: '', lastName: 'Afrah', firstName: 'Abdisalan', credential: '', clinicName: '', addressLine1: '', addressLine2: '', city: '', state: '', zip: '', phone: '', fax: '', name: 'Afrah, Abdisalan', active: true },
  { id: 'cln-9', npi: '1629330472', lastName: 'Agarwal', firstName: 'Udit', credential: '', clinicName: '', addressLine1: 'PO BOX 5074', addressLine2: '', city: 'SIOUX FALLS', state: 'SD', zip: '57117', phone: '(701) 323-5202', fax: '(701) 323-5369', name: 'Agarwal, Udit', active: true },
  { id: 'cln-10', npi: '1912284066', lastName: 'Agema', firstName: 'Ryan', credential: '', clinicName: 'Sanford Health', addressLine1: 'Sanford Medical Center', addressLine2: '5225 23rd Ave S', city: 'Fargo', state: 'ND', zip: '58104', phone: '(701) 234-5121', fax: '', name: 'Agema, Ryan', active: true },
  { id: 'cln-11', npi: '1447382910', lastName: 'Ahmed', firstName: 'Nasrin', credential: 'MD', clinicName: 'Essentia Health', addressLine1: '3000 32ND AVE S', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58103', phone: '(701) 364-8000', fax: '(701) 364-8199', name: 'Ahmed, Nasrin, MD', active: true },
  { id: 'cln-12', npi: '', lastName: 'Albrecht', firstName: 'Tara', credential: 'NP', clinicName: '', addressLine1: '', addressLine2: '', city: '', state: '', zip: '', phone: '', fax: '', name: 'Albrecht, Tara, NP', active: true },
  { id: 'cln-13', npi: '1932107744', lastName: 'Alvarez', firstName: 'Miguel', middleName: 'ANTONIO', credential: 'MD', clinicName: 'Prairie Internal Medicine', addressLine1: '1717 UNIVERSITY DR S', addressLine2: 'STE 200', city: 'FARGO', state: 'ND', zip: '58103', phone: '(701) 234-2200', fax: '(701) 234-2288', name: 'Alvarez, Miguel, MD', active: true },
  { id: 'cln-14', npi: '1568220331', lastName: 'Anderson', firstName: 'Britta', credential: 'DO', clinicName: 'Altru Health System', addressLine1: '1200 S COLUMBIA RD', addressLine2: '', city: 'GRAND FORKS', state: 'ND', zip: '58201', phone: '(701) 780-5000', fax: '(701) 780-1710', name: 'Anderson, Britta, DO', active: true },
  { id: 'cln-15', npi: '', lastName: 'Andresen', firstName: 'Kelly', credential: '', clinicName: '', addressLine1: '', addressLine2: '', city: '', state: '', zip: '', phone: '(218) 299-2200', fax: '', name: 'Andresen, Kelly', active: false },
  { id: 'cln-16', npi: '1780994412', lastName: 'Arnesen', firstName: 'Peder', middleName: 'LARS', credential: '', clinicName: '', addressLine1: '605 MAIN AVE', addressLine2: '', city: 'MOORHEAD', state: 'MN', zip: '56560', phone: '(218) 233-1010', fax: '(218) 233-1044', name: 'Arnesen, Peder LARS', active: true },
  { id: 'cln-17', npi: '1295044118', lastName: 'Baird', firstName: 'Colleen', credential: 'PA', clinicName: 'Sanford Health', addressLine1: '801 BROADWAY N', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58102', phone: '(701) 234-2000', fax: '', name: 'Baird, Colleen, PA', active: true },
  { id: 'cln-18', npi: '1639477216', lastName: 'Bakken', firstName: 'Erik', credential: 'MD', clinicName: 'Red River Surgical Associates', addressLine1: '4141 28TH AVE S', addressLine2: 'STE 100', city: 'FARGO', state: 'ND', zip: '58104', phone: '(701) 271-9000', fax: '(701) 271-9012', name: 'Bakken, Erik, MD', active: true },
  { id: 'cln-19', npi: '', lastName: 'Banda', firstName: 'Chipo', credential: 'RN', clinicName: '', addressLine1: '', addressLine2: '', city: '', state: '', zip: '', phone: '', fax: '', name: 'Banda, Chipo, RN', active: true },
  { id: 'cln-20', npi: '1841003719', lastName: 'Barlow', firstName: 'Rhea', credential: 'MD', clinicName: 'Lake Region Healthcare', addressLine1: '712 CASCADE ST S', addressLine2: '', city: 'FERGUS FALLS', state: 'MN', zip: '56537', phone: '(218) 736-8000', fax: '(218) 736-8080', name: 'Barlow, Rhea, MD', active: true },
  { id: 'cln-21', npi: '1750881204', lastName: 'Beaulieu', firstName: 'Marie', middleName: 'CLAIRE', credential: '', clinicName: '', addressLine1: '425 DEMERS AVE', addressLine2: '', city: 'GRAND FORKS', state: 'ND', zip: '58201', phone: '(701) 795-4000', fax: '', name: 'Beaulieu, Marie CLAIRE', active: true },
  { id: 'cln-22', npi: '1326770418', lastName: 'Benitez', firstName: 'Rafael', credential: 'MD', clinicName: 'Avera Medical Group', addressLine1: '1000 E 23RD ST', addressLine2: '', city: 'SIOUX FALLS', state: 'SD', zip: '57105', phone: '(605) 322-8000', fax: '(605) 322-8100', name: 'Benitez, Rafael, MD', active: true },
  { id: 'cln-23', npi: '', lastName: 'Bergstrom', firstName: 'Ingrid', credential: 'NP', clinicName: 'Valley Family Medicine', addressLine1: '', addressLine2: '', city: 'WEST FARGO', state: 'ND', zip: '58078', phone: '(701) 282-3200', fax: '', name: 'Bergstrom, Ingrid, NP', active: true },
  { id: 'cln-24', npi: '1417008822', lastName: 'Bhatt', firstName: 'Anjali', credential: 'MD', clinicName: '', addressLine1: '5225 23RD AVE S', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58104', phone: '(701) 234-5121', fax: '(701) 234-5199', name: 'Bhatt, Anjali, MD', active: true },
  { id: 'cln-25', npi: '1508229104', lastName: 'Blackhawk', firstName: 'Dennis', middleName: 'RAY', credential: '', clinicName: 'Spirit Lake Health Center', addressLine1: 'BLDG 4, HWY 57', addressLine2: '', city: 'FORT TOTTEN', state: 'ND', zip: '58335', phone: '(701) 766-4245', fax: '(701) 766-1120', name: 'Blackhawk, Dennis RAY', active: true },
  { id: 'cln-26', npi: '', lastName: 'Boehm', firstName: 'Kurt', credential: 'DPM', clinicName: '', addressLine1: '', addressLine2: '', city: '', state: '', zip: '', phone: '', fax: '', name: 'Boehm, Kurt, DPM', active: false },
  { id: 'cln-27', npi: '1699330117', lastName: 'Braaten', firstName: 'Sigrid', credential: 'MD', clinicName: 'Altru Clinic — Devils Lake', addressLine1: '1031 7TH ST NE', addressLine2: '', city: 'DEVILS LAKE', state: 'ND', zip: '58301', phone: '(701) 662-2100', fax: '(701) 662-2144', name: 'Braaten, Sigrid, MD', active: true },
  { id: 'cln-28', npi: '1220990455', lastName: 'Brekke', firstName: 'Jonas', credential: 'PA', clinicName: '', addressLine1: '', addressLine2: '', city: 'JAMESTOWN', state: 'ND', zip: '58401', phone: '(701) 952-4800', fax: '', name: 'Brekke, Jonas, PA', active: true },
  { id: 'cln-29', npi: '1873992011', lastName: 'Cardenas', firstName: 'Lucia', credential: 'MD', clinicName: 'Sanford Gastroenterology', addressLine1: '1720 UNIVERSITY DR S', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58103', phone: '(701) 234-4444', fax: '(701) 234-4499', name: 'Cardenas, Lucia, MD', active: true },
  { id: 'cln-30', npi: '', lastName: 'Carlson', firstName: 'Beth', credential: 'RN', clinicName: '', addressLine1: '', addressLine2: '', city: '', state: '', zip: '', phone: '', fax: '', name: 'Carlson, Beth, RN', active: true },
  { id: 'cln-31', npi: '1962110238', lastName: 'Chen', firstName: 'Wei', middleName: 'LIN', credential: 'MD', clinicName: 'Mayo Clinic Health System', addressLine1: '1221 WHIPPLE ST', addressLine2: '', city: 'EAU CLAIRE', state: 'WI', zip: '54703', phone: '(715) 838-3311', fax: '(715) 838-3390', name: 'Chen, Wei, MD', active: true },
  { id: 'cln-32', npi: '1043770118', lastName: 'Chukwu', firstName: 'Ngozi', credential: 'MD', clinicName: '', addressLine1: '', addressLine2: '', city: 'BISMARCK', state: 'ND', zip: '58501', phone: '(701) 323-6000', fax: '', name: 'Chukwu, Ngozi, MD', active: true },
  { id: 'cln-33', npi: '1134668021', lastName: 'Dahl', firstName: 'Oskar', credential: 'DO', clinicName: 'Prairie St John’s', addressLine1: '510 4TH ST S', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58103', phone: '(701) 476-7200', fax: '(701) 476-7290', name: 'Dahl, Oskar, DO', active: true },
  { id: 'cln-34', npi: '', lastName: 'Delgado', firstName: 'Rosa', credential: '', clinicName: '', addressLine1: '', addressLine2: '', city: '', state: '', zip: '', phone: '', fax: '', name: 'Delgado, Rosa', active: true },
  { id: 'cln-35', npi: '1780220119', lastName: 'Dhillon', firstName: 'Harjit', credential: 'MD', clinicName: 'Trinity Health', addressLine1: '2815 16TH ST SW', addressLine2: '', city: 'MINOT', state: 'ND', zip: '58701', phone: '(701) 857-5000', fax: '(701) 857-5199', name: 'Dhillon, Harjit, MD', active: true },
  { id: 'cln-36', npi: '1295771119', lastName: 'Eriksen', firstName: 'Hanne', credential: 'NP', clinicName: 'Valley Community Health', addressLine1: '1401 CENTRAL AVE NW', addressLine2: '', city: 'EAST GRAND FORKS', state: 'MN', zip: '56721', phone: '(218) 773-8888', fax: '', name: 'Eriksen, Hanne, NP', active: true },
  { id: 'cln-37', npi: '1629881114', lastName: 'Fadel', firstName: 'Karim', credential: 'MD', clinicName: '', addressLine1: '3400 13TH AVE S', addressLine2: 'STE 5', city: 'FARGO', state: 'ND', zip: '58103', phone: '(701) 293-4400', fax: '(701) 293-4455', name: 'Fadel, Karim, MD', active: true },
  { id: 'cln-38', npi: '', lastName: 'Fischer', firstName: 'Greta', credential: 'PharmD', clinicName: 'Red River Pharmacy Services', addressLine1: '', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58102', phone: '(701) 232-7770', fax: '', name: 'Fischer, Greta, PharmD', active: true },
  { id: 'cln-39', npi: '1508992110', lastName: 'Gallagher', firstName: 'Sean', middleName: 'PATRICK', credential: 'MD', clinicName: 'Essentia Health — Detroit Lakes', addressLine1: '1027 WASHINGTON AVE', addressLine2: '', city: 'DETROIT LAKES', state: 'MN', zip: '56501', phone: '(218) 847-5611', fax: '(218) 847-5688', name: 'Gallagher, Sean, MD', active: true },
  { id: 'cln-40', npi: '1447221118', lastName: 'Gomez', firstName: 'Alejandra', credential: 'MD', clinicName: '', addressLine1: '', addressLine2: '', city: '', state: '', zip: '', phone: '', fax: '', name: 'Gomez, Alejandra, MD', active: false },
  { id: 'cln-41', npi: '1932880114', lastName: 'Halvorson', firstName: 'Britt', credential: 'DO', clinicName: 'Sanford Clinic — Wahpeton', addressLine1: '275 4TH ST N', addressLine2: '', city: 'WAHPETON', state: 'ND', zip: '58075', phone: '(701) 642-2200', fax: '(701) 642-2288', name: 'Halvorson, Britt, DO', active: true },
  { id: 'cln-42', npi: '', lastName: 'Hansen', firstName: 'Todd', credential: '', clinicName: '', addressLine1: '', addressLine2: '', city: '', state: '', zip: '', phone: '', fax: '', name: 'Hansen, Todd', active: true },
  { id: 'cln-43', npi: '1861224113', lastName: 'Iverson', firstName: 'Dana', middleName: 'MARIE', credential: 'NP', clinicName: '', addressLine1: '1717 S UNIVERSITY DR', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58103', phone: '(701) 271-6000', fax: '', name: 'Iverson, Dana, NP', active: true },
  { id: 'cln-44', npi: '1770440118', lastName: 'Jensen', firstName: 'Marit', credential: 'MD', clinicName: 'Altru Specialty Center', addressLine1: '1000 S COLUMBIA RD', addressLine2: '', city: 'GRAND FORKS', state: 'ND', zip: '58201', phone: '(701) 780-6000', fax: '(701) 780-6099', name: 'Jensen, Marit, MD', active: true },
  { id: 'cln-45', npi: '1326009117', lastName: 'Kaur', firstName: 'Simran', credential: 'MD', clinicName: '', addressLine1: '', addressLine2: '', city: 'BISMARCK', state: 'ND', zip: '58503', phone: '(701) 530-8000', fax: '', name: 'Kaur, Simran, MD', active: true },
  { id: 'cln-46', npi: '', lastName: 'Kowalski', firstName: 'Piotr', credential: 'PA', clinicName: '', addressLine1: '', addressLine2: '', city: '', state: '', zip: '', phone: '', fax: '', name: 'Kowalski, Piotr, PA', active: true },
  { id: 'cln-47', npi: '1215770116', lastName: 'Larsen', firstName: 'Nils', middleName: 'JOHAN', credential: 'MD', clinicName: 'Fargo VA Health Care System', addressLine1: '2101 ELM ST N', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58102', phone: '(701) 232-3241', fax: '(701) 239-3705', name: 'Larsen, Nils, MD', active: true },
  { id: 'cln-48', npi: '1104880115', lastName: 'Lindgren', firstName: 'Astrid', credential: 'RN', clinicName: '', addressLine1: '', addressLine2: '', city: '', state: '', zip: '', phone: '', fax: '', name: 'Lindgren, Astrid, RN', active: true },
  { id: 'cln-49', npi: '1093551114', lastName: 'Mahmood', firstName: 'Zara', credential: 'MD', clinicName: 'CHI St. Alexius Health', addressLine1: '900 E BROADWAY AVE', addressLine2: '', city: 'BISMARCK', state: 'ND', zip: '58501', phone: '(701) 530-7000', fax: '(701) 530-7099', name: 'Mahmood, Zara, MD', active: true },
  { id: 'cln-50', npi: '1982220117', lastName: 'Nakamura', firstName: 'Kenji', credential: 'MD', clinicName: '', addressLine1: '', addressLine2: '', city: '', state: '', zip: '', phone: '', fax: '', name: 'Nakamura, Kenji, MD', active: true },
  { id: 'cln-51', npi: '', lastName: "O'Leary", firstName: 'Fiona', credential: 'NP', clinicName: 'West Acres Family Clinic', addressLine1: '3902 13TH AVE S', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58103', phone: '(701) 297-1900', fax: '', name: "O'Leary, Fiona, NP", active: true },
  { id: 'cln-52', npi: '1871110114', lastName: 'Okonkwo', firstName: 'Emeka', middleName: 'CHIDI', credential: 'MD', clinicName: '', addressLine1: '', addressLine2: '', city: 'MOORHEAD', state: 'MN', zip: '56560', phone: '(218) 299-1200', fax: '', name: 'Okonkwo, Emeka, MD', active: true },
  { id: 'cln-53', npi: '1760770113', lastName: 'Peterson', firstName: 'Hal', credential: 'DO', clinicName: 'Sanford Broadway Clinic', addressLine1: '737 BROADWAY N', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58102', phone: '(701) 234-6000', fax: '(701) 234-6099', name: 'Peterson, Hal, DO', active: false },
  { id: 'cln-54', npi: '1659330112', lastName: 'Quintero', firstName: 'Mateo', credential: 'MD', clinicName: '', addressLine1: '', addressLine2: '', city: '', state: '', zip: '', phone: '', fax: '', name: 'Quintero, Mateo, MD', active: true },
  { id: 'cln-55', npi: '1548990111', lastName: 'Ramaswamy', firstName: 'Priya', credential: 'MD', clinicName: 'Essentia Health — Fargo', addressLine1: '3000 32ND AVE S', addressLine2: 'STE 400', city: 'FARGO', state: 'ND', zip: '58103', phone: '(701) 364-8500', fax: '(701) 364-8599', name: 'Ramaswamy, Priya, MD', active: true },
  { id: 'cln-56', npi: '', lastName: 'Running Bear', firstName: 'Sara', credential: 'RN', clinicName: 'Standing Rock Health Center', addressLine1: '10 N RIVER RD', addressLine2: '', city: 'FORT YATES', state: 'ND', zip: '58538', phone: '(701) 854-3831', fax: '', name: 'Running Bear, Sara, RN', active: true },
  { id: 'cln-57', npi: '1437660110', lastName: 'Schmidt', firstName: 'Lorelei', middleName: 'ANNE', credential: 'MD', clinicName: '', addressLine1: '1500 24TH AVE S', addressLine2: '', city: 'GRAND FORKS', state: 'ND', zip: '58201', phone: '(701) 732-7000', fax: '(701) 732-7099', name: 'Schmidt, Lorelei, MD', active: true },
  { id: 'cln-58', npi: '1326550119', lastName: 'Solberg', firstName: 'Anders', credential: 'PA', clinicName: '', addressLine1: '', addressLine2: '', city: '', state: '', zip: '', phone: '', fax: '', name: 'Solberg, Anders, PA', active: true },
  { id: 'cln-59', npi: '1215440118', lastName: 'Thao', firstName: 'Mai', credential: 'MD', clinicName: 'HealthPartners Clinic', addressLine1: '401 PHALEN BLVD', addressLine2: '', city: 'ST PAUL', state: 'MN', zip: '55130', phone: '(651) 254-3456', fax: '(651) 254-3499', name: 'Thao, Mai, MD', active: true },
  { id: 'cln-60', npi: '1104330117', lastName: 'Vogel', firstName: 'Heinrich', credential: 'MD', clinicName: '', addressLine1: '', addressLine2: '', city: '', state: '', zip: '', phone: '', fax: '', name: 'Vogel, Heinrich, MD', active: false },
  { id: 'cln-61', npi: '1093220116', lastName: 'Whitcomb', firstName: 'Delia', credential: 'DDS', clinicName: 'Red River Oral Surgery', addressLine1: '2701 12TH AVE S', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58103', phone: '(701) 235-8811', fax: '(701) 235-8899', name: 'Whitcomb, Delia, DDS', active: true },
  { id: 'cln-62', npi: '1982110115', lastName: 'Zielinski', firstName: 'Ewa', middleName: 'KATARZYNA', credential: 'MD', clinicName: 'Sanford Roger Maris Cancer Center', addressLine1: '820 4TH ST N', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58122', phone: '(701) 234-7500', fax: '(701) 234-7599', name: 'Zielinski, Ewa, MD', active: true },
];

/* --- Pharmacies ---------------------------------------------------------------
   The type below each name ("(LTC)", "LTC", "SPECIALTY") is the source
   directory's own qualifier — kept as the pharmacy's Type rather than
   invented. Casing carried through exactly as exported, same as the
   clinician directory: some records are shouted in caps, most are not. */

export const PHARMACY_TYPES = ['Retail', 'Specialty', 'Long Term Care', 'Certified for EPCS Services'];

export const PHARMACIES = [
  { id: 'rx-1', name: 'Bay Area Pharmacy #03 (LTC)', contactPerson: '', email: '', open24h: '', type: 'Long Term Care', addressLine1: '501 S. LINCOLN AVE., STE. 10R', addressLine2: '', city: 'CLEARWATER', state: 'FL', zip: '33756', phone: '(737) 447-4248', fax: '(727) 479-3047', active: true },
  { id: 'rx-2', name: "1 SPECIALTY Pharmacy at St. Joseph's University Medical Center", contactPerson: '', email: '', open24h: '', type: 'Specialty', addressLine1: '703 Main Street', addressLine2: '', city: 'Paterson', state: 'NJ', zip: '07503', phone: '(973) 754-5640', fax: '(973) 754-3095', active: true },
  { id: 'rx-3', name: '1ST CHOICE PHARMACY LTC', contactPerson: '', email: '', open24h: '', type: 'Long Term Care', addressLine1: '4105 49TH ST N, STE B', addressLine2: '', city: 'ST PETERSBURG', state: 'FL', zip: '33709', phone: '(727) 954-8877', fax: '(727) 329-8872', active: true },
  { id: 'rx-4', name: '1st Choice Pharmacy, Inc.', contactPerson: '', email: '', open24h: '', type: 'Retail', addressLine1: '2228 US HWY 19', addressLine2: '', city: 'Holiday', state: 'FL', zip: '34691', phone: '(727) 304-6049', fax: '(727) 674-1820', active: true },
  { id: 'rx-5', name: '3 RIVERS PHARMACY', contactPerson: '', email: '', open24h: '', type: 'Retail', addressLine1: '117 FOX PLAN RD', addressLine2: 'STE 301', city: 'MONROEVILLE', state: 'PA', zip: '15146-2723', phone: '(412) 646-2325', fax: '(412) 291-1852', active: true },
  { id: 'rx-6', name: '406 Clinic Pharmacy - LTC', contactPerson: '', email: '', open24h: '', type: 'Long Term Care', addressLine1: '1315 Wyoming St Suite A', addressLine2: '', city: 'Missoula', state: 'MT', zip: '59801', phone: '(406) 541-4060', fax: '(406) 541-9699', active: true },
  { id: 'rx-7', name: 'Walgreens #04412', contactPerson: 'Dana Reilly', email: 'rx04412@walgreens.example', open24h: 'Yes', type: 'Certified for EPCS Services', addressLine1: '1401 13TH AVE E', addressLine2: '', city: 'WEST FARGO', state: 'ND', zip: '58078', phone: '(701) 282-1220', fax: '(701) 282-1229', active: true },
  { id: 'rx-8', name: 'Walgreens #06188', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: '1607 32ND AVE S', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58103', phone: '(701) 235-4400', fax: '(701) 235-4409', active: true },
  { id: 'rx-9', name: 'CVS Pharmacy #10228', contactPerson: '', email: '', open24h: 'No', type: 'Certified for EPCS Services', addressLine1: '4340 13TH AVE S', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58103', phone: '(701) 282-9010', fax: '(701) 282-9019', active: true },
  { id: 'rx-10', name: 'CVS Pharmacy inside Target #02240', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: '4507 13TH AVE S', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58103', phone: '(701) 281-1600', fax: '(701) 281-1609', active: true },
  { id: 'rx-11', name: 'Thrifty White Pharmacy #742', contactPerson: 'Marcy Odell', email: 'store742@thriftywhite.example', open24h: 'No', type: 'Retail', addressLine1: '1401 33RD ST S', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58103', phone: '(701) 293-8800', fax: '(701) 293-8809', active: true },
  { id: 'rx-12', name: 'Thrifty White Pharmacy #613', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: '215 MAIN AVE E', addressLine2: '', city: 'WEST FARGO', state: 'ND', zip: '58078', phone: '(701) 282-2200', fax: '(701) 282-2209', active: true },
  { id: 'rx-13', name: 'Hornbacher’s Pharmacy — Village West', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: '1532 32ND AVE S', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58103', phone: '(701) 235-6100', fax: '(701) 235-6119', active: true },
  { id: 'rx-14', name: 'Hornbacher’s Pharmacy — Osgood', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: '3100 SHEYENNE ST', addressLine2: '', city: 'WEST FARGO', state: 'ND', zip: '58078', phone: '(701) 356-1500', fax: '(701) 356-1519', active: false },
  { id: 'rx-15', name: 'Sanford Health Pharmacy — Broadway', contactPerson: 'Ivan Petrov', email: 'pharmacy.broadway@sanford.example', open24h: 'Yes', type: 'Certified for EPCS Services', addressLine1: '801 BROADWAY N', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58102', phone: '(701) 234-2500', fax: '(701) 234-2599', active: true },
  { id: 'rx-16', name: 'Sanford Specialty Pharmacy', contactPerson: 'Nadia Rahim', email: 'specialty@sanford.example', open24h: 'No', type: 'Specialty', addressLine1: '5225 23RD AVE S', addressLine2: 'STE 120', city: 'FARGO', state: 'ND', zip: '58104', phone: '(701) 234-5800', fax: '(701) 234-5899', active: true },
  { id: 'rx-17', name: 'Essentia Health Pharmacy — 32nd Ave', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: '3000 32ND AVE S', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58103', phone: '(701) 364-8200', fax: '(701) 364-8299', active: true },
  { id: 'rx-18', name: 'Altru Pharmacy — Columbia Road', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: '1200 S COLUMBIA RD', addressLine2: '', city: 'GRAND FORKS', state: 'ND', zip: '58201', phone: '(701) 780-5200', fax: '(701) 780-5299', active: true },
  { id: 'rx-19', name: 'ALTRU SPECIALTY PHARMACY', contactPerson: '', email: '', open24h: 'No', type: 'Specialty', addressLine1: '1000 S COLUMBIA RD', addressLine2: 'LEVEL 2', city: 'GRAND FORKS', state: 'ND', zip: '58201', phone: '(701) 780-1500', fax: '(701) 780-1599', active: true },
  { id: 'rx-20', name: 'Trinity Health Pharmacy', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: '2815 16TH ST SW', addressLine2: '', city: 'MINOT', state: 'ND', zip: '58701', phone: '(701) 857-5500', fax: '(701) 857-5599', active: true },
  { id: 'rx-21', name: 'CHI St. Alexius Outpatient Pharmacy', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: '900 E BROADWAY AVE', addressLine2: '', city: 'BISMARCK', state: 'ND', zip: '58501', phone: '(701) 530-7400', fax: '(701) 530-7499', active: true },
  { id: 'rx-22', name: 'White Drug #14', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: '1401 W CENTRAL AVE', addressLine2: '', city: 'MINOT', state: 'ND', zip: '58701', phone: '(701) 852-1200', fax: '(701) 852-1209', active: true },
  { id: 'rx-23', name: 'MEDINOVA PHARMACY', contactPerson: 'Louise Amberg', email: '', open24h: 'No', type: 'Retail', addressLine1: '1230 E CENTRAL AVE', addressLine2: 'STE C', city: 'BISMARCK', state: 'ND', zip: '58501', phone: '(701) 224-9521', fax: '(701) 224-9530', active: true },
  { id: 'rx-24', name: 'Prairie Rx Compounding', contactPerson: 'Owen Trask', email: 'orders@prairierx.example', open24h: 'No', type: 'Specialty', addressLine1: '3100 25TH ST S', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58103', phone: '(701) 271-4400', fax: '(701) 271-4409', active: true },
  { id: 'rx-25', name: 'Red River Infusion Pharmacy', contactPerson: 'Grace Nwosu', email: 'infusion@redriverrx.example', open24h: 'No', type: 'Specialty', addressLine1: '4140 PARKER RD', addressLine2: 'BLDG C', city: 'FARGO', state: 'ND', zip: '58104', phone: '(701) 555-0124', fax: '(701) 555-0125', active: true },
  { id: 'rx-26', name: 'Accredo Specialty Pharmacy', contactPerson: '', email: '', open24h: 'No', type: 'Specialty', addressLine1: '1640 CENTURY CENTER PKWY', addressLine2: '', city: 'MEMPHIS', state: 'TN', zip: '38134', phone: '(800) 803-2523', fax: '(888) 302-1028', active: true },
  { id: 'rx-27', name: 'Optum Specialty Pharmacy', contactPerson: '', email: '', open24h: 'No', type: 'Specialty', addressLine1: '1050 PATROL RD', addressLine2: '', city: 'JEFFERSONVILLE', state: 'IN', zip: '47130', phone: '(855) 427-4682', fax: '(877) 342-4596', active: true },
  { id: 'rx-28', name: 'CVS Specialty Pharmacy', contactPerson: '', email: '', open24h: 'No', type: 'Specialty', addressLine1: '2211 SANDERS RD', addressLine2: '', city: 'NORTHBROOK', state: 'IL', zip: '60062', phone: '(800) 237-2767', fax: '(800) 323-2445', active: true },
  { id: 'rx-29', name: 'BriovaRx Infusion Services', contactPerson: '', email: '', open24h: 'No', type: 'Specialty', addressLine1: '4525 EXECUTIVE PARK DR', addressLine2: '', city: 'MONTGOMERY', state: 'AL', zip: '36116', phone: '(866) 218-4679', fax: '(866) 218-4680', active: false },
  { id: 'rx-30', name: 'Express Scripts Home Delivery', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: 'PO BOX 66577', addressLine2: '', city: 'ST LOUIS', state: 'MO', zip: '63166', phone: '(800) 282-2881', fax: '(800) 837-0959', active: true },
  { id: 'rx-31', name: 'OptumRx Mail Service', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: 'PO BOX 2975', addressLine2: '', city: 'MISSION', state: 'KS', zip: '66201', phone: '(800) 562-6223', fax: '(800) 491-7997', active: true },
  { id: 'rx-32', name: 'Walmart Pharmacy #1768', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: '4731 13TH AVE S', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58103', phone: '(701) 282-8900', fax: '(701) 282-8909', active: true },
  { id: 'rx-33', name: 'Walmart Pharmacy #3624', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: '2001 46TH ST SW', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58103', phone: '(701) 356-2400', fax: '(701) 356-2409', active: true },
  { id: 'rx-34', name: 'Sam’s Club Pharmacy #6423', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: '4901 13TH AVE S', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58103', phone: '(701) 281-0200', fax: '(701) 281-0209', active: false },
  { id: 'rx-35', name: 'Cash Wise Pharmacy — Fargo', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: '1401 33RD ST SW', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58103', phone: '(701) 297-1800', fax: '(701) 297-1809', active: true },
  { id: 'rx-36', name: 'Cash Wise Pharmacy — Moorhead', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: '1220 8TH ST S', addressLine2: '', city: 'MOORHEAD', state: 'MN', zip: '56560', phone: '(218) 233-4400', fax: '(218) 233-4409', active: true },
  { id: 'rx-37', name: 'Family HealthCare Pharmacy', contactPerson: 'Rosa Iglesias', email: '', open24h: 'No', type: 'Retail', addressLine1: '301 NP AVE N', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58102', phone: '(701) 271-3344', fax: '(701) 271-3355', active: true },
  { id: 'rx-38', name: 'Fargo VA Outpatient Pharmacy', contactPerson: '', email: '', open24h: 'No', type: 'Certified for EPCS Services', addressLine1: '2101 ELM ST N', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58102', phone: '(701) 232-3241', fax: '(701) 239-3705', active: true },
  { id: 'rx-39', name: 'INDIAN HEALTH SERVICE PHARMACY — FORT TOTTEN', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: 'BLDG 4, HWY 57', addressLine2: '', city: 'FORT TOTTEN', state: 'ND', zip: '58335', phone: '(701) 766-4245', fax: '(701) 766-1120', active: true },
  { id: 'rx-40', name: 'Golden Living LTC Pharmacy', contactPerson: 'Ruth Blevins', email: 'intake@goldenltc.example', open24h: 'Yes', type: 'Long Term Care', addressLine1: '2500 UNIVERSITY DR S', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58103', phone: '(701) 232-6600', fax: '(701) 232-6609', active: true },
  { id: 'rx-41', name: 'BETHANY LTC PHARMACY SERVICES', contactPerson: '', email: '', open24h: 'Yes', type: 'Long Term Care', addressLine1: '201 UNIVERSITY DR S', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58103', phone: '(701) 239-3000', fax: '(701) 239-3009', active: true },
  { id: 'rx-42', name: 'Eventide Senior Living Pharmacy (LTC)', contactPerson: '', email: '', open24h: 'No', type: 'Long Term Care', addressLine1: '3225 12TH ST N', addressLine2: '', city: 'MOORHEAD', state: 'MN', zip: '56560', phone: '(218) 233-7508', fax: '(218) 233-7519', active: true },
  { id: 'rx-43', name: 'Guardian Pharmacy of the GastroEMRs — LTC', contactPerson: 'Peter Oyelaran', email: '', open24h: 'Yes', type: 'Long Term Care', addressLine1: '4700 AMBER VALLEY PKWY', addressLine2: 'STE 3', city: 'FARGO', state: 'ND', zip: '58104', phone: '(701) 478-1100', fax: '(701) 478-1109', active: true },
  { id: 'rx-44', name: 'PharMerica LTC #822', contactPerson: '', email: '', open24h: 'Yes', type: 'Long Term Care', addressLine1: '1901 N BROADWAY', addressLine2: '', city: 'MINOT', state: 'ND', zip: '58703', phone: '(701) 852-4400', fax: '(701) 852-4409', active: false },
  { id: 'rx-45', name: 'Omnicare of Sioux Falls (LTC)', contactPerson: '', email: '', open24h: 'Yes', type: 'Long Term Care', addressLine1: '4300 S TECHNOLOGY DR', addressLine2: '', city: 'SIOUX FALLS', state: 'SD', zip: '57106', phone: '(605) 361-4400', fax: '(605) 361-4409', active: true },
  { id: 'rx-46', name: 'Lewis Drug Pharmacy #21', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: '2101 W 41ST ST', addressLine2: '', city: 'SIOUX FALLS', state: 'SD', zip: '57105', phone: '(605) 361-8000', fax: '(605) 361-8009', active: true },
  { id: 'rx-47', name: 'Avera Pharmacy — 69th & Western', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: '6100 S WESTERN AVE', addressLine2: '', city: 'SIOUX FALLS', state: 'SD', zip: '57108', phone: '(605) 322-2000', fax: '(605) 322-2009', active: true },
  { id: 'rx-48', name: 'Hy-Vee Pharmacy — Grand Forks', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: '2751 32ND AVE S', addressLine2: '', city: 'GRAND FORKS', state: 'ND', zip: '58201', phone: '(701) 787-9500', fax: '(701) 787-9509', active: true },
  { id: 'rx-49', name: 'Valley Drug & Department Store', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: '1451 CENTRAL AVE NE', addressLine2: '', city: 'EAST GRAND FORKS', state: 'MN', zip: '56721', phone: '(218) 773-1194', fax: '(218) 773-1195', active: true },
  { id: 'rx-50', name: 'MEDICINE SHOPPE #1442', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: '1450 25TH ST S', addressLine2: '', city: 'FARGO', state: 'ND', zip: '58103', phone: '(701) 237-4400', fax: '(701) 237-4409', active: false },
  { id: 'rx-51', name: 'Jamestown Regional Pharmacy', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: '2422 20TH ST SW', addressLine2: '', city: 'JAMESTOWN', state: 'ND', zip: '58401', phone: '(701) 952-4800', fax: '(701) 952-4809', active: true },
  { id: 'rx-52', name: 'Devils Lake Community Pharmacy', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: '1031 7TH ST NE', addressLine2: '', city: 'DEVILS LAKE', state: 'ND', zip: '58301', phone: '(701) 662-2200', fax: '(701) 662-2209', active: true },
  { id: 'rx-53', name: 'Wahpeton Corner Drug', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: '520 MEDINOVA AVE', addressLine2: '', city: 'WAHPETON', state: 'ND', zip: '58075', phone: '(701) 642-3300', fax: '(701) 642-3309', active: true },
  { id: 'rx-54', name: 'Detroit Lakes Drug', contactPerson: '', email: '', open24h: 'No', type: 'Retail', addressLine1: '1027 WASHINGTON AVE', addressLine2: '', city: 'DETROIT LAKES', state: 'MN', zip: '56501', phone: '(218) 847-5611', fax: '(218) 847-5619', active: true },
  { id: 'rx-55', name: 'Bemidji Specialty Pharmacy', contactPerson: 'Aaron Kalb', email: '', open24h: 'No', type: 'Specialty', addressLine1: '1300 ANNE ST NW', addressLine2: '', city: 'BEMIDJI', state: 'MN', zip: '56601', phone: '(218) 333-5000', fax: '(218) 333-5009', active: true },
  { id: 'rx-56', name: 'Fergus Falls Community Rx (LTC)', contactPerson: '', email: '', open24h: 'Yes', type: 'Long Term Care', addressLine1: '712 CASCADE ST S', addressLine2: '', city: 'FERGUS FALLS', state: 'MN', zip: '56537', phone: '(218) 736-8100', fax: '(218) 736-8109', active: true },
];

/* --- Recall types ---------------------------------------------------------------
   A recall type's Timeframe is composed at save time from the value and unit
   (see formatRecallTimeframe in js/screens/master.js) — "1 year" is singular,
   "3 months" is plural, matching how the source list itself writes them. The
   same composition happens here, from the interval table below, so the seeded
   rows and the ones an administrator adds are worded identically. */

export const RECALL_ACTIVITIES = [
  'Colonoscopy',
  'EGD',
  'Flexible Sigmoidoscopy',
  'Capsule Endoscopy',
  'Manometry',
  'Infusion Review',
  'Lab Work',
  'Imaging',
  'Follow Up',
];
export const RECALL_TIMEFRAME_UNITS = ['Weeks', 'Months', 'Years'];

/**
 * "1 Year" singular, "3 Years" plural — the same composition
 * formatRecallTimeframe() in js/screens/master.js performs when a recall type
 * is saved. Shared shape, two implementations, because the screen composes
 * from a form and this composes from the seed; what matters is that they
 * agree on the wording, which is why the rule is written down twice rather
 * than each guessing.
 *
 * The NAME carries the unit as the picker offers it — "Colonoscopy 1 Year" —
 * and the Timeframe column lower-cases the same string, which is how the list
 * was already written before it grew.
 */
function recallTimeframe(value, unit) {
  const noun = unit.replace(/s$/, '');
  return `${value} ${noun}${value === 1 ? '' : 's'}`;
}

/**
 * [activity, value, unit, active] — the recall interval table, written out
 * rather than generated as a full cross product.
 *
 * A cross product would give every activity every interval, and no practice
 * recalls a capsule study at eighteen years or a lab draw at ten. The
 * intervals below are the ones each activity is actually booked at, which is
 * what makes the Activity filter on this tab worth using: picking EGD
 * narrows to a genuinely different set of rows rather than the same ladder
 * with a different word in front of it.
 */
const RECALL_SPECS = [
  ['Colonoscopy', 1, 'Years'],
  ['Colonoscopy', 3, 'Years'],
  ['Colonoscopy', 5, 'Years'],
  ['Colonoscopy', 10, 'Years'],
  ['Colonoscopy', 3, 'Months'],
  ['Colonoscopy', 6, 'Months'],
  ['EGD', 1, 'Years'],
  ['EGD', 2, 'Years'],
  ['EGD', 3, 'Years'],
  ['EGD', 6, 'Months'],
  ['EGD', 8, 'Weeks'],
  ['Follow Up', 1, 'Months'],
  ['Colonoscopy', 2, 'Years'],
  ['Colonoscopy', 7, 'Years'],
  ['Colonoscopy', 15, 'Years'],
  ['Colonoscopy', 18, 'Years', false],
  ['Colonoscopy', 9, 'Months'],
  ['Colonoscopy', 4, 'Weeks'],
  ['EGD', 4, 'Years'],
  ['EGD', 5, 'Years'],
  ['EGD', 3, 'Months'],
  ['EGD', 12, 'Weeks'],
  ['EGD', 2, 'Weeks'],
  ['Flexible Sigmoidoscopy', 5, 'Years'],
  ['Flexible Sigmoidoscopy', 10, 'Years'],
  ['Flexible Sigmoidoscopy', 1, 'Years'],
  ['Flexible Sigmoidoscopy', 6, 'Months'],
  ['Flexible Sigmoidoscopy', 3, 'Months', false],
  ['Capsule Endoscopy', 1, 'Years'],
  ['Capsule Endoscopy', 2, 'Years'],
  ['Capsule Endoscopy', 6, 'Months'],
  ['Capsule Endoscopy', 8, 'Weeks'],
  ['Manometry', 1, 'Years'],
  ['Manometry', 2, 'Years'],
  ['Manometry', 6, 'Months'],
  ['Manometry', 12, 'Weeks', false],
  ['Infusion Review', 8, 'Weeks'],
  ['Infusion Review', 6, 'Weeks'],
  ['Infusion Review', 4, 'Weeks'],
  ['Infusion Review', 3, 'Months'],
  ['Infusion Review', 6, 'Months'],
  ['Infusion Review', 1, 'Years'],
  ['Lab Work', 2, 'Weeks'],
  ['Lab Work', 4, 'Weeks'],
  ['Lab Work', 3, 'Months'],
  ['Lab Work', 6, 'Months'],
  ['Lab Work', 1, 'Years'],
  ['Imaging', 3, 'Months'],
  ['Imaging', 6, 'Months'],
  ['Imaging', 1, 'Years'],
  ['Imaging', 2, 'Years'],
  ['Imaging', 5, 'Years', false],
  ['Follow Up', 1, 'Weeks'],
  ['Follow Up', 2, 'Weeks'],
  ['Follow Up', 6, 'Weeks'],
  ['Follow Up', 2, 'Months'],
  ['Follow Up', 3, 'Months'],
  ['Follow Up', 6, 'Months'],
  ['Follow Up', 1, 'Years'],
  ['Follow Up', 2, 'Years', false],
];

export const RECALL_TYPES = RECALL_SPECS.map(([activity, value, unit, active = true], index) => ({
  id: `rc-${index + 1}`,
  name: `${activity} ${recallTimeframe(value, unit)}`,
  description: '',
  activity,
  timeframeValue: value,
  timeframeUnit: unit,
  timeframe: recallTimeframe(value, unit).toLowerCase(),
  active,
}));

/* --- Data import --------------------------------------------------------------
   A record of every file that has been loaded into the master lists.

   It exists because an import is the one action on this screen that changes
   hundreds of rows at once. When a code list looks wrong three weeks later,
   the first question is "what did we last load, and did it pass?" — and a
   screen that cannot answer it sends someone to the database.

   `status` is the outcome of the load, not of the file: `pass` means every
   row was applied, `fail` means none were, `processing` means it is still
   being read. A partly-applied import is reported as `fail` with the row
   count that did land, because "some of it worked" is not a state anyone can
   act on without knowing which rows.
   -------------------------------------------------------------------------- */

export const IMPORT_STATUSES = {
  pass: { label: 'Pass', tone: 'success' },
  fail: { label: 'Fail', tone: 'critical' },
  processing: { label: 'Processing', tone: 'warning' },
};

/** What a CSV can be loaded into. The ids match the master list ids. */
export const IMPORT_ENTITIES = [
  { id: 'icd', label: 'ICD-10 Codes' },
  { id: 'cpt', label: 'Procedure' },
  { id: 'payer', label: 'Payer' },
  { id: 'clinician', label: 'Clinician Directory' },
  { id: 'instrument', label: 'Instrument' },
  { id: 'pharmacy', label: 'Pharmacy' },
  { id: 'recall', label: 'Recall Type' },
];

export const DATA_IMPORTS = [
  {
    id: 'imp-1',
    startedAt: '2026-08-04 16:55',
    entity: 'ICD-10 Codes',
    fileName: 'icd10-2026-annual-update.csv',
    user: 'Amara Mensah',
    records: 246,
    status: 'pass',
    note: '',
  },
  {
    id: 'imp-2',
    startedAt: '2026-08-04 16:55',
    entity: 'Clinician Directory',
    fileName: 'referring-clinicians-q3.csv',
    user: 'Ruth Adeyemi',
    records: 165,
    status: 'fail',
    note: 'Row 12: NPI must be 10 digits. Nothing was applied.',
  },
  {
    id: 'imp-3',
    startedAt: '2026-08-04 16:55',
    entity: 'Procedure',
    fileName: 'cpt-2026-january.csv',
    user: 'Sam Okoro',
    records: 279,
    status: 'processing',
    note: 'Reading file…',
  },
  { id: 'imp-4', startedAt: '2026-07-26 09:12', entity: 'ICD-10 Codes', fileName: 'icd10-quarterly-2026-q3.csv', user: 'Amara Mensah', records: 40, status: 'pass', note: '' },
  { id: 'imp-5', startedAt: '2026-07-19 10:40', entity: 'Procedure', fileName: 'cpt-endoscopy-block-2026-q3.csv', user: 'Ruth Adeyemi', records: 77, status: 'pass', note: '' },
  { id: 'imp-6', startedAt: '2026-07-13 11:05', entity: 'Payer', fileName: 'payer-medicaid-plans-2026-q3.csv', user: 'Sam Okoro', records: 114, status: 'pass', note: '' },
  { id: 'imp-7', startedAt: '2026-07-06 13:22', entity: 'Clinician Directory', fileName: 'referring-clinicians-2026-q3.csv', user: 'Lucas Thomas', records: 151, status: 'pass', note: '' },
  { id: 'imp-8', startedAt: '2026-06-30 14:48', entity: 'Instrument', fileName: 'instrument-serials-2026-q2.csv', user: 'System Import', records: 188, status: 'fail', note: 'Row 26: timeframe unit not one of Weeks / Months / Years. Nothing was applied.' },
  { id: 'imp-9', startedAt: '2026-06-23 15:30', entity: 'Pharmacy', fileName: 'ltc-pharmacies-2026-q2.csv', user: 'Sana Nakamura', records: 225, status: 'pass', note: '' },
  { id: 'imp-10', startedAt: '2026-06-17 16:55', entity: 'Recall Type', fileName: 'recall-intervals-2026-q2.csv', user: 'Mia Jackson', records: 262, status: 'pass', note: '' },
  { id: 'imp-11', startedAt: '2026-06-10 08:05', entity: 'ICD-10 Codes', fileName: 'icd10-gi-subset-2026-q2.csv', user: 'Amara Mensah', records: 299, status: 'pass', note: '' },
  { id: 'imp-12', startedAt: '2026-06-04 09:12', entity: 'Procedure', fileName: 'cpt-anesthesia-2026-q2.csv', user: 'Ruth Adeyemi', records: 336, status: 'pass', note: '' },
  { id: 'imp-13', startedAt: '2026-05-28 10:40', entity: 'Payer', fileName: 'payer-directory-2026-q2.csv', user: 'Sam Okoro', records: 373, status: 'pass', note: '' },
  { id: 'imp-14', startedAt: '2026-05-22 11:05', entity: 'Clinician Directory', fileName: 'npi-registry-refresh-2026-q2.csv', user: 'Lucas Thomas', records: 410, status: 'pass', note: '' },
  { id: 'imp-15', startedAt: '2026-05-15 13:22', entity: 'Instrument', fileName: 'reprocessor-inventory-2026-q2.csv', user: 'System Import', records: 447, status: 'fail', note: 'Row 26: timeframe unit not one of Weeks / Months / Years. Nothing was applied.' },
  { id: 'imp-16', startedAt: '2026-05-09 14:48', entity: 'Pharmacy', fileName: 'pharmacy-directory-2026-q2.csv', user: 'Sana Nakamura', records: 484, status: 'pass', note: '' },
  { id: 'imp-17', startedAt: '2026-05-02 15:30', entity: 'Recall Type', fileName: 'recall-types-gi-2026-q2.csv', user: 'Mia Jackson', records: 61, status: 'pass', note: '' },
  { id: 'imp-18', startedAt: '2026-04-26 16:55', entity: 'ICD-10 Codes', fileName: 'icd10-inactivations-2026-q2.csv', user: 'Amara Mensah', records: 98, status: 'pass', note: '' },
  { id: 'imp-19', startedAt: '2026-04-19 08:05', entity: 'Procedure', fileName: 'cpt-2026-q2-revision.csv', user: 'Ruth Adeyemi', records: 135, status: 'pass', note: '' },
  { id: 'imp-20', startedAt: '2026-04-13 09:12', entity: 'Payer', fileName: 'payer-ids-clearinghouse-2026-q2.csv', user: 'Sam Okoro', records: 172, status: 'pass', note: '' },
  { id: 'imp-21', startedAt: '2026-04-06 10:40', entity: 'Clinician Directory', fileName: 'clinician-fax-numbers-2026-q2.csv', user: 'Lucas Thomas', records: 209, status: 'pass', note: '' },
  { id: 'imp-22', startedAt: '2026-03-31 11:05', entity: 'Instrument', fileName: 'scope-register-2026-q1.csv', user: 'System Import', records: 246, status: 'pass', note: '' },
  { id: 'imp-23', startedAt: '2026-03-24 13:22', entity: 'Pharmacy', fileName: 'surescripts-export-2026-q1.csv', user: 'Sana Nakamura', records: 283, status: 'fail', note: 'File exceeded 5,000 rows. Split it and load again.' },
  { id: 'imp-24', startedAt: '2026-03-18 14:48', entity: 'Recall Type', fileName: 'recall-cleanup-2026-q1.csv', user: 'Mia Jackson', records: 320, status: 'pass', note: '' },
  { id: 'imp-25', startedAt: '2026-03-11 15:30', entity: 'ICD-10 Codes', fileName: 'icd10-quarterly-2026-q1.csv', user: 'Amara Mensah', records: 357, status: 'pass', note: '' },
  { id: 'imp-26', startedAt: '2026-03-05 16:55', entity: 'Procedure', fileName: 'cpt-endoscopy-block-2026-q1.csv', user: 'Ruth Adeyemi', records: 394, status: 'pass', note: '' },
  { id: 'imp-27', startedAt: '2026-02-26 08:05', entity: 'Payer', fileName: 'payer-medicaid-plans-2026-q1.csv', user: 'Sam Okoro', records: 431, status: 'pass', note: '' },
  { id: 'imp-28', startedAt: '2026-02-20 09:12', entity: 'Clinician Directory', fileName: 'referring-clinicians-2026-q1.csv', user: 'Lucas Thomas', records: 468, status: 'pass', note: '' },
  { id: 'imp-29', startedAt: '2026-02-13 10:40', entity: 'Instrument', fileName: 'instrument-serials-2026-q1.csv', user: 'System Import', records: 45, status: 'pass', note: '' },
  { id: 'imp-30', startedAt: '2026-02-07 11:05', entity: 'Pharmacy', fileName: 'ltc-pharmacies-2026-q1.csv', user: 'Sana Nakamura', records: 82, status: 'pass', note: '' },
  { id: 'imp-31', startedAt: '2026-01-31 13:22', entity: 'Recall Type', fileName: 'recall-intervals-2026-q1.csv', user: 'Mia Jackson', records: 119, status: 'fail', note: 'Row 62: NPI failed the checksum. 61 rows read before the stop; none were kept.' },
  { id: 'imp-32', startedAt: '2026-01-25 14:48', entity: 'ICD-10 Codes', fileName: 'icd10-gi-subset-2026-q1.csv', user: 'Amara Mensah', records: 156, status: 'pass', note: '' },
  { id: 'imp-33', startedAt: '2026-01-18 15:30', entity: 'Procedure', fileName: 'cpt-anesthesia-2026-q1.csv', user: 'Ruth Adeyemi', records: 193, status: 'pass', note: '' },
  { id: 'imp-34', startedAt: '2026-01-12 16:55', entity: 'Payer', fileName: 'payer-directory-2026-q1.csv', user: 'Sam Okoro', records: 230, status: 'pass', note: '' },
  { id: 'imp-35', startedAt: '2026-01-05 08:05', entity: 'Clinician Directory', fileName: 'npi-registry-refresh-2026-q1.csv', user: 'Lucas Thomas', records: 267, status: 'pass', note: '' },
  { id: 'imp-36', startedAt: '2025-12-30 09:12', entity: 'Instrument', fileName: 'reprocessor-inventory-2025-q4.csv', user: 'System Import', records: 304, status: 'pass', note: '' },
  { id: 'imp-37', startedAt: '2025-12-23 10:40', entity: 'Pharmacy', fileName: 'pharmacy-directory-2025-q4.csv', user: 'Sana Nakamura', records: 341, status: 'fail', note: 'File exceeded 5,000 rows. Split it and load again.' },
  { id: 'imp-38', startedAt: '2025-12-17 11:05', entity: 'Recall Type', fileName: 'recall-types-gi-2025-q4.csv', user: 'Mia Jackson', records: 378, status: 'pass', note: '' },
  { id: 'imp-39', startedAt: '2025-12-10 13:22', entity: 'ICD-10 Codes', fileName: 'icd10-inactivations-2025-q4.csv', user: 'Amara Mensah', records: 415, status: 'pass', note: '' },
  { id: 'imp-40', startedAt: '2025-12-04 14:48', entity: 'Procedure', fileName: 'cpt-2025-q4-revision.csv', user: 'Ruth Adeyemi', records: 452, status: 'pass', note: '' },
  { id: 'imp-41', startedAt: '2025-11-27 15:30', entity: 'Payer', fileName: 'payer-ids-clearinghouse-2025-q4.csv', user: 'Sam Okoro', records: 489, status: 'pass', note: '' },
  { id: 'imp-42', startedAt: '2025-11-21 16:55', entity: 'Clinician Directory', fileName: 'clinician-fax-numbers-2025-q4.csv', user: 'Lucas Thomas', records: 66, status: 'pass', note: '' },
  { id: 'imp-43', startedAt: '2025-11-14 08:05', entity: 'Instrument', fileName: 'scope-register-2025-q4.csv', user: 'System Import', records: 103, status: 'pass', note: '' },
  { id: 'imp-44', startedAt: '2025-11-08 09:12', entity: 'Pharmacy', fileName: 'surescripts-export-2025-q4.csv', user: 'Sana Nakamura', records: 140, status: 'pass', note: '' },
  { id: 'imp-45', startedAt: '2025-11-01 10:40', entity: 'Recall Type', fileName: 'recall-cleanup-2025-q4.csv', user: 'Mia Jackson', records: 177, status: 'fail', note: 'Row 62: NPI failed the checksum. 61 rows read before the stop; none were kept.' },
  { id: 'imp-46', startedAt: '2025-10-26 11:05', entity: 'ICD-10 Codes', fileName: 'icd10-quarterly-2025-q4.csv', user: 'Amara Mensah', records: 214, status: 'pass', note: '' },
  { id: 'imp-47', startedAt: '2025-10-19 13:22', entity: 'Procedure', fileName: 'cpt-endoscopy-block-2025-q4.csv', user: 'Ruth Adeyemi', records: 251, status: 'pass', note: '' },
  { id: 'imp-48', startedAt: '2025-10-13 14:48', entity: 'Payer', fileName: 'payer-medicaid-plans-2025-q4.csv', user: 'Sam Okoro', records: 288, status: 'pass', note: '' },
  { id: 'imp-49', startedAt: '2025-10-06 15:30', entity: 'Clinician Directory', fileName: 'referring-clinicians-2025-q4.csv', user: 'Lucas Thomas', records: 325, status: 'pass', note: '' },
  { id: 'imp-50', startedAt: '2025-09-30 16:55', entity: 'Instrument', fileName: 'instrument-serials-2025-q3.csv', user: 'System Import', records: 362, status: 'pass', note: '' },
  { id: 'imp-51', startedAt: '2025-09-23 08:05', entity: 'Pharmacy', fileName: 'ltc-pharmacies-2025-q3.csv', user: 'Sana Nakamura', records: 399, status: 'pass', note: '' },
  { id: 'imp-52', startedAt: '2025-09-17 09:12', entity: 'Recall Type', fileName: 'recall-intervals-2025-q3.csv', user: 'Mia Jackson', records: 436, status: 'fail', note: 'Row 62: NPI failed the checksum. 61 rows read before the stop; none were kept.' },
  { id: 'imp-53', startedAt: '2025-09-10 10:40', entity: 'ICD-10 Codes', fileName: 'icd10-gi-subset-2025-q3.csv', user: 'Amara Mensah', records: 473, status: 'pass', note: '' },
  { id: 'imp-54', startedAt: '2025-09-04 11:05', entity: 'Procedure', fileName: 'cpt-anesthesia-2025-q3.csv', user: 'Ruth Adeyemi', records: 50, status: 'pass', note: '' },
  { id: 'imp-55', startedAt: '2025-08-28 13:22', entity: 'Payer', fileName: 'payer-directory-2025-q3.csv', user: 'Sam Okoro', records: 87, status: 'pass', note: '' },
];
