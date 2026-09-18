# Patient portal — `/patient/`

A clickable prototype of the MediNova Clinic patient portal, built from the supplied
design screenshots.

    http://127.0.0.1:4173/patient/

Press **Log In** with both fields empty to enter as the demo patient, or use
`henna.west@example.com` / `Portal!2026`.

## It is standalone, on purpose

This directory shares **nothing** with the EHR prototype in `/screens`, `/css`
and `/js`. Its own reset, its own tokens, its own components, its own icon
sprite, its own `file://` guard. Two consequences worth knowing:

- Changes to the EHR's `tokens.css` or its `ui-*` components do not reach the
  portal, and portal work cannot regress the EHR.
- There are two design systems to maintain if the two products are ever meant
  to look related.

The separation that matters most is the **session**. This app authenticates
against `js/lib/auth-store.js`, which stores under `medinova.patient.auth.v1`;
the EHR uses `medinova.auth.v1`. A clinician signed into the EHR has no session
here, and a patient signed in here can reach no EHR screen.
`tests/specs/patient-portal.spec.js` holds that in place — the `session
separation` block is the one to keep green.

## Layout

```
patient/
  index.html            /patient/            → redirects to login
  login.html                                   the patient door
  forgot-password.html                       ⚠ not in the design
  home.html                                    the dashboard — titled "Dashboard"
                                               greeting, the next appointment
                                                 across the well, then
                                                 medications and paperwork
  dashboard.html                             → redirects to home.html
  appointment.html                             upcoming rail + past table
                                               ?tab=past scrolls to the table
  visit-summary.html                           ?appointment=<id> — one past visit
  health-medications.html                      HEALTH RECORDS — read-only tables
                                               ?tab=past | allergies
                                               two records on top; Current / Past
                                                 nested inside Medications
                                               + Download, scoped to the record
                                                 on screen (css/print.css)
  allergies.html                             → redirects to ?tab=allergies
  forms.html                                 ⚠ not in the design
                                               FORMS & CONSENTS — two tabs
                                               ?tab=consents          the second tab
                                               ?form=<id>            fill or read back
                                               ?form=<id>&version=<n> one version
                                               ?form=<id>&amend=1     correct it
                                               ?highlight=<id>        deep link
                                               + the Withdraw Consent dialog
  notifications.html                         ⚠ not in the design, off the nav
  documents.html                               + the Upload Document dialog
  messages.html                                ?thread=<id> opens one thread
  billing-statements.html
  billing-payment-history.html
  profile.html                                 + Change Password and Edit Profile
  profile-insurance.html                       the second Profile tab
                                               + the card slots, read-only,
                                                 and the Add / Edit drawer
  profile-cards.html                           the third Profile tab
                                               + the Add Card dialog
  health-reports.html                        ⚠ not in the design, off the nav
                                               ?report=<id> deep link + filter bar
  placeholder.html                           ⚠ the honest dead end
  assets/  medinova-logo.svg
  css/     reset, tokens, base, components, shell, print, screen-*
  js/
    guard.js            classic, runs in <head>, blocks paint when signed out
    open-me-properly.js classic, explains a file:// open
    lib/                auth-store, shell, icons, toast, format,
                        dates, billing-tabs, profile-tabs, meds-tabs,
                        allergy-panel, card-scans, signature-pad,
                        notifications-panel, report-search, med-print,
                        form-print
    screens/            one module per screen
  data/                 fixture data, one module per domain
```

Every screen's HTML holds the frame — `#topbar`, `#sidenav`, `.pp-content` —
and `lib/shell.js` fills it from one nav definition. The breadcrumb strip is
gone; see the header of `lib/shell.js`.

## What persists

Almost nothing does, on purpose: the fixtures are mutable in memory and reset
on reload, so a reviewer always starts from the drawn state. Three things
cannot work that way and are in `localStorage`, each with a note in its module
explaining why:

