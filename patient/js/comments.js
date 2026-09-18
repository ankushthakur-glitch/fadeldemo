/**
 * The review comment layer, on the patient portal.
 *
 * A one-line re-export rather than a copy. The layer is deliberately
 * product-agnostic — it reads its screen key from the pathname, draws its own
 * icons rather than borrowing a sprite, and its stylesheet resolves both
 * products' design tokens by name — so the portal needs the same module the
 * EHR uses, not a portal-shaped variant of it that would drift.
 *
 * It is a file of its own rather than an import inside shell.js because the
 * two auth screens never mount the shell, and a comment on the sign-in page
 * is exactly the kind of thing a reviewer wants to leave.
 */
import '../../js/lib/comments/index.js';
