/**
 * Reports — the twelve the practice asks for by name.
 *
 * The whole screen is one line, and that is deliberate. Every report is
 * declared in data/reports.js and drawn by js/lib/report-screen.js; there is
 * nothing left for this file to decide. A new report is an entry in the
 * catalogue, not an edit here.
 */
import { mountReportScreen } from '../lib/report-screen.js';

mountReportScreen();
