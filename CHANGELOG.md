# Changelog

## Unreleased

### The nav bar reaches the three documents

The app bar — logo, the twelve sections, clock, notifications, avatar — now
runs across the top of the clinic visit note (`screens/clinic-visit.html`),
the procedure run (`screens/encounter.html`) and the encounter summary
(`screens/encounter-summary.html`). It was the only place in the clinician
product that did not have it.

- **Why it was missing, and why that was wrong.** The three documents were
  built as rooms you step into: the back arrow is the way out, and the bar
  came off so nothing above the note competed with it. The focus was real and
  the cost was larger. A clinician who finishes a note and wants the Schedule,
  their Tasks or another patient had to press back, land on wherever they had
  come from, and find the section from there — an extra press and a screenful
  of re-orientation, every time. And a document is where most of the day is
  spent, so the one screen without the nav was the screen it was wanted from
  most.

- **The document keeps its own head.** The bar sits above `.ui-page-head`, the
  same stacking every other screen in the product uses — the back arrow and
  the encounter's name are still there, and still go back to the list this
  note came from. The bar is the way out to everything else.

- **`active="schedule"` on all three**, because that is the list all three are
  opened from and the list the back arrow returns to. A bar whose lit section
  is not the one you arrived from reads as having navigated somewhere.

- **Nothing about the layouts moved.** All three bodies were already column
  flexes at `height: 100vh` with `overflow: hidden`, and `.pt__bar` is
  `flex: none` — so the band takes its 52px out of the column and the
  independently scrolling rails, the document and the pinned footer divide
  what is left, exactly as before.

- **The scribe tab carries the bar's height.** `--scribe-fab-top` is a fixed
  offset from the top of the WINDOW, measured on windows that began with the
  screen's own header. Both screens that set it now add `3.25rem` rather than
  re-typing a number, so the tab keeps its position against the document
  instead of riding 52px up into the encounter header.

- **It does not print.** Each of the three sheets hides `.pt__bar` in its own
  `@media print`, beside whatever else it already took out. The bar is how you
  leave the document, which is not a fact about the document. It is hidden per
  screen rather than in `css/components/app-bar.css` because the bar has no one
  print behaviour: a screen that prints a LIST prints it under the bar quite
  happily, and only the screens that print a DOCUMENT want the navigation gone.

- **`clinic-visit.html` had to name two stylesheets.** It enumerates its
  components instead of loading `ui-kit.css`, so `app-bar.css` and
  `time-clock.css` are linked by hand — the same trap `toast.css` and
  `print-letterhead.css` above them were already in. The other two screens load
  `ui-kit.css` and got both for nothing.


### Every booking starts unsigned

The demo data arrived half worked through: seven notes filed as `signed` and
four waiting on a countersignature, so the Encounters queue opened as a job
somebody else had already been at. Both seeds are empty now and every booking
opens **Unsigned** — 34 awaiting signature, none signed.

- **`NOTE_REGISTER` in `data/visit-notes.js` is `{}`.** It stays as a register
  rather than being deleted: `noteFor` is written against it, and the shape is
  the documentation for seeding a state back — the comment above it keeps an
  example of each.

- **`SIGNATURES` in `data/encounter-summary.js` is empty with it.** The two are
  a pair, seeded for exactly the same bookings so that the worklist and the
  summary agree on the first paint. A summary reading "signed" for a row the
  queue filed under Unsigned would be the same bug in two places, so emptying
  one without the other is the thing that had to be avoided.

- **`NOTE_STATES` keeps `signed` and `co-sign`.** Nothing is seeded into them,
  but a note signed during a session is `signed` at runtime and the worklist
  needs its badge and its row action. Signing still moves a row across —
  Sign & Lock, or any flow that sets `noteSigned` / `encounterLocked`.

### The booking card folds, and arrives folded

Appointment Details on the procedure run (`screens/encounter.html`) is now a
disclosure, shut by default — the same shape as the alerts band directly above
it, which is the object it sits under on every step of every case.

- **Why shut.** It is reference material. The six facts are read at two moments
  — arriving at a case you did not book, and coding one you did — and on every
  other screenful they were a hundred pixels of answer to a question nobody was
  asking, between the reader and the document they came to work on.

- **Shut still says which booking this is.** The head carries the service, the
  slot and the provider, taken off the same array the body is built from so the
  two cannot come to disagree. What the press buys is the location, the note
  type, the age of the encounter and the reason — the four somebody actively
  goes looking for, which is the moment a press belongs at. The summary comes
  OFF when the card is open, unlike the alerts band's chips: open renders those
  same three values in a row forty pixels below, and a head that repeats the
  first line of its own body has stopped being a summary.

- **A press sticks for the encounter.** The state is `state.apptOpen` rather
  than something re-derived per document: the clinician who opens it is coding,
  and they want it open on all fourteen documents, not on whichever one they
  happened to press it on.

- **The `<h2>` stays, with the button inside it** — the accordion pattern. A
  heading is what a screen reader lists when somebody asks what is on the page
  and a bare button is not in that list, so the level the card had is the one
  thing about it that did not change. `aria-labelledby` points at the words
  alone, so the region is not named after its own summary and caret.

- **Shut, the band drops its hairline** and closes its radius at the bottom:
  the rule would otherwise sit one pixel above the card's own border, and two
  lines drawn in the same place read as a card that failed to paint rather than
  one that is folded. The colour goes rather than the border, so the strip does
  not jump a pixel on every press.

