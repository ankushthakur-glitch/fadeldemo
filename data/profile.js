/**
 * DEMO DATA for Profile (module id "profile") — everything collected on the
 * Patient Info tab of Add Patient (screens/patient-add.html#panel-patient)
 * that is not already on the chart header or elsewhere in the shell.
 *
 * Facts the header already carries — name, preferred name, DOB, gender,
 * language, phone, email, address, record status — are read from
 * data/patient-chart.js (patient.*) rather than duplicated here, the same
 * rule Profile · Clinical follows for alerts. This file is only the
 * REGISTRATION detail Add Patient collects that the header has nowhere to
 * put: identity fields, demographics, information sharing, and the two
 * sub-record lists (providers, pharmacies).
 *
 * Insurance, Guarantor and Billing are NOT here — they onboard on their own
 * tabs and already have their own home in this chart (Profile · Insurance,
 * the sidebar's top-level Billing section).
 *
 * Keyed by MRN, same as every other per-patient data file in this chart.
 */

export const PROFILE = {
  326486: {
    identity: {
      prefix: 'Ms.',
      firstName: 'Henna',
      middleName: 'Ruth',
      lastName: 'West',
      suffix: '',
      title: '',
      previousName: '',
      maidenName: 'Voss',
      ssnLast4: '4471',
      birthSex: 'Female',
      birthSexDeclined: false,
    },
    contact: {
      homePhone: '',
      workPhone: '',
      contactPreference: 'Text message',
      addressVerified: true,
    },
    demographics: {
      patientType: 'Outpatient',
      nationality: 'United States',
      race: 'White',
      raceDetails: '',
      ethnicity: 'Not Hispanic or Latino',
      ethnicityDetails: '',
      tribalAffiliation: '',
      maritalStatus: 'Married',
    },
    registration: {
      notes: 'Prefers text reminders over calls — see quick note.',
      preferredLab: 'GastroEMR GI in-house lab',
      optOutTextToPay: false,
      optOutPortalReminders: false,
    },
    sharing: {
      privacyPolicyAcknowledged: true,
      protectData: 'Patient consents to share',
      medicationHistoryImport: 'Patient consents',
      cahpsRestricted: false,
      declineCareReminders: false,
      excludeFromReports: false,
    },
    chartAccess: ['Dr. Amara Mensah', 'Front desk'],
    providers: [
      { role: 'Referring', name: 'Dr. Alan Whitcombe', specialty: 'Family Medicine', practice: 'Red River Family Medicine', phone: '701-555-0177' },
    ],
    pharmacies: [
      { name: 'Thrifty White — Fargo', address: '1201 Main Ave, Fargo ND 58103', phone: '701-555-0199', primary: true },
    ],
  },

  326477: {
    identity: {
      prefix: 'Ms.',
      firstName: 'Natali',
      middleName: '',
      lastName: 'Craig',
      suffix: '',
      title: '',
      previousName: '',
      maidenName: '',
      ssnLast4: '2209',
      birthSex: 'Female',
      birthSexDeclined: false,
    },
    contact: {
      homePhone: '',
      workPhone: '949-555-0120',
      contactPreference: 'Email',
      addressVerified: true,
    },
    demographics: {
      patientType: 'Outpatient',
      nationality: 'United States',
      race: 'White',
      raceDetails: '',
      ethnicity: 'Not Hispanic or Latino',
      ethnicityDetails: '',
      tribalAffiliation: '',
      maritalStatus: 'Married',
    },
    registration: {
      notes: '',
      preferredLab: 'LabCorp — Fargo',
      optOutTextToPay: true,
      optOutPortalReminders: false,
    },
    sharing: {
      privacyPolicyAcknowledged: true,
      protectData: 'Patient consents to share',
      medicationHistoryImport: 'Patient consents',
      cahpsRestricted: false,
      declineCareReminders: false,
      excludeFromReports: false,
    },
    chartAccess: ['Dr. Luca Bianchi'],
    providers: [],
    pharmacies: [
      { name: 'Walgreens — 45th St', address: '4501 13th Ave S, Fargo ND 58103', phone: '701-555-0142', primary: true },
    ],
  },

  326481: {
    identity: {
      prefix: 'Mr.',
      firstName: 'Liam',
      middleName: '',
      lastName: 'Rodriguez',
      suffix: '',
      title: '',
      previousName: '',
      maidenName: '',
      ssnLast4: '',
      birthSex: 'Male',
      birthSexDeclined: false,
    },
    contact: {
      homePhone: '415-555-0198',
      workPhone: '',
      contactPreference: 'Phone call',
      addressVerified: false,
    },
    demographics: {
      patientType: 'Outpatient',
      nationality: 'United States',
      race: '',
      raceDetails: '',
      ethnicity: 'Patient declines to specify',
      ethnicityDetails: '',
      tribalAffiliation: '',
      maritalStatus: '',
    },
    registration: {
      notes: '',
      preferredLab: '',
      optOutTextToPay: false,
      optOutPortalReminders: true,
    },
    sharing: {
      privacyPolicyAcknowledged: true,
      protectData: '',
      medicationHistoryImport: '',
      cahpsRestricted: false,
      declineCareReminders: false,
      excludeFromReports: false,
    },
    chartAccess: [],
    providers: [],
    pharmacies: [],
  },

  326495: {
    identity: {
      prefix: '',
      firstName: 'Zoe',
      middleName: '',
      lastName: 'Tran',
      suffix: '',
      title: '',
      previousName: '',
      maidenName: '',
      ssnLast4: '',
      birthSex: 'Female',
      birthSexDeclined: false,
    },
    contact: {
      homePhone: '',
      workPhone: '',
      contactPreference: 'Phone call — guardian',
      addressVerified: true,
    },
    demographics: {
      patientType: 'Outpatient',
      nationality: 'United States',
      race: 'Asian',
      raceDetails: 'Vietnamese',
      ethnicity: 'Not Hispanic or Latino',
      ethnicityDetails: '',
      tribalAffiliation: '',
      maritalStatus: '',
    },
    registration: {
      notes: 'Guardian: Mai Tran, 208-555-0172.',
      preferredLab: 'GastroEMR GI in-house lab',
      optOutTextToPay: false,
      optOutPortalReminders: false,
    },
    sharing: {
      privacyPolicyAcknowledged: true,
      protectData: 'Patient consents to share',
      medicationHistoryImport: 'Patient consents',
      cahpsRestricted: true,
      declineCareReminders: false,
      excludeFromReports: false,
    },
    chartAccess: ['Dr. Sana Nakamura', 'Guardian — Mai Tran'],
    providers: [
      { role: 'Referring', name: 'Dr. Grace Ibarra', specialty: 'Pediatrics', practice: 'Northside Community Health', phone: '208-555-0140' },
    ],
    pharmacies: [],
  },
};

export const EMPTY_PROFILE = {
  identity: {
    prefix: '', firstName: '', middleName: '', lastName: '', suffix: '', title: '',
    previousName: '', maidenName: '', ssnLast4: '', birthSex: '', birthSexDeclined: false,
  },
  contact: { homePhone: '', workPhone: '', contactPreference: '', addressVerified: false },
  demographics: {
    patientType: '', nationality: '', race: '', raceDetails: '', ethnicity: '',
    ethnicityDetails: '', tribalAffiliation: '', maritalStatus: '',
  },
  registration: {
    notes: '', preferredLab: '',
    optOutTextToPay: false, optOutPortalReminders: false,
  },
  sharing: {
    privacyPolicyAcknowledged: false, protectData: '', medicationHistoryImport: '',
    cahpsRestricted: false, declineCareReminders: false, excludeFromReports: false,
  },
  chartAccess: [],
  providers: [],
  pharmacies: [],
};