| Key | Written by | Why it has to survive a reload |
| --- | --- | --- |
| `medinova.patient.forms.v1` | `data/form-store.js` | A draft that does not survive a reload is not a draft, "version 1, superseded" is a claim about the past, and a withdrawn consent that comes back as given on refresh is the opposite of a record. |
| `medinova.patient.cards.v1` | `data/insurance-cards.js` | Photographing a card is a thing you do once, from a phone. ⚠ It holds a member ID — see the header. |
| `medinova.patient.notifications.v1` | `data/notifications.js` | Marking one read has to survive the navigation it causes. |

Clear any of them to get the seeded state back.

## What was added beyond the screenshots, and why

| Added | Reason |
| --- | --- |
| `forgot-password.html` | The login screen links to it. A dead link on the one screen every patient sees is worse than a page built to the same layout. |
| `visit-summary.html` | Where "View Visit Summary" on a past appointment lands. The design draws past visits as rows with nothing to open; a patient's commonest question about a visit they attended is "what did they say I should do", and the answer was nowhere in the portal. **It is not the clinician's note** — see below. |
| `forms.html` and a **Forms** nav row | The design names an "Intake Form" on Home and on every appointment card, and both linked to Documents — a table of paperwork already filed, with nothing on it to fill in. This is where they land now: what the practice is waiting on, and the paperwork itself. The fields are the practice's own — see below. |
| The **Forms / Consents** tab strip, and **Pending / Completed** inside it | ⚠ **Shape borrowed from the supplied "Forms & Documents" screen; none of its content.** That screen is a tab strip over one page with a pending table and a completed one, and that split is what is taken, with the same columns. Nothing on it is: not its rows, not its form names, not its wording. The second tab is **Consents** rather than Documents, because Documents is already its own screen — and because a consent ends differently from a form. The two tables are the two positions of a sub-tab rather than a stack down one page, which is how Health Records draws Current / Past medications: pending and completed are one list split by state, and a patient reading what they still owe should not have to scroll past it to reach what they have already dealt with. See below. |
| `health-medications.html`, `health-reports.html` | Medications is a top-level nav item and where Home's Current Medication card links. Reports is off both: the dashboard card that used to lead there is Forms & Consents now, so a result is reached by the top-bar search, by the notification that announces it, or from the foot of a visit summary — the places a patient looking for a particular result actually starts. |
| Self-reported medications | The design's medication list is prescriptions only. A gastroenterology practice needs to know about the fish oil and the ibuprofen before a procedure, and a list built from prescriptions can never contain them — so the record carries them with a `Source` badge saying which rows those are. The patient does not type them here; how they get in is an open question, below. |
| A pharmacy on each medication | The design has no pharmacy anywhere. "Where do I pick this up" is a question the medication list invites and could not answer, and the answer differs per row — a ninety-day maintenance box and a five-day antibiotic routinely come from two different counters. It is a field on the row, not a screen. |
| `placeholder.html` | Notification Setting is named in the nav but never drawn. |
| The cancellation fee warning | The design's Cancel Appointment button has nothing behind it. Cancelling late is the one thing a patient can do in this portal that costs them money, and finding out about it on a statement three weeks later is the worst possible way to learn. See below. |
| The dashboard's greeting | The reference draws a greeting, a balance panel with a Pay Bill button, a row of "needs your attention" tiles and a message digest. Only the greeting is built, and its sentence is derived rather than drawn — it counts the real fixtures at paint time, so it cannot claim work that is not there. The other three bands are gone: every errand they carried has a screen of its own in the nav (Billing, Forms, Notifications, Messages), and four bands of summonses pushed the record itself below the fold. Messages returned as a card in the dashboard grid — a short list of threads with "More ↗" on it, sitting beside Upcoming Appointment over Current Medication and Forms & Consents, two by two. The fourth card lists paperwork rather than lab reports: the dashboard is read to find out what is being asked of you, a result is something you go looking for, and a form with a due date on it is the only thing on the screen nothing else would mention. Its rows are the only ones in the grid with a control on them — the Forms screen's own Start Form / Review & Consent / Continue button, opening that form rather than the list, because a row there is a job rather than a fact. |
| One appointment dated 18 hours out | Every appointment the screenshots supply is weeks or months away, so the fee could never apply to any of them and the warning would be unreachable in review. `appt-soon` in `data/appointments.js` sits inside the notice window whenever the prototype is opened. It is the first thing to delete once the fixtures carry real dates. |