- **On paper it prints open**, with the caret and the summary gone. What is
  being filed is the booking; a document that files whichever half of it the
  last reader left showing is not a record of anything.

### The procedure workspace — the same grey section band the visit note wears

Every section card in the procedure run (`screens/encounter.html`) now carries
the header band the clinic visit note moved to: `--color-bg-surface-sunken`
across the top of the card, closed by a hairline, the title in
`--color-text-brand`, and the brand bar that used to sit before the title
taken off.

- **All three legends move together.** The booking card at the top
  (`.encv__appt-title`), the pre-procedure checklist's sections
  (`.encv .pck__legend`) and every section of every document the run writes
  (`.encv__doc-legend`) were already declared as one object, drawn from the
  same `--encv-section-*` properties. Restyling one of the three would have
  been exactly the drift those properties exist to prevent — a nurse works step
  1 and a physician works step 3 in the same column in the same session, and
  the cards are supposed to be the same card. With the visit note that makes
  four places in the product where a section heading now looks the same.

- **Why a band and not a title on white.** The same argument the note made, and
  one more. A title floating on the card's own white reads as the top of a card
  only while the card is four or five fields; the procedure documents carry a
  live scope feed, a specimen table with its own count chip and controls, a
  photo strip, a nine-column intra-procedure log and a findings picker, and
  against that furniture the title started reading as one more label inside
  whatever came before it. A filled band is a horizontal rule with a height, so
  it divides and labels in one stroke.

- **The two sections whose answer sits on the title's line** — "Patient
  Arrival" and "Staff Initials", which become a row rather than a stack once
  the sheet is wide enough — turn the band ninety degrees with the layout: the
  fill and the hairline move to the right edge, where the title actually meets
  its answer, and the panel stretches to the card's height.

- **The warning signs on the discharge sheet** kept their marker. It used to be
  the brand bar recoloured critical; it is now the band itself — critical ink
  on the critical surface inside the critical border the card already wore. It
  is the one band on the run that is not grey.

- **On paper the fill comes off and the hairline stays**, which is what the
  print block already did with the card's border and for the same reason: what
  is wanted printed is one document with headings in it, not eleven boxes — and
  a filled band is the first thing a practice printer drops, which would have
  left the warning signs as the one heading that came out grey. The navy goes
  back to body ink with the fill; critical ink stays.


### The visit note — grey section bands, a rich-text history, and three things a clinician can add to any note

Four changes to the clinic visit note (`screens/clinic-visit.html`), all of them
about the same problem: the note had grown past what a flat form could carry.

- **A section heading is a grey band with a navy title.** It used to be a title
  in primary ink on the card's own white, with a navy bar before it. The bar is
  gone and the band does its work instead — `--color-bg-surface-sunken` across
  the top of the card, closed by a hairline, the title in `--color-text-brand`.
  The argument is the two blocks below: a note that can carry a fourteen-row
  systems review and a figure with a legend has furniture inside its sections
  that a title floating on white stopped winning against. A filled band is a
  horizontal rule with a height, so it divides and labels at the same time. The
  navy is what keeps grey-on-grey from reading as a disabled row.

- **The history of present illness is a rich-text field.** New component,
  `<ui-richtext>` (`js/components/ui-richtext.js`, `css/components/richtext.css`):
  the same field shell as `<ui-input>` with a formatting bar across the top of
  the box — bold, italic, underline, bulleted and numbered lists, and a clear.
  It is on the HPI and nowhere else, because the HPI is the one section that is
  genuinely long and is read back under time pressure by somebody who did not
  write it. It is asked for with `rich: true` on a `type: 'textarea'` field in
  `data/visit-note-templates.js` rather than a type of its own — everything that
  decides where to PUT prose (the rail's Import, the scribe's Copy to note)
  looks for a textarea, and a new type name would have hidden the HPI from both.
  The value is HTML; the setter accepts plain text with newlines and paragraphs
  it, so `node.value = someString` stays true for every existing caller.

- **A tool row under the Plan: ROS, Annotable Image, Add Orders.** At the foot of
  the last card, because that is where a clinician is when they find the note
  needs something the template did not give them — not in a toolbar at the top,
  which asks for those decisions before any of them can be made. On the Infusion
  Visit, which ends in a next dose rather than a plan, the row moves to the last
  section instead (`isToolRowSection()`).

  - **ROS** adds a review of systems: the fourteen CMS systems
    (`data/ros.js`), each Normal / Abnormal / Not examined, with an
    "All systems negative" that fills the gaps and **overwrites nothing** — a
    clinician who has already marked a system abnormal has not changed their
    mind about it. Under a signature the form becomes prose, grouped by answer.
  - **Annotable Image** opens a marking dialog (`js/lib/body-diagram.js`,
    `data/body-maps.js`): a schematic whole-body or nine-region abdominal map,
    press to drop a numbered pin, type what it is. Pins and legend are one
    renderer shared by the dialog and the note, so the two cannot disagree about
    where mark 3 was. Marks are stored as fractions of the viewBox, which is
    what lets them carry across when the clinician switches diagram.
  - **Add Orders** moves focus to the Orders group inside the Plan rather than
    being a fourth way to raise one. The raise buttons stay beside the list they
    file into.

  Both added blocks render as ordinary section cards, spliced in immediately
  **before the Examination** (`insertPointForExtra()`) — which is where a
  systems review is asked and where a body map is read. An earlier rule put them
  after the first section holding prose; that was right for a SOAP note and put
  the ROS above the history on a GI Consultation and above the past medical
  history on a New Patient note.

