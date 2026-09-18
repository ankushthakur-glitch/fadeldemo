/**
 * DEMO DATA — the colonoscopy findings diagram.
 *
 * WHY THIS FILE EXISTS SEPARATELY
 * The endoscopist records a finding as a place plus a shape: "a 6 mm sessile
 * polyp in the ascending colon, cold-snared, tattooed distally". The place is
 * the diagram; the shape is a form whose fields are entirely different for a
 * polyp, a diverticulum and a stricture. Hard-coding eleven different forms
 * into the report screen would bury the report's own logic under a thousand
 * lines of markup that is really just a schema, so the schema lives here and
 * js/lib/segment-findings.js renders whatever it is handed.
 *
 * That also means adding a twelfth finding type, or a field to an existing
 * one, is an edit to this file alone.
 *
 * THE FIELD LANGUAGE
 * Every entry in a type's `fields` array is a node with a `kind`:
 *
 *   number | text | textarea | select | check | checks | segmented
 *   range      two boxes reading "From … to …", stored as {from, to}
 *   auto       a read-only box computed from two other fields
 *   row        two nodes side by side
 *   grid       a scoring table — one row per axis, one button per score
 *   panel      a bordered card with an eyebrow, holding named sub-groups
 *
 * `id` is the key the answer is stored under, so it has to be unique within a
 * type but may repeat across types. Nodes without an `id` (row, panel) are
 * layout only and carry no answer of their own.
 *
 * Two optional keys exist for the one-line summary the findings list shows.
 * `unit` is the word that makes a bare number mean something there — "3" on
 * its own says nothing, "3 polyps" says the finding. `summary: false` keeps an
 * answer off that line altogether, for the ones that are only meaningful
 * beside another answer.
 */

/* --- Where a finding sits ---------------------------------------------------
   The eight segments the reference illustration labels, in the order a scope
   meets them coming back out — cecum first, anus last, with the appendix
   hanging off the cecum where the picture puts it.

   `hotspot` is a percentage box over the illustration rather than an SVG path,
   for two reasons. Percentages survive the image being re-exported at another
   size, and a box is something a non-programmer can nudge by eye with the
   "Show regions" toggle on. They are deliberately generous: this is a target
   for a gloved finger on a procedure-room screen, not a colouring book.

   The numbers were measured off the artwork rather than eyeballed — the pink
   pixel runs down each scanline of assets/img/colon-diagram.png — so they hug
   the bowel rather than the label beside it.

   ORDER MATTERS. Later entries paint over earlier ones, so where two boxes
   must overlap the more specific one comes second: the appendix over the
   cecum it hangs off, the anus over the rectum, the rectum over the tail of
   the sigmoid. The flexures resolve the same way — the hepatic corner to the
   transverse, the splenic to the descending. --- */
export const COLON_SEGMENTS = [
  { id: 'cecum', label: 'Cecum', hotspot: { left: 23.7, top: 53.5, width: 12.5, height: 15.9 } },
  { id: 'appendix', label: 'Appendix', hotspot: { left: 29.4, top: 67.5, width: 6.3, height: 9.4 } },
  { id: 'ascending', label: 'Ascending colon', hotspot: { left: 23.7, top: 28.1, width: 10.7, height: 25.4 } },
  { id: 'transverse', label: 'Transverse colon', hotspot: { left: 31.5, top: 12.2, width: 34.1, height: 16.8 } },
  { id: 'descending', label: 'Descending colon', hotspot: { left: 64.4, top: 22.5, width: 10, height: 46.9 } },
  { id: 'sigmoid', label: 'Sigmoid colon', hotspot: { left: 50.6, top: 68.5, width: 15, height: 15 } },
  { id: 'rectum', label: 'Rectum', hotspot: { left: 46.3, top: 82.6, width: 6.3, height: 12.2 } },
  { id: 'anus', label: 'Anus', hotspot: { left: 47.5, top: 93.8, width: 4, height: 5.6 } },
];

/* --- Shared option lists ----------------------------------------------------
   Lists used by more than one finding type, named once so the two never drift
   apart. A polyp and an "Other" finding offer the same injection agents
   because it is the same trolley. --- */

export const INJECTION_AGENTS = [
  'Botox (Botulinum toxin)',
  'Normal Saline (NS)',
  'Tattoo / Carbon ink',
  'Submucosal lift',
];