## What is deliberately NOT built as drawn

Each of these is commented at the point it occurs.

- **Photographs.** Provider portraits, patient avatars, insurance card scans
  and the sign-in carousel are drawn as sized, labelled slots — initials on a
  tint, a dashed ID-1 card frame, a gradient panel. Generated stand-ins look
  finished, and finished placeholders never get replaced.
- **The colour.** The screenshots are drawn in blue with a saturated blue top
  bar. The portal is branded to the practice instead: primary `#097000`, the
  supplied MediNova Clinic logo, and a warm stone top bar. The bar had to go
  neutral — the logo is near-black linework on a `#d2d0c9` mark and vanishes
  on a saturated ground of any hue. The blue survives only as the `info`
  status family, which keeps the schedule chips distinct from the brand.
- **The Visa mark.** `.pp-brandmark` is a neutral plate with the brand name
  set in it, not the registered logo.
- **`--pp-grey-500`.** The design's secondary grey (`#6b7683`) fails WCAG AA
  on the sidebar, the breadcrumb bar and the chat bubbles — three of the four
  places the portal actually uses it. Darkened to `#59626d`.
- **Red.** Split into a text step and a solid step for the same reason.
- **No pager on any billing tab.** The design draws a ten-page control under
  each of the three tables, over five rows. Five rows are the whole list — the
  pages behind the control were filler generated to give it something to do,
  and both are gone. Paging comes back when there is history to page through.
- **Add Card rides the tab strip, and it opens a dialog.** The button sat in a
  row of its own between the tabs and the table, aligned with neither, and it
  raised a toast saying what it would do. It is at the right end of the tab bar
  now, the way Profile's other buttons already were, and it opens the Add Card
  popup — which keeps the brand and the last four of what is typed and drops
  the rest. `data/billing.js` has no parameter a whole card number could be
  passed through, and the CVV is never stored at all.
- **Billing is tabs, not a dropdown.** The design puts Statements, Payment
  History, Cards and Insurance under a Billing chevron in the sidebar. They
  are tabs across the top of one Billing screen instead: a patient moves
  between them constantly — pay a statement, check it cleared, fix the card
  that declined — and the dropdown made each of those moves three clicks.
- **Insurance and Cards are Profile tabs, not Billing ones.** A policy is a
  fact about the patient: asked for at registration beside the address and the
  emergency contact, checked when it expires rather than when a statement
  arrives, and collected by the Add Insurance drawer in the same fields the
  front desk uses at intake. A saved card turned out to be the same kind of
  thing — something kept on file, sitting beside the policy that pays with it,
  and not an event in the account. So Billing is the two tabs about money that
  actually moved, and Profile is the three about the record. Both addresses
  moved with them: `profile-insurance.html` and `profile-cards.html`.
- **The card slots on the Insurance tab are read-only.** They carried Upload
  file, Take photo, Replace and Remove as well, so one policy had two places
  it could be changed — the drawer for its numbers, four buttons under the
  cards for its images — and a tab that only shows what is on file read as a
  form. Everything about a policy is edited in the one drawer named for
  editing it; the tab shows the cards and says where to change them. Both
  modes are the same component, `lib/card-scans.js`, so the frame and the
  ID-1 card shape cannot drift apart.