- **A grey footer, and no more "sections still empty".** The hint that counted
  the unwritten sections is gone: it was never a gate, it was the widest thing
  in the footer, and it changed length on every keystroke and shoved the commit
  buttons sideways while the clinician was reaching for them. What is left is
  the signed confirmation. Both commits are grey — new `--color-neutral-*`
  semantic tokens, `[DERIVED]` from the Figma grey ramp — because the solid navy
  was the only one on the screen and it was three feet below anything being
  read. **The label still reads Save & Sign**, and the two stay told apart:
  Save & Sign keeps a fill, Save as Draft is an outline.
  `visitNoteOutstanding()` is deleted rather than left callerless.

### The encounter — the booking reads as a section card, and the Procedure step no longer carries it

`Appointment Details` on `screens/encounter.html` used to be a band of its own
at the very top of the work column: drawn on the sunken surface, bled to the
panel's own edges, labelled with an uppercase brand-blue eyebrow in a header
band. Nothing else in that column looked like that, so the first object the eye
met was the one object that matched nothing — and it sat between the reader and
the name of the document they had come to work on.

It is now the same card as every other section on the screen — white, a
brand-coloured mark at the left of a plain section title, the same 16px inset —
and it sits **below** the document's title and its toolbar rather than above
them. The measurements come from the `--encv-section-*` properties
`.encv__doc-section` and the checklist's own cards are already drawn from, so
the three cannot drift apart. It is still outside `#docBody` and still
`flex: none`, so it is painted once and stays put while the fourteen documents
scroll underneath it.

- **The Procedure step does not show it.** That step's own document opens on the
  service, the indication and the date and then asserts them again in the report
  it writes, so the card was a third copy of the same six facts on the step
  where room in the work column is scarcest. The exempt steps are
  `STEPS_WITHOUT_BOOKING` in `js/screens/encounter.js` — a Set, so the next one
  is a word rather than a rewritten condition.

- **It still prints, on every step.** The step-level hide is
  `data-off-step` + `display: none` rather than the `hidden` attribute, and
  `@media print` lifts it: a procedure report pulled out of a folder has to say
  whose booking it was. A page opened with no booking behind it is `hidden`
  outright and prints nothing, as before.

- **`paintApptDetails()` now runs from `paintWork()`** rather than once at boot,
  because which step is open is one of the things that decides whether the card
  shows at all.

- **The scribe's floating trigger no longer has a corner reserved for it.** The
  booking's header band held 5.5rem clear on its right for the purple pill; the
  button is pinned to the window's edge and the three columns stop a gutter
  short of it, so it rides the collapsed Clinical data spine and never reaches
  back over the work column at any width. `--scribe-fab-top` is unchanged.

### The visit note — the rebuild won, and took the address

The note was rebuilt at a second address while the one in use stayed where it
was: `screens/clinic-visit-v2.html` against `screens/clinic-visit.html`, with a
V1 / V2 control in the head bar carrying one reviewer between them on one case.
That is over. The rebuild won, so it took `screens/clinic-visit.html`, and
everything the fork needed has gone with it — the second page and its module,
`css/screen-clinic-visit-v2.css` (folded into `css/screen-clinic-visit.css`),
`js/screens/note-version.js`, and the note's entry in `js/lib/version-switch.js`.
The note that was being replaced is deleted.

**`js/lib/version-switch.js` and `css/components/version-switch.css` are gone
too.** The clinic note was the last pair still forked — the procedure report's
half went when its own rebuild won — so the module that carried people between
versions has nothing left to carry them between. It was declared scaffolding
with an end date at the top of its own file, and this is the end date. The next
screen that needs the arrangement can have it back out of git history, which is
a cheaper thing to keep than a module no page loads.

Nothing else moves. Every flow that opens a clinic visit — the scheduler, the
worklist, a link in a task, the redirect out of `js/screens/encounter.js` —
already pointed at `screens/clinic-visit.html` and now lands on the rebuild.
The remembered-version redirect goes with the switch, so a bare link is once
again just a link.

- **The stylesheet is one file again.** `css/screen-clinic-visit-v2.css` was an
  overlay linked after the screen's own sheet, so it is appended to the end of
  that sheet rather than merged into the sections it overrules: the cascade
  those rules were written against is "after everything above", and
  interleaving them would quietly change which declaration wins in a file this
  long. Its headings still say V2, which is now the only record of which half
  of the sheet is the rebuild.

- **The `?v=1` / `?v=2` URLs no longer mean anything.** They are ignored rather
  than honoured — there is one version. `tests/specs/visit-note-plan-orders.spec.js`
  pinned `?v=2` on every URL to stop the redirect carrying the run to V1; it
  now opens the note directly.

### The encounter's top strip is gone, and the booking band is one card

The procedure run (`screens/encounter.html`) carried a strip of four controls
between the page head and the columns — a note-type picker, a Templates menu,
an Intake jump and a running clock — and under it, a tinted band reprinting the
nurse's triage handover. Both are removed, and what the strip was worth has
moved to the clinic note, where the questions it asked are real ones.