export const FINDING_COMPLICATIONS = [
  'Bleeding — controlled endoscopically',
  'Bleeding — clip applied',
  'Bleeding — required intervention after the case',
  'Perforation — suspected',
  'Perforation — confirmed',
  'Post-polypectomy coagulation syndrome',
  'Serosal burn',
  'Retained specimen',
  'Other — see notes',
];

export const REMOVAL_METHODS = [
  'Cold biopsy forceps',
  'Cold snare polypectomy',
  'Hot snare polypectomy',
  'Hot biopsy forceps',
  'Endoscopic mucosal resection (EMR)',
  'Endoscopic submucosal dissection (ESD)',
];

export const TATTOO_TYPES = [
  'India ink',
  'Sterile carbon particle suspension (SPOT)',
  'Methylene blue',
];

/* The intervention card that hangs off a polyp. Lifted out because "Other"
   carries the back half of it — a biopsy, an injection, a complication — with
   the polypectomy and tattoo blocks that make no sense there left off. */
const COLD_BIOPSY_GROUP = {
  label: 'Cold Biopsy',
  icon: 'flask',
  fields: [{ kind: 'check', id: 'coldBiopsyTaken', label: 'Cold biopsy taken', boxed: false }],
};

const INJECTION_GROUP = {
  label: 'Injection',
  icon: 'stethoscope',
  fields: [
    { kind: 'checks', id: 'injectionAgents', label: 'Agent(s) used', options: INJECTION_AGENTS, boxed: true },
  ],
};

const COMPLICATION_GROUP = {
  label: 'Complication / Additional intervention',
  icon: 'warning',
  tone: 'warning',
  fields: [
    {
      kind: 'select',
      id: 'complication',
      label: 'Complication',
      placeholder: 'None / select if applicable...',
      options: FINDING_COMPLICATIONS,
    },
  ],
};

const NOTES_FIELD = {
  kind: 'textarea',
  id: 'notes',
  label: 'Description / notes',
  placeholder: 'Additional details...',
  rows: 3,
};

/* --- The eleven finding types ------------------------------------------------
   Order matters: it is the order of the picker, and it runs commonest first
   rather than alphabetically. An endoscopist reaches for Polyp far more often
   than for Anastomosis, and "Normal" and "Other" belong at the bottom because
   they are what you choose when none of the above fits. --- */