- **Allergies is cards, and it is read-only.** The supplied shot draws an
  eight-column table with a pencil on every row and an Add dialog behind it.
  Two departures. The table needed a 62rem floor and a sideways scrollbar to
  say what is really one heading and four facts, so it is a card: allergen and
  severity on top — the two things anyone opens the screen for — with who
  recorded it and when underneath. And the pencil and the dialog are gone,
  because an allergy list is read by whoever is about to prescribe or
  anaesthetise, and a severity a patient can quietly move from Severe to Mild
  is exactly the edit a chart must not accept. The reasoning in full is at the
  top of `js/lib/allergy-panel.js`. Everything the table said, the card still
  says, plus the note the old dialog collected and the table had no column
  for. Dates are `MM/DD/YYYY` like every other portal fixture rather than the
  shot's `DD-MM-YYYY`.
- **Allergies has no back arrow.** The supplied shot draws "← Allergies" above
  the table, which is how it was reached from wherever it was drawn. Here it
  is a tab of a top-level nav row: the sidebar and the tab strip both say
  where you are, and a back arrow on a section has nowhere to go.
- **Settings is Profile.** The section held Profile Setting and a Notification
  Setting that was never drawn, which made it a chevron over one real screen.
  It is one nav row named for what it holds, with Profile, Insurance and Card
  Details as its tabs — Password was a third, over a panel holding a row of asterisks and the
  button that leaves it, so the button moved to Profile beside Edit Profile
  and the tab went. `placeholder.html?section=Notification%20Setting`
  still answers — an old link should explain itself rather than 404 — it is
  simply no longer advertised. **No section in the nav is a group any more**;
  `renderGroup()` stays in `lib/shell.js` because the nav is a data structure
  and a sub-list is one line of data away.
- **No Education Material.** The design names it in the nav; no screen for it
  was ever supplied, so the row only ever led to `placeholder.html`. Removed
  rather than left advertising a section the portal does not have.
- **No booking from the portal.** The Appointment screen reads and changes
  what exists — reschedule, cancel, intake — but does not create. Appointments
  are made by the practice.
- **Appointment is a rail of cards over a table of rows.** Upcoming and Past
  were drawn side by side, which gave each list half a card's width and four
  rows of height. They were then two tabs, which gave each the whole screen at
  the price of a click. This is the third arrangement and the first that suits
  the two lists rather than treating them as one list drawn twice. An upcoming
  visit is a card — when, who, where, why, and four things you can do about it
  — so it gets card width and a horizontal rail with a button at each end when
  there are more than the well can show. A past visit is a log entry, and the
  question asked of a log is "when did I last see somebody about this", which
  is a scan down a column: Date, Time, Provider, Visit Mode, Visit Type,
  Reason For Visit, Status, and the one action a past visit has at the end of
  its row. **Cancel is only ever on a card**, which is what stops "Cancel
  Appointment" appearing beside a visit that happened last month.
  `appointment.html?tab=past` still works — Visit Summary links back to it —
  and now scrolls the table into view rather than 404-ing the idea of a tab.
  ⚠ **`specialty` and `reason` are not from the screenshots.** The card and
  the table both name them, because a patient tells six past visits apart by
  why they went; the fixtures carry plausible values for the practice to
  replace.
- **Cancelling costs money, so it asks first — and says how much.** Cancel
  Appointment opens a confirmation rather than firing a toast, and the
  confirmation is not the same sentence twice. Inside the practice's notice
  window it names the fee, the hours left and where the charge will appear;
  outside it, it says there is nothing to pay and prints the exact date and
  time that stops being true. The **no-show fee is stated in both**, because
  it is the one charge a patient can incur by doing nothing at all, and the
  moment they are thinking about not attending is when it needs saying. The
  confirm button carries the price — `Cancel and Accept $50 Fee` — since
  "Confirm" beside a warning you have already scrolled past is how a fee gets
  agreed to unread. Both free ways out are offered next to it: rescheduling is
  free at any time, and so is the phone.
  `CANCELLATION_POLICY` in `data/appointments.js` holds the window and both
  amounts. ⚠ **The figures are placeholders** — the practice's real notice
  period and real fees have not been supplied.