- **No triage banner.** It said the obs were unremarkable and the medication
  list had been checked on very nearly every case it appeared on, because the
  fixture bookings carry no pass of their own and the stand-in wording was all
  there was to show. A band that is almost always skipped teaches the eye to
  skip the place a real warning lands in, and the chart's active alerts — in
  their own priority colours, directly underneath — are that place. A pass
  saved from the scheduler is still written onto the booking and still read by
  everything that reads the booking; what went was the invented one.

- **No top strip on the procedure run.** Three of its four controls had nothing
  to decide there. The note type is settled by the booking — a procedure files
  a Procedure Follow-up, and the rest of that list belongs to the clinic note —
  and it is still printed, in the booking band with the other five facts.
  Templates wrote into "the first free-text field of whatever is open", which
  across a run of fourteen documents is a different box every press. Intake
  jumped to a step that is one row away in the ladder, and its count is on the
  sheet's own footer where the work is.

- **The kind of note and the clock are on the clinic visit instead**
  (`screens/clinic-visit.html`) — on
  the note's own document bar in the centre column, where a clinic visit's note
  type genuinely is a choice and the picker was already sitting. The clock
  counts from the moment the screen opened, and says so on hover.

- **Appointment Details is one card, not a heading and a card.** The eyebrow
  used to sit on the page background with a white box beneath it, and on a white
  column that box had no edge the eye could find and no label inside it. The
  eyebrow is now the card's own header band, the card is drawn on the sunken
  surface so it reads as reference rather than as a document to work, and Reason
  For Visit is separated by a hairline because it is a clinical sentence rather
  than a sixth booking field. The scribe's floating trigger has come up to rest
  on that header band, which reserves its corner — it used to clear a strip that
  is no longer there and would have landed in the middle of the six facts.

### Signing a clinic visit closes it and goes back to the schedule

Signing the visit note used to do two things nobody asked for: it walked the
clinician off to the Encounter Summary, and it left an Unlock for Amendment on
the toolbar behind them. The summary is a reading screen for a past encounter
— it renders two of the note's sections and carries a Save button of its own —
so arriving there straight off a signature read as a second document to deal
with at the exact moment the work was finished. And the unlock offered, as the
only live control on a filed note, to undo the thing the clinician had just
deliberately done.

Both are gone. **The visit note only** (`screens/clinic-visit.html`); the
procedure run is untouched.

- **Signing lands on the schedule.** The encounter is locked at that point and
  there is nothing left to do on it, so what comes next is the next patient —
  the same place the back arrow on the note goes. The row for the visit is the
  receipt: it reads Check Out, with the note filed as signed.
- **The encounter is complete, not merely noted.** A clinic visit is one
  document, so the signature on it is the end of the visit rather than a step
  in it: the booking moves to the terminal status the procedure run also
  finishes on, alongside the `noteSigned` flag the Unsigned worklist reads.
  Reopened from the worklist, the note reads `Completed · signed by …`, locked
  field by field, with all three commits dead.
- **No Unlock for Amendment on a consultation note.** A procedure report keeps
  its own — pathology comes back days later and findings genuinely are
  corrected — but a consultation note is signed once, at the end of the visit.
  The Sign and Lock dialog no longer promises a way back either, because a
  dialog that says a signature can be withdrawn is a dialog people press
  through.

### The Plan raises its own orders and its own recall

The Plan of a clinic visit is the part of the note somebody acts on
afterwards, and until now acting on it meant leaving it. The clinician wrote
"check LFTs, book a surveillance scope, see me in six months", and then — if
the afternoon allowed — opened the chart's Orders tab and typed the lab, then
the Recalls worklist and typed the recall. Two more screens, both of them
after the patient has gone, and the decision itself living in a paragraph
nothing can query.

What that cost is already written into this prototype's own demo data: TK-4394
is a task chasing a surveillance interval because "the check-out sheet guessed
five years and nobody has confirmed it". The desk was guessing because the note
it should have been reading did not say, in any form a desk can read. The note
had the field — Follow-up interval has been a picker rather than prose since
the note was built — and nothing consumed it.

So the Plan carries both commitments as records, in place, and files them on
signature. **The visit note only** (`screens/clinic-visit.html`); the
procedure run is untouched.

- **Orders, raised without leaving the note.** `+ Lab`, `+ EGD` and
  `+ Colonoscopy` under the Plan, each opening a dialog that asks the
  practice's own questions — the same test catalogue, vendors, ICD list,
  facilities and priorities the chart's Orders tab uses, so an order raised
  here IS an order and not a note about one. EGD and colonoscopy are separate
  buttons rather than one "procedure" with a picker, because they are separate
  decisions: a clinician orders a colonoscopy, not a procedure they then have
  to specify.
- **A recall, read off the note.** The Plan's follow-up interval proposes the
  recall — what the patient is coming back for, the interval, and from those
  the due date, the provider and whether it is the clinic or the ASC. The
  note's vocabulary is translated into the practice's on the way through
  ("12 months" becomes "1 year"), because a recall recorded in the note's
  wording would not match the Recalls screen's own filters. Choosing "No
  routine follow-up — as needed" is an answer and retracts the recall rather
  than leaving one behind.