export const COLON_FINDING_TYPES = [
  {
    id: 'polyp',
    label: 'Polyp',
    /* The summary line the left-hand list shows for a saved finding. Written
       per type because "3 × 6–8 mm sessile" says more at a glance than a type
       name repeated eight times down the column. */
    fields: [
      { kind: 'number', id: 'count', label: 'Number of polyps', placeholder: 'e.g. 1', unit: 'polyps' },
      {
        kind: 'row',
        items: [
          { kind: 'range', id: 'size', label: 'Size (mm)', fromPlaceholder: 'From', toPlaceholder: 'To' },
          {
            kind: 'select',
            id: 'morphology',
            label: 'Morphology',
            placeholder: 'Select...',
            options: ['Sessile', 'Pedunculated', 'Semi-pedunculated', 'Flat', 'Depressed', 'Laterally spreading'],
          },
        ],
      },
      { kind: 'check', id: 'diminutive', label: 'Diminutive (≤5 mm)', boxed: false },
      {
        kind: 'select',
        id: 'paris',
        label: 'Paris Classification',
        placeholder: 'Select Paris type...',
        hint: 'Endoscopic morphology classification for superficial neoplastic lesions',
        options: [
          '0-Ip — pedunculated',
          '0-Isp — sub-pedunculated',
          '0-Is — sessile',
          '0-IIa — slightly elevated',
          '0-IIb — flat',
          '0-IIc — slightly depressed',
          '0-IIa+IIc — elevated with depression',
          '0-IIc+IIa — depressed with elevation',
          '0-III — excavated',
        ],
      },
      NOTES_FIELD,
      {
        kind: 'panel',
        label: 'Intervention',
        icon: 'stethoscope',
        groups: [
          {
            label: 'Polypectomy',
            fields: [
              {
                kind: 'checks',
                id: 'removalMethods',
                label: 'Removal method (select all that apply)',
                options: REMOVAL_METHODS,
                boxed: false,
              },
            ],
          },
          {
            label: 'Tattoo',
            icon: 'tag',
            fields: [
              { kind: 'select', id: 'tattooType', label: 'Tattoo type', placeholder: 'Select type...', options: TATTOO_TYPES },
              { kind: 'segmented', id: 'tattooSite', label: 'Site injected', options: ['Proximal', 'Distal'] },
              {
                kind: 'row',
                items: [
                  { kind: 'number', id: 'tattooInjections', label: 'No. of injections', placeholder: 'e.g. 3',
                    unit: 'tattoo injections' },
                  /* Per-injection volume is left off the summary line: it is only
                     meaningful beside the count, and the total below already
                     carries both. */
                  { kind: 'number', id: 'tattooVolEach', label: 'Vol / injection (mL)',
                    placeholder: 'e.g. 1', summary: false },
                  /* Multiplied out rather than typed, because the two numbers
                     above are what the operator actually knows and a total
                     typed by hand is a total that can disagree with them. */
                  {
                    kind: 'auto',
                    id: 'tattooVolTotal',
                    label: 'Total vol (mL)',
                    note: 'auto',
                    placeholder: 'auto',
                    unit: 'mL',
                    product: ['tattooInjections', 'tattooVolEach'],
                  },
                ],
              },
            ],
          },
          COLD_BIOPSY_GROUP,
          INJECTION_GROUP,
          COMPLICATION_GROUP,
        ],
      },
    ],
  },

  {
    id: 'diverticulum',
    label: 'Diverticulum',
    fields: [
      {
        kind: 'checks',
        id: 'appearance',
        label: 'Appearance',
        options: ['Small', 'Medium', 'Large', 'Non-inflamed', 'Inflamed'],
        boxed: true,
      },
      {
        kind: 'select',
        id: 'density',
        label: 'Density',
        placeholder: 'Select density...',
        options: ['Solitary', 'Few (fewer than 5)', 'Moderate (5–20)', 'Many (more than 20)', 'Innumerable'],
      },
      {
        kind: 'checks',
        id: 'features',
        label: 'Features',
        options: [
          'Bleeding orifice',
          'Stigmata of hemorrhage',
          'Fecal material',
          'Pigmented spot',
          'Visible vessel',
          'Adherent clot',
        ],
        boxed: true,
      },
      NOTES_FIELD,
    ],
  },

  {
    id: 'mass',
    label: 'Mass / Lesion',
    fields: [
      {
        kind: 'checks',
        id: 'characteristics',
        label: 'Characteristics',
        options: [
          'Ulcerated',
          'Bleeding',
          'Friable',
          'Necrotic',
          'Polypoid',
          'Flat',
          'Infiltrating',
          'Submucosal',
          'Exophytic',
          'Smooth surface',
          'Irregular surface',
          'Stenotic',
          'Circumferential',
        ],
        /* Active bleeding is the one item in this list that changes what
           happens next in the room, so it is the one item that is allowed to
           shout. Tinting all thirteen would tint none of them. */
        alert: ['Bleeding'],
        boxed: true,
      },
      { kind: 'number', id: 'size', label: 'Size (mm)', placeholder: 'e.g. 25', unit: 'mm' },
      {
        kind: 'row',
        items: [
          { kind: 'segmented', id: 'obstructing', label: 'Obstructing', options: ['Yes', 'No'] },
          { kind: 'segmented', id: 'traversed', label: 'Traversed', options: ['Yes', 'No'] },
        ],
      },
      {
        kind: 'checks',
        id: 'intervention',
        label: 'Intervention',
        options: ['Cold biopsy forceps', 'Dilation'],
        boxed: true,
      },
      NOTES_FIELD,
    ],
  },

  {
    id: 'inflammation',
    label: 'Mucosal inflammation',
    fields: [
      {
        kind: 'checks',
        id: 'appearance',
        label: 'Appearance',
        options: [
          'Erythema',
          'Loss of vascular pattern',
          'Friability',
          'Granularity',
          'Ulceration',
          'Exudates',
          'Pseudopolyps',
        ],
        boxed: true,
      },
      { kind: 'segmented', id: 'severity', label: 'Inflammation severity', options: ['Mild', 'Moderate', 'Severe'] },
      /* THE THREE SCORES.
         All three are offered on every segment because which one applies is a
         property of the patient, not of the bowel: a Crohn's patient is scored
         SES-CD, a colitic is scored Mayo, and a post-resection Crohn's patient
         is scored Rutgeerts at the anastomosis. Asking the endoscopist which
         disease they are looking at before showing the right table would be
         one more click for an answer the chart already implies. */
      {
        kind: 'grid',
        id: 'sesCd',
        label: "Crohn's Disease — SES-CD Score",
        hint: 'Total SES-CD = sum of all scored segments. Click a button again to deselect.',
        rows: [
          {
            id: 'ulcerSize',
            label: 'Ulcer size',
            options: [
              { value: '0', caption: 'None' },
              { value: '1', caption: 'Aphthous (0.1–0.5 cm)' },
              { value: '2', caption: 'Large (0.5–2 cm)' },
              { value: '3', caption: 'Very large (>2 cm)' },
            ],
          },
          {
            id: 'ulceratedSurface',
            label: 'Ulcerated surface',
            options: [
              { value: '0', caption: 'None' },
              { value: '1', caption: '<10%' },
              { value: '2', caption: '10–30%' },
              { value: '3', caption: '>30%' },
            ],
          },
          {
            id: 'affectedSurface',
            label: 'Affected surface',
            options: [
              { value: '0', caption: 'Unaffected' },
              { value: '1', caption: '<50%' },
              { value: '2', caption: '50–75%' },
              { value: '3', caption: '>75%' },
            ],
          },
          {
            id: 'narrowings',
            label: 'Narrowings (strictures)',
            options: [
              { value: '0', caption: 'None' },
              { value: '1', caption: 'Single, passable' },
              { value: '2', caption: 'Multiple, passable' },
              { value: '3', caption: 'Cannot be passed' },
            ],
          },
        ],
      },
      {
        kind: 'select',
        id: 'mayo',
        label: 'Ulcerative Colitis Classification (Mayo Endoscopic Score)',
        placeholder: 'Select score...',
        options: [
          '0 — Normal or inactive disease',
          '1 — Mild: erythema, decreased vascular pattern, mild friability',
          '2 — Moderate: marked erythema, absent vascular pattern, friability, erosions',
          '3 — Severe: spontaneous bleeding, ulceration',
        ],
      },
      {
        kind: 'select',
        id: 'rutgeerts',
        label: 'Rutgeerts Score',
        note: "post-surgical Crohn's recurrence",
        placeholder: 'Select score...',
        options: [
          'i0 — No lesions',
          'i1 — Five or fewer aphthous lesions',
          'i2 — More than five aphthous lesions with normal mucosa between, or lesions confined to the anastomosis',
          'i3 — Diffuse aphthous ileitis with diffusely inflamed mucosa',
          'i4 — Diffuse inflammation with large ulcers, nodules or narrowing',
        ],
      },
      {
        kind: 'checks',
        id: 'intervention',
        label: 'Intervention',
        options: ['Cold biopsies'],
        boxed: true,
      },
      NOTES_FIELD,
    ],
  },

  {
    id: 'ulceration',
    label: 'Ulceration',
    fields: [
      { kind: 'segmented', id: 'size', label: 'Size', options: ['Small', 'Medium', 'Large'] },
      { kind: 'checks', id: 'appearance', label: 'Appearance', options: ['Shallow', 'Deep', 'Irregular'], boxed: true },
      {
        kind: 'select',
        id: 'stigmata',
        label: 'Stigmata of bleeding',
        placeholder: 'Select...',
        options: [
          'None — clean base',
          'Flat pigmented spot',
          'Adherent clot',
          'Non-bleeding visible vessel',
          'Active oozing',
          'Active spurting',
        ],
      },
      { kind: 'checks', id: 'features', label: 'Additional features', options: ['Friable', 'Exudate'], boxed: true },
      {
        kind: 'segmented',
        id: 'distribution',
        label: 'Distribution',
        options: ['Focal', 'Patchy', 'Diffuse', 'Linear'],
      },
      {
        kind: 'panel',
        label: 'Intervention',
        icon: 'stethoscope',
        groups: [
          {
            fields: [
              { kind: 'checks', id: 'intervention', label: '', options: ['Cold biopsy forceps'], boxed: true },
            ],
          },
        ],
      },
      NOTES_FIELD,
    ],
  },

  {
    id: 'vascular',
    label: 'Vascular abnormality',
    fields: [
      {
        kind: 'select',
        id: 'appearance',
        label: 'Appearance',
        placeholder: 'Select type...',
        options: [
          'Angiodysplasia',
          'Arteriovenous malformation (AVM)',
          'Telangiectasia',
          'Dieulafoy lesion',
          'Varices',
          'Radiation proctopathy',
        ],
      },
      { kind: 'number', id: 'count', label: 'Number', placeholder: 'e.g. 2', unit: 'lesions' },
      { kind: 'segmented', id: 'size', label: 'Size', options: ['Small', 'Medium', 'Large'] },
      { kind: 'segmented', id: 'features', label: 'Features', options: ['Bleeding', 'Non-bleeding'] },
      NOTES_FIELD,
    ],
  },

  {
    id: 'hemorrhoid',
    label: 'Hemorrhoid',
    fields: [
      { kind: 'segmented', id: 'type', label: 'Type', options: ['Internal', 'External', 'Mixed'] },
      { kind: 'segmented', id: 'size', label: 'Size', options: ['Small', 'Medium', 'Large'] },
      {
        kind: 'checks',
        id: 'features',
        label: 'Features',
        options: ['Bleeding', 'Prolapsed', 'Thrombosed', 'Ulcerated', 'Skin tags'],
        boxed: true,
      },
      {
        kind: 'segmented',
        id: 'visualizedBy',
        label: 'Visualized by',
        options: ['Retroflexion', 'Forward view', 'Anoscopy'],
      },
      NOTES_FIELD,
    ],
  },

  {
    id: 'normal',
    label: 'Normal',
    /* A normal segment still earns a row, because "we looked and it was
       normal" and "we never got there" are different facts and the report has
       to be able to tell them apart. A biopsy box, because normal-looking
       mucosa is biopsied routinely in a colitis surveillance case. */
    fields: [
      { kind: 'checks', id: 'biopsy', label: 'Biopsy', options: ['Cold biopsy forceps'], boxed: true },
      NOTES_FIELD,
    ],
  },

  {
    id: 'anastomosis',
    label: 'Anastomosis',
    fields: [
      {
        kind: 'select',
        id: 'surgery',
        label: 'Surgery type',
        placeholder: 'Select surgery...',
        options: [
          'Right hemicolectomy',
          'Left hemicolectomy',
          'Sigmoid colectomy',
          'Low anterior resection',
          'Ileocolic resection',
          'Total colectomy with ileorectal anastomosis',
          'Ileal pouch–anal anastomosis (IPAA)',
          'Hartmann reversal',
        ],
      },
      {
        kind: 'segmented',
        id: 'appearance',
        label: 'Appearance',
        options: ['Normal', 'Edematous', 'Erythematous', 'Friable'],
      },
      {
        kind: 'checks',
        id: 'characteristics',
        label: 'Characteristics',
        options: [
          'Staples',
          'Sutures',
          'Ulceration',
          'Stricture',
          'Bleeding',
          'Granulation tissue',
          'Polypoid tissue',
          'Dehiscence',
        ],
        boxed: true,
      },
      { kind: 'checks', id: 'biopsy', label: 'Biopsy', options: ['Cold biopsy forceps'], boxed: true },
      NOTES_FIELD,
    ],
  },

  {
    id: 'stricture',
    label: 'Stricture',
    fields: [
      {
        kind: 'segmented',
        id: 'appearance',
        label: 'Appearance',
        options: ['Simple', 'Complex', 'Ring-like', 'Fibrotic', 'Inflammatory'],
      },
      { kind: 'number', id: 'length', label: 'Length (mm)', placeholder: 'mm', unit: 'mm long' },
      { kind: 'segmented', id: 'circumferential', label: 'Circumferential', options: ['Yes', 'No'] },
      {
        kind: 'select',
        id: 'etiology',
        label: 'Etiology',
        placeholder: 'Select etiology',
        options: [
          'Anastomotic',
          "Crohn's disease",
          'Ischemic',
          'Malignant',
          'Radiation',
          'Diverticular',
          'NSAID-related',
          'Post-surgical adhesion',
          'Unknown',
        ],
      },
      { kind: 'segmented', id: 'traversed', label: 'Traversed', options: ['Yes', 'No', 'Post dilation'] },
      { kind: 'segmented', id: 'dilation', label: 'Dilation performed', options: ['Yes', 'No'] },
      { kind: 'segmented', id: 'biopsyTaken', label: 'Biopsy taken', options: ['Yes', 'No'] },
      NOTES_FIELD,
    ],
  },

  {
    id: 'other',
    label: 'Other',
    /* No structured fields of its own — if it had any it would not be
       "Other". What it keeps is the back half of the polyp's intervention
       card, because anything you find is something you might biopsy, inject
       or come to grief on. */
    fields: [
      NOTES_FIELD,
      {
        kind: 'panel',
        label: 'Intervention',
        icon: 'stethoscope',
        groups: [COLD_BIOPSY_GROUP, INJECTION_GROUP, COMPLICATION_GROUP],
      },
    ],
  },
];