- **Confirming really cancels, and it survives the tab.** The visit leaves
  the rail and appears in the past table as `Cancelled`. Held in
  `sessionStorage`, which is neither of the two obvious answers: in memory
  alone is not enough, because a patient who cancels, opens a visit summary
  and comes back has crossed two full page loads — the screen would say
  "cancelled" and then show the visit as upcoming again. `localStorage` is too
  much, for the reason `data/documents.js` gives about uploads. The state ends
  with the browser tab. **No billing row is created**: `data/billing.js` is the
  practice's statement fixture, and inventing a $50 line in it would be this
  screen asserting something about a system it does not own.
- **A visit summary is not a clinician's note.** `visit-summary.html` renders
  `data/visit-summaries.js`, which holds authored patient-facing documents:
  what happened, the plan, the instructions, the medications started and
  stopped, and what comes next. There is deliberately no field on those
  objects a chart note could be poured into, and the page tells the patient in
  as many words that the full record is a phone call away. The medication
  changes agree with `data/health.js` — Pantoprazole and Famotidine are the
  same two rows the Medications screen shows — because both were written to
  say the same thing, not because one is computed from the other.
- **Medications is two nested strips over one table.** The design shows a
  single flat list of current prescriptions. The screen splits it on the two
  axes a patient actually asks about, and each axis gets the shape that fits
  it. **State** is the sub-tabs — Current and Past, at `?tab=past` — because
  "what am I on now" is the question the screen is opened with, and the
  history belongs one click away rather than mixed into the answer.
  **Source** is a badge in a column, green `Prescribed` against purple
  `Self-reported`, because it is a property of a row and not a place to file
  one: a clinician reading this before a procedure needs "what is this person
  taking" in one list, not two to cross-reference. `data/health.js` carries
  `ended` rather than a status string, so a row cannot claim to be current and
  hold a stop date at once. Home's card is the same mixed list, current only,
  carrying the same `Self-reported` chip.
- **Tabs and sub-tabs, not four tabs in a row.** Medications and Allergies on
  top; Current and Past nested inside Medications. They were four tabs in a
  row — Current, Past, Allergies, Pharmacy — and read left to right that strip
  said the four were peers. They are not: Current and Past are one list split
  by time, the same fields with the same medication moving between them, while
  Allergies is a different record entirely. The nesting is the fact, and the
  sub-tabs are a different *shape* — a white pill on a sunk track — and they
  sit *inside* the panel, above the column headings, so the edge of the table
  closes around the switch and the rows it acts on. The record tabs stay
  outside it, which is the difference between the two levels drawn rather than
  explained.
- **The section is called Health Records.** It was "Medications & Allergies",
  which lists the contents rather than naming the section, and a name made of
  its contents has to be rewritten every time the screen grows. Health Records
  is the clinical record the practice holds, as against Documents (filed),
  Forms (owed) and Billing (money). The tabs inside still say Medications and
  Allergies, so the shorter name hides nothing.
- **Pharmacy stopped being a tab.** It held the patient's pharmacies and
  answered "where do you collect prescriptions" — a question nobody opens this
  screen asking. The one they do ask is "this medication, where do I pick it
  up", which is a property of the medication. It is a column on each row now,
  and `data/pharmacies.js` and its panel are gone.
- **Tables, not cards.** Both records were drawn as cards for a while, on the
  argument that a medication is one heading and half a dozen facts. What that
  cost is the reason anyone opens the screen: both lists are read *down* a
  column — "is anything here severe", "which of these is from the mail
  pharmacy", "when did the prednisone stop" — and a grid of cards has no
  column to run an eye down. So both are `.pp-table` inside `.pp-table-wrap`,
  the portal's own table, which scrolls sideways rather than dropping a column
  a reader could be wrong without. Past carries three columns Current does not
  (stopped when, why, by whom) and Current simply does not draw them. The one
  fact with no column is the patient's own note — blank on most rows, so it
  sits under the name in the first cell.