- **Nothing is filed until the note is signed.** A draft is a clinician
  thinking — it can be abandoned, re-templated, half-written for an hour — and
  raising a colonoscopy order on the button press would mean the ASC hearing
  about decisions nobody made. The signature is what turns the document into
  the record, and it is what turns these into records too. The block says so,
  under each list, rather than leaving people to find out by signing. Signing
  a second time files nothing twice: an amended note fixes a typo, it does not
  book a second scope.
- **Procedures is a section of the chart's Orders tab.** An EGD or a
  colonoscopy decided in clinic had nowhere to be filed — Labs, Imaging/X-Ray
  and Non-Visit were the only three. It wears the imaging section's shape
  exactly, because it is the same kind of thing: ordered here, done elsewhere,
  later. It is not filed UNDER Imaging, because an imaging order names a
  modality and a body part while an endoscopy names an indication and a
  sedation plan, and a Body Part field on a colonoscopy is a field nobody can
  answer honestly. Rows raised from a note carry a Raised From column naming
  it, which is the difference between an order somebody entered and an order a
  signed clinical document is standing behind.
- **Two stores, because the prototype has no backend but should still have a
  memory.** `data/recall-store.js` and `data/order-store.js`, sessionStorage-
  backed and seeded from the existing demo data, in the shape
  `data/appointment-store.js` already established. Without them a recall
  written on the note would not survive the navigation to the worklist that is
  the entire point of writing it. The order store is an overlay rather than a
  second copy of the record, so the chart's own CRUD keeps working exactly as
  it did.
- **`4 weeks` joins the recall intervals, and `Visit note — plan` joins the
  recall sources.** The first because a recall vocabulary starting at three
  months cannot carry a note that says "back in a month" without rounding it
  on the way in. The second because the desk reads that column to know how
  much to trust a row, and this one is neither pathology speaking nor somebody
  at a counter — it is the clinician's own plan, filed under their signature.


### The encounter — what the booking said, and what the nurse handed over

The encounter opened onto its documents and left four things to be found
somewhere else: who this patient is beyond a name and an MRN, what the front
desk actually booked, what the triage nurse wrote on the way in, and what kind
of note any of it was going to be filed as. All four are now on the screen,
above the work rather than inside it.

- **One patient card, drawn once.** The clinic visit's card is now the card
  every note screen shows: the photograph where the chart has one and the
  patient's initials where it has not, the name — a link to the chart, in link
  blue — with the allergy pill against the right edge, `MRN … · DOB …` and
  `age · sex` on one line under it, then Mobile, Insurance and Provider as
  labelled rows. It was picked over the other three because it is the one whose
  label column was cut so a payer's name fits beside it rather than under it.

  It lives in `js/lib/patient-card.js` and `css/components/patient-card.css`,
  and is mounted by all four screens that write or show a note: the procedure
  encounter, the clinic visit, its fork and the encounter summary. There were
  four copies, and they had drifted — three wordings of the identity line, a name that linked to the chart on one
  screen and was dead text on the others, and an insurance plan read from the
  coverage record on two screens and **typed into the markup** on the other
  two, so a clinician moving from the visit note to the summary could watch
  the patient's payer change. The screens now pass the card two things — where
  to draw and who — and it fetches the rest itself, so no screen is in a
  position to hand it the wrong payer.
- **A strip across the top.** Four controls that belong to the encounter rather
  than to whichever of its twenty documents is open: the note type this
  encounter files, a Templates picker, Intake, and a running clock. They sit
  outside the three columns, so collapsing a rail does not move them.
- **The note type is a real setting.** It opens on whatever the booking implies
  — the same derivation the worklist's Note Type column and the encounter
  summary use — and changing it writes back to the appointment, so the note
  named here is the note every other screen says this is.
- **Templates insert.** Each smart template now carries the wording it inserts
  rather than being a name with nothing behind it, and picking one drops that
  wording into the first free-text field of the open document, appending rather
  than replacing what is already typed. A document with no free-text field says
  so instead of pretending.
- **Intake carries its count.** The button jumps to the pre-procedure checklist
  and wears the number still outstanding on it — read from the same list the
  sheet's own footer gates on, so the two cannot disagree.
- **Appointment Details.** Service type, location, note type, the patient's age
  at the time of this encounter, the service date and time, the provider and
  the reason for the visit, in one band at the top of the work column. The same
  six facts in the same order as the encounter summary prints them.
- **The triage note.** The nurse's handover, in the info tint, above the alerts
  band and below the booking. It is dismissible and stays dismissed for the
  rest of the encounter, because a handover is read once and then it is in the
  way. A booking with no saved pass shows the stand-in wording described over
  `TRIAGE_HANDOVER` in `data/triage.js`.

### The procedure report — the rebuild won, and took the address

The report was rebuilt at a second address while the one in use stayed where it
was: `screens/encounter-v2.html` against `screens/encounter.html`, with a
V1 / V2 control in the head bar carrying one reviewer between them on one case.
That is over. The rebuild won, so it took `screens/encounter.html`, and
everything the fork needed has gone with it — the second page and its module,
`css/screen-encounter-v2.css` (folded into `css/screen-encounter.css`),
`js/screens/encounter-version.js`, and the encounter's entry in
`js/lib/version-switch.js`. The old three-stage report is deleted.

Nothing else moves. Every flow that opens an encounter — the scheduler, triage,
check-in, the chart, instant scheduling — already pointed at
`screens/encounter.html` and now lands on the rebuild. `js/lib/version-switch.js`
itself stays, because the clinic visit note is still forked the same way; the
procedure report's half of that scaffolding is simply what it looks like when
the arrangement ends as designed.

Everything below in this release came in with that rebuild.

- **Specimens.** A card of its own on the procedure report, directly after
  Findings, because that is the order the work happens in. Every jar carries its
  site, the finding it came off, technique, size, containers, the time it was
  labelled and its fixative. A jar links to a finding rather than being given a
  site of its own, so a pot cannot end up labelled with a segment the report does
  not describe — the argument in full is over `data/procedure-specimens.js`.
- **A jar is opened in a dialog, not typed into a row.** A jar is a commitment:
  a pot is filled, a label is printed and it leaves the room. The dialog asks
  the five questions in one place, refuses to save without the finding the jar
  came off, and hands back a complete jar or nothing at all — so a half-filled
  row can never reach a requisition. The same dialog edits a jar, because
  changing what is on a label is the same commitment again. The table is
  therefore a record to read, which is what keeps nine columns legible to
  somebody holding a scope.
- **A jar is offered where tissue was taken.** A finding recorded with forceps,
  a snare or EMR shows `+ Add biopsy` until it has a jar, then wears the jar's
  number. Pressing it opens the dialog already linked to that finding, with the
  technique and size read off it. Findings that took no tissue are not asked
  about, so the offer stays worth noticing.
- **The diagram carries the jars too.** A segment something was taken from is
  ringed, and the legend says so — the picture answers "what left the room, and
  from where" on its own.
- **Jar labels and the requisition print from those rows.** One label per
  container rather than per jar; the requisition is built from the table rather
  than typed a second time, and building it marks every jar as gone with it.
- **Opening straight onto a document.** `?step=…&doc=…` on the encounter opens
  the run on that step with that document showing, so a reviewer can be sent to
  one card rather than to a screen and a set of directions. A step or document
  the run does not have falls back to where the encounter would have opened.

### The procedure report — the live feed and image capture

The endoscopist worked two screens: the processor's monitor, where the case
happens, and the report, where it is written down. The pictures that prove a
case reached the record as a folder of files somebody uploaded afterwards,
named whatever the stack named them. The feed puts the monitor on the screen as
a window the endoscopist drags wherever they want it, and gives it a pedal.

- **A floating window, dragged and resized wherever it is wanted.** `Start
  live feed` on the Procedure sub-step opens the picture as a window over the
  report — moved by its header and resized from its corner, with a pointer or
  with the arrow keys, and remembered at both across every repaint and every
  trip to another step. It opens in the bottom-right corner, stays inside the
  viewport however the browser is resized, and the report scrolls underneath
  it rather than carrying it away. It sits below any dialog, because a
  question being asked comes first. Resizing sets the width only: the height
  follows the picture's own ratio, so a monitor cannot be dragged into a shape
  no endoscopy stack produces, and it stops at the width where the four
  controls would start wrapping over the lumen. It opens at 45rem — the size it
  kept being dragged to, which is the answer to how big a monitor should be.

  It was briefly a card inside the report, in a two-track split beside
  Findings. The pairing was right and the mechanism was wrong: a card can be
  scrolled away from while the endoscopist works further down the report, it
  exists only on the one substep that declares it, and it takes half the
  working column from the findings it is meant to sit beside.
- **Freeze, Capture, Record clip and + Biopsy, on the picture.** Capture files
  a still; Freeze stops the panel so a frame can be looked at before it is
  kept; a clip is stopped at 90 seconds and filed rather than left running.
  `+ Biopsy` opens the specimen dialog — the same one the Specimens card opens
  — with the finding being captured against already filled in, and opens it
  with no finding chosen too: which finding a jar came off is the first thing
  that dialog asks and the one thing it will not save without, so a button
  refusing first was a second guard on one rule that displaced the only one
  able to offer the findings to pick from.
- **Nothing but the picture and its controls.** The panel carried two lines of
  prose under the frame — what a read-only mirror is, and what the run was
  still waiting for. Both were true and both were permanent furniture under
  something somebody is watching. The first belongs in this changelog; the
  second is said once, when the feed opens on a case that is not ready.
- **Foot-pedal capable.** Both hands are on the scope. Space freezes and Enter
  captures from anywhere on the page — and from nowhere at all while a dialog
  is up or anything is being typed into. An endoscopy pedal presents itself as
  a keyboard, which is how the two keys become one.
- **Captures land in Procedure photos, attached — and that card moved up.** It
  now sits directly under Specimens, so the three cards worked while the scope
  is in are consecutive: what was found, what went in a pot, what was
  photographed. It had been at the foot of the report, after the impression and
  the recommendations, which was right while the only way onto it was choosing
  files off a disk at the end of the case. Each capture carries the two facts
  an upload cannot: the time, and the finding it is about. The aim follows the newest finding as the list grows and stays put
  once it is set by hand; a dashed tile at the end of the strip says where the
  next press will land. A capture taken with nothing selected is a landmark and
  says so.
- **One press opens it, and the run's state is reported rather than enforced.**
  The panel is a mirror of a monitor that is already on — the stack is switched
  on, white-balanced and focused before anybody is anaesthetised — so the feed
  opens whenever it is asked for and says on its own face when the
  pre-anaesthesia step is still unsigned, naming the documents outstanding.

  It was a lock for a version: the button refused until those signatures were
  down. The rule behind it is real, and a lock was the wrong instrument for it
  — it withheld a picture of something visibly happening three feet away, and
  it protected nothing, because the feed writes to the record only through a
  capture and a capture lands on a report whose own signature gates everything
  that matters.