- **Nothing on the screen writes.** There was an Add Medication dialog, a Stop
  dialog, Resume, Remove, and an Add / Edit Allergy dialog, all restricted to
  the patient's own rows and enforced in the data modules rather than by which
  buttons got drawn. All of it is gone, and `data/health.js` and
  `data/allergies.js` export no mutators to reach for.

  The argument for the controls was that a patient takes things the practice
  never prescribed and a list built from prescriptions can never contain them.
  That is still true; what it does not establish is that the portal is where
  the patient should type them. Both lists are read in the one situation where
  being wrong is expensive — by whoever is about to prescribe or anaesthetise
  — and a row a patient typed carries the same visual weight as one a
  prescriber wrote. A badge saying which is which helps a careful reader and
  does nothing for a hurried one. So the portal shows the record and the
  patient amends it by telling the practice. Slower, and the correct channel.
  The reasoning in full is at the top of `js/screens/health-medications.js`.
- **The Forms fields are the chart's, transcribed.** `data/forms.js` carries
  the Patient Interview Form and the Release of Information with the same
  field keys and the same option lists the EHR's own `data/forms.js` collects
  — because a form filled in at home has to land in the chart in the shape a
  clinician reads. Two differences, both about audience: the labels are in the
  second person ("I have no known drug allergies", not "Patient has…"), and
  `reviewedWith` loses its "Not Present" option, which cannot be true of
  someone signed into their own portal. The portal keeps its own copy rather
  than importing the EHR's, for the standalone rule above; in a real build
  both sides read one schema from the server. **If a key here drifts from the
  chart's, the answer lands nowhere** — that is the thing to keep in step.
- **A form the portal cannot open gets no button.** Two of the four assigned
  forms are consents signed on paper; the portal has no schema for them, so
  they offer "Request a copy" instead of a Start that would open a page it
  cannot draw.
- **Forms and consents are two tabs, and the split is not cosmetic.** A form
  is answers — you complete it, and if you got something wrong you **correct**
  it, which files a new version and keeps the old one. A consent is permission
  — you give it, and the only thing left to do with it is **withdraw** it. One
  mixed list has to put a Withdraw button beside a questionnaire and a Correct
  button beside a permission, and neither means anything. `kind` in
  `data/forms.js` decides which tab a row lands on, and the header there
  carries the rule: the Notice of Privacy Practices and the Advance Directive
  are **forms** despite reading like consents, because one records that a
  document was received and the other records whether a living will exists.
  Neither is a permission, so there is nothing in either to take back.
- **Withdrawing a consent deletes nothing.** The row returns to *Awaiting your
  decision* carrying the date it was withdrawn; the signed version it withdrew
  stays viewable and printable from the card, and the printed sheet says on
  its face that it no longer applies. The patient did give that consent and the
  practice did act on it — a withdrawal that erased the record would leave
  nothing to explain what happened between the two dates. Giving it again
  starts from a **blank** form rather than the answers that were taken back,
  and files a new version like any other. `revocations` in
  `data/form-store.js` is what survives the reload.
- **It asks before it withdraws, and says what stops.** The dialog names the
  consent, states in that consent's own terms what the practice stops doing —
  records stop being released, texts stop being sent — and offers an
  **optional** reason. Nobody has to justify taking back a permission; the
  practice is simply better placed to fix whatever prompted it if it is told.
  ⚠ **The "what stops" sentences are written for this prototype** and are the
  practice's to replace: `stops()` in `js/screens/forms.js`.
- **One nav row, not two, and one word on it.** Forms and consents arrive
  together and are chased together, and the question a patient opens either
  with — "what does the practice still need from me" — has one number for an
  answer. That number is the nav tag, and it counts only what is genuinely to
  do: a consent the patient deliberately withdrew is outstanding in the list,
  where the table it sits in explains itself, but it is not a chore, and the
  nav has no room to say so. The row is labelled **Forms** — the name the
  screen goes by on Home's card, on the appointment card and in the
  notification that links to it. "Forms & Consents" was the only nav label
  joining two nouns, the widest row in the column, and the first to wrap when
  the bar narrowed; the consents are a tab inside the screen, which is where
  the row leads either way.