- **The feed is read-only, and it is not the record.** The EHR never drives the
  scope — Freeze freezes the EHR's copy of the picture, not the stack. Nothing
  the report is waiting for is the panel's to answer, so a case can be written
  in full on a day the feed is not there. It does not print: what files is the
  report, and the report's account of the case is the captures.
- **The picture is drawn, not played.** There is no stream in a prototype with
  no server, and a video file standing in for one would be somebody else's
  patient. The lumen is an SVG that drifts, freezes and is serialised frame by
  frame into the stills — which is also why a capture is the frame that was on
  the glass rather than a re-rendering of one. The panel says so under the
  controls. See `js/lib/scope-feed.js`.

### The visit note — the AI scribe

The visit note was rebuilt at a second address on the same terms as the
procedure report, and the rebuild won: everything in this section is now simply
what `screens/clinic-visit.html` does. See "The visit note — the rebuild won,
and took the address" at the top of this release for what the fork left
behind.

- **A purple button on the document bar opens the scribe.** It listens: a
  recording bar with a timer, and the consultation appearing as transcript while
  it is spoken. Stop, and it drafts.
- **Nothing fills the note until it is copied.** The draft sits beside the note,
  section by section, each with one Copy to note. Every product that does this
  fills the form and asks the clinician to check it afterwards, which is the
  wrong way round for a document somebody signs: text already in the box has
  been accepted by default. What was not pressed is not in the note.
- **The generated note opens in the middle of the screen**, as two tabs over
  one recording: the note that was drafted, and the transcript it came from.
  Each section carries Insert to Note and Edit — the draft is corrected as a
  proposal, before it is anywhere near a document somebody signs — and the foot
  carries Import to Note for the rest. The head states when it was generated,
  how long it took, and that nothing is in the note yet.
- **The recording chrome is the component sheet's**: a white card holding the
  purple tile and the bar, the transcript under it with a T control that sizes
  the type, CC to put the transcript away while the room is still recorded, and
  Pause that rearranges the bar around a Stop rather than hiding one.
- **Every sentence can be checked against what was said.** A draft section names
  the transcript lines it was drawn from, and pressing that scrolls the
  transcript to them and marks them. A summary nobody can check is a summary
  nobody should sign.
- **Copied text is appended, never overwritten**, and the note's own section
  heading carries an "AI drafted" mark afterwards — the record should say which
  words a machine wrote and the clinician accepted.
- **Purple, on a product with no purple in it.** Every other colour on the
  screen means something clinical. Machine-written-and-not-yet-accepted is none
  of them, so it gets a hue of its own, used for nothing else, and dropped the
  moment a section is in the note.

Still to come on the note: suggested ICD-10 / CPT in the coding view, E/M from
time or complexity, follow-up and recall set at check-out, and orders raised
from the Plan.

### The AI scribe — the trigger, the transcript, and what a signature covers

- **The scribe's controls float.** They sat in the flow at the top of the note,
  which put the one control that starts listening at whatever point of a long
  report happened to be scrolled past. A scribe is reached for in the middle of
  doing something else, which is the definition of the control that floats. It
  is the same purple tile at the same 2.75rem and the same rounded square as
  every other icon button on the screen — only its position changed. (It was
  briefly a 3.5rem circle, which is what a floating action button looks like in
  a phone's design language and wrong in a dense clinical screen: half again
  the size of its neighbours, it read as an app's primary action rather than as
  one of this screen's buttons.) The moment recording starts it goes back into
  the panel's own row as the badge at the left of the bar, so the thing pressed
  is visibly the thing listening.

  It is a TAB at the top right, stuck to the window's own border with its
  right-hand corners square — there is no right-hand edge to round. The
  bottom-right corner is where this product already puts things that are
  *happening* (the live scope feed opens there, toasts land there), and the
  scribe's button is a thing to reach for, which on every screen here belongs
  along the top. The vertical offset is a variable the mounting screen sets,
  because "top" is a different pixel on every page — a hard-coded one landed
  on the encounter timer the first time a toolbar was added above it. There is
  no horizontal offset to set: the window's edge is the one position that
  needs no arithmetic and cannot be wrong.

  Both of its insets are variables the mounting screen sets, which is not
  over-generalisation: "top right" is a different pixel on every page. The
  encounter stacks two header bands and runs the collapsed Clinical data spine
  down its right edge, and a hard-coded offset landed the button on the
  encounter timer the first time a toolbar was added above it. The right inset
  now reads the rail's own width, so opening the rail moves the button rather
  than leaving it floating over the allergy list.
- **The panel is as wide as its own bar.** It was a fixed 34rem, which is a
  number somebody picked; the bar inside it is not — mic, waveform, the clock,
  Pause and CC are a fixed run of controls with a natural width, and a card
  drawn wider left the transcript hanging past its own header with a ragged
  right edge. The row decides now. A long line of transcript does not widen it
  either, so the panel does not change size as the room talks.
- **The panel unfolds out of the tab.** It opens a step in from the same edge,
  at the same height, growing from that top-right corner, so what the clinician sees
  is the thing they pressed unfolding rather than a second window arriving
  somewhere else. It stands off the border rather than welding itself to it —
  the tab is flush because a tab is part of the frame, but a shadowed card with
  its edge against the window's has nothing to cast a shadow onto, and the gap
  is what says it is on top. The animation runs exactly once: the panel is rebuilt every
  second while recording, and an animation left on the class would replay on
  each of those — which is not an animation, it is a strobe. Reduced-motion
  turns it off.
- **The recording panel floats and is dragged by its bar.** It was a card in
  the flow above the note, which put the transcript — the thing you look at
  *while* charting — above whatever you were charting, and scrolled it away the
  moment you got to work. It is fixed now, opening above the trigger it was
  started from so it appears under the hand that pressed it, and moved by its
  own recording bar. A press that lands on Pause, CC or Stop is a press, not a
  drag.
- **The transcript is bigger and properly scrollable.** The box was one
  scrolling panel with the text-size control inside it, so the control scrolled
  away exactly when there were enough lines to want it. It is a fixed frame
  now: the tools stay put and only the lines move, half again as tall as
  before. It follows the newest line — unless you have scrolled back, in which
  case it stays where you left it and starts following again when you return to
  the bottom. The reason to scroll a live transcript is to read something said
  thirty seconds ago, and a box that yanks itself down every second is a box in
  which that cannot be done.

  An Expand control that grew the box to 60vh has gone with the fixed card it
  belonged to. A panel that can be picked up and put anywhere can simply *be*
  the size it needs to be; a button that grew it was a second way of answering
  where the panel should sit, and the two could disagree.
- **Import to Report takes the whole draft and closes the dialog.** Insert to
  Note is still the per-section press for a clinician reading one paragraph at
  a time; Import is the other decision, made once, about all of it. It used to
  leave the dialog standing over the document it had just written into — which
  is the one moment anybody wants to *see* that document. Sections already
  inserted by hand are not inserted twice.
- **And the way back in says so.** Once a draft exists the floating control
  reads **View Notes** and reopens it, rather than going on offering to
  Generate. Pressing "Generate Report" and getting the report you generated
  four minutes ago is the kind of small lie that teaches people not to read
  buttons.
- **A card that took drafted text says so.** Every section the scribe filled
  wears an "AI filled" chip in its own heading, in the scribe's purple, for as
  long as the document is open — and it survives every repaint. The signature
  at the foot of the report covers every word above it, including the words a
  model wrote; the clinician consented to those in a dialog that is now closed,
  to a paragraph that from that moment looks exactly like one they typed. The
  chip is the only thing left that can tell them apart, and it is the thing a
  reader six months later has no other way of recovering. It is provenance, not
  a warning, and it is drawn quietly so that nobody learns to clear it rather
  than notice it.

### The procedure report — completing the record

Three gaps with the same shape: a fact the room knew, that the report could not
state.

- **Withdrawal time, alongside insertion and caecum-reached.** A new Timings
  card derives all three intervals from the marks the circulating nurse
  recorded live on Intra-procedure Management — nothing is asked for twice, and
  nothing is reconstructed from memory at the end of the case. Withdrawal is
  drawn as the number the card exists for, and flagged when it falls under the
  six-minute standard, with a sentence saying why a short withdrawal is often
  the right answer. "Scope in 08:06, scope out 08:26" has the number in it and
  does not state it: twenty minutes in the room is a four-minute withdrawal
  after a hard insertion or a fourteen-minute one, and only one of those meets
  the standard every unit audits. An interval whose marks are not both recorded
  reads "—" and says which mark is missing — a withdrawal time derived from a
  missing caecal time is the total procedure time wearing a quality metric's
  name, reading high. See `data/procedure-timings.js`.
- **The physical scope, by serial — not the kind of scope.** A new Instrument
  card names which instrument went in, chosen from the unit's register, and
  reads back its serial, asset tag and the reprocessing cycle it came off. The
  booking said "Olympus colonoscope" and the feed header said "CF-HQ190L";
  both are types, and the question an endoscopy unit is actually asked is
  always about one object — which scope was in this patient, and was it
  reprocessed first. Nothing is retyped, because a serial copied off a sticker
  is a digit wrong in the one record that is only read when a wrong digit
  matters. A scope outside its hang-time window is flagged and recorded anyway:
  it is in the patient by the time anyone reads the card, and a screen that
  declined to record that would leave the unit with no record of the thing it
  most needs to investigate. Hang time is measured to the case's own scope-in
  time, not to the wall clock. See `data/procedure-scopes.js`.
- **Structured findings rendered into a narrative note.** A generated,
  read-only note above the Impression, assembled from everything recorded on
  the report: what was done and with which instrument, the indication and its
  codes, preparation and extent, the timings, every finding as a sentence, the
  jars, the course and the image count. It rewrites itself as the record
  changes and can be copied into a letter. It is read-only for the reason the
  findings diagram exists: record the anatomy, and the prose writes itself — an
  editable copy of a generated note is two accounts of one case with nothing to
  say which is right. The Impression stays the endoscopist's own words, because
  judgement is the one thing no structure implies. Nothing is written round: a
  case with no caecal time gets no withdrawal sentence, and says so. See
  `js/lib/procedure-narrative.js`, which is now the one narrator — the
  finding sentences the report's own `findings` field holds come from the same
  place, so a polyp cannot be described two ways on one page.

## 0.1.0 — 2026-09-18

- White-label fork: rebranded to MediNova, blue primary palette, new placeholder logo.