- **Chat is Messages.** The nav row, the page, the address and the "New
  Message" button. The threads are days apart and carry lab figures and prep
  instructions; none of that is a chat, and Home's card was already headed
  Messages, so the portal had two names for one screen. The old
  `chat.html` address is gone rather than redirected — nothing outside this
  prototype links to it.
- **Insurance breadcrumb.** The design reads "Billing / Statements" on the
  Insurance screen. Built as "Billing / Insurance".
- **Messages follows the later chat reference.** The screen was first built
  from a design that put the care team on the right in blue and the patient on
  the left — the inverse of the convention, on the patient's own portal. The
  chat reference supplied since draws it the usual way round, and the screen
  now does: the patient's messages on the right in the brand tint
  (`--pp-brand-100`, which tokens.css already named "outgoing bubble" — the
  solid #097000 the reference's blue would map to is a dark, saturated block
  to read six of), the care team's on the left in white under the sender's
  name, and the gap between bubbles opening only where the speaker changes. The same
  reference brought the rest of the band with it — the conversation list in
  its own card, a head naming who is being written to, the transcript inset on
  a sunk field, and a labelled Send beside the composer.
- **No Individual / Groups pair.** The reference splits the list in two above
  the panes. The portal's nine threads are a handful of conversations, not a
  directory: the split would have hidden half of them behind a control to save
  no scrolling at all. One list, groups and one-to-one together, narrowed by
  search.
- **The conversation row carries what the reference draws, and no more.** The
  reference's row is four fields — avatar, name, day, one clamped line of
  preview — with the unread count on the right. An earlier cut also hung a red
  urgency bell on the row and a head count under the group names; two extra
  markers over a 13px preview line made the list the busiest thing on a screen
  whose subject is the open conversation. Both are gone, and the row takes the
  16px of height the reference gives it. The Urgent / Unread chips under the
  search field stay: they narrow the list rather than decorate a row.
- **The thread head is the portrait and the name.** It briefly carried a
  speciality badge, an Urgent badge, a phone number and an email address —
  four fields, none of them in a supplied screenshot, over a patient who chose
  that row from the list a moment ago and knows who they are writing to. A
  group keeps one line under the name, saying how many people can read the
  reply, which is a question worth answering before typing into a thread of
  fourteen. Urgency now shows only in the transcript, on the messages that
  carry it.

## Open questions for the designer

- **One reaction per allergy.** Two of the three rows carry what reads as two
  reactions ("Nausea, dizziness") in a record whose supplied dialog drew a
  single "Select Reaction". Held as one compound string, which is what the
  design settled. If a reaction is really a list, the field is an array and
  the card prints them as one.
- **How a patient reports what they take.** The self-reported rows in
  `data/health.js` are seeded — the patient can read them and no longer add
  one. Something has to fill that gap in a real build, and Messages is the
  obvious candidate rather than a form that writes to the chart. Nothing here
  should be read as a decision about which.
- **Who writes the visit summaries, and when.** The two in the prototype are
  authored prose with a named author and a published date. A real portal has
  to decide whether that is the clinician, a scribe or a template filled from
  the note — and what a patient sees between the visit and the summary being
  published. The Past card says "not published yet" for a completed visit with
  no summary, which is a guess at the answer.
- **The full SSN** is printed on Profile Setting. Real portals show the last
  four behind a reveal.
- **What are the real cancellation figures?** The 24-hour window, the $50 late
  cancel and the $75 no-show are invented. They are together in
  `CANCELLATION_POLICY` so replacing them is one edit — but the practice has to
  supply them, and whether the window is measured in hours or business days
  changes the sentence as well as the number.
- **Does anything waive the fee?** Illness, a hospital admission, a first
  offence, a visit the practice itself moved. Every real policy has exceptions
  and the dialog currently states the rule as absolute, which will be wrong for
  some patient on their worst week. The nearest safe answer is already on the
  screen — the phone number — but "call us and we may waive it" is a promise
  the practice has to be willing to make before it is printed.
- **Nobody is told.** Confirming moves the visit to Past and says the fee is
  coming. In a real build that is a message to the practice, a released slot,
  possibly a waitlist offer and a charge. None of those exist here, and the
  toast is careful not to claim they do.
- **Two Payment History rows** pair a success note with a `Failed` status.
- **Whether a patient can be trusted to edit their own list** is the call this
  screen turns on, and it went the other way once. Both readings are
  defensible: a chart that will not accept "I stopped taking that in March"
  from the person who stopped taking it is a chart that goes stale, and a
  chart that accepts a severity downgrade from an anxious patient is a chart
  that gets somebody hurt. The prototype now shows and does not write. A real
  build probably wants a third answer — the patient proposes, the practice
  confirms — and that is a workflow, not a button.
- **Download takes one panel, not the lot.** The button used to print all four
  tabs into one document, on the reasoning that a list a patient carries to
  another clinician has to hold everything. That is one reason to download and
  it was the only one on offer: a patient asked for their allergies on a form
  got their whole drug history with them. It now takes what is on screen, and
  its label says which — "Download current medications" becomes "Download
  allergies" when the tab does. The sheet still carries name, date of birth,
  MRN and a generation stamp either way; a loose page with a clinical list on
  it and no way to tell whose it is is a hazard, not a document.
- **Nothing reconciles the two sources.** A patient can add "Omeprazole" by
  hand while the practice already has it prescribed, and the tab will show two
  rows with the same name and different badges. Deduplicating is a clinical
  judgement — the same drug at a different dose from another practice is a
  real and separate entry — so the prototype does not guess.
- **The insurance expiry** is `March 13, 2024` — two years past. Expired cover
  probably deserves a flag rather than a plain field.
- **Home and Appointment disagree on dates.** Home draws 21 FEB; Appointment
  draws September 2026, newest-first. See the note in `data/appointments.js`.
- **The screenshots' product name** is `CustomEMR` on the login screen and
  `CustomEHR` on the other eleven. Superseded — the portal is branded MediNova
  Clinic throughout, from the supplied logo.

## Tests

```
npx playwright test tests/specs/patient-portal.spec.js
```

97 tests: sign-in and its failure states, session separation from the EHR,
the shell, every screen, and a WCAG 2.1 A/AA sweep of fifteen views plus the
cancellation dialog. Six to keep an eye on:

- `visit summary › the page tells the patient it is not the full record` —
  it guards the promise that screen is built around.
- `cancelling an appointment › the no-show fee is stated in both branches` —
  the no-show charge is the one a patient incurs by doing nothing, so it is
  the one most easily dropped from the half of the dialog where cancelling
  happens to be free.
- `health records › nothing on the screen writes` — it sweeps all
  three panels for an Add button, a Stop / Resume / Remove button, a `<dialog>`
  and an edit pencil. Each was a real control once, and each is a separate way
  for one to come back on the panel nobody re-checked.
- `health records › the downloaded sheet holds that record and no other` — it
  asserts the allergy sheet does NOT contain a medication, and that the
  medication sheet holds both the current list and the past one. The scoping
  is the whole change, and a regression in either direction — "print
  everything" or back to one panel per press — would otherwise look like a
  passing test with more or less content on the page.
- `forms › the form asks what the chart asks` — it spot-checks field keys and
  options from either end of the schema, so a portal-side rewrite that quietly
  invents its own questions fails here rather than in a clinic.
- `health records › two records on top, current and past inside medications` — it asserts there are exactly two top-level tabs. Four in a
  row is what the strip used to be, and the count is the cheapest guard
  against it flattening back.
