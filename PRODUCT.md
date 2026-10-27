# Employee app scope

Employees use NIYA to understand their own family cover independently of an enrolment invitation. The first release serves staff-rostered employees through the existing employee-scoped backend APIs.

## Available journeys

- Sign in with corporate email or roster phone and an OTP. Resolve identity on the backend; an ambiguous phone must not grant access to another employee.
- Home: show the employee's company, cover summary and entry points to the available core screens.
- Profile: display the employee's own details and sign out.
- Family: display the roster family. Keep roster membership distinct from membership covered by a particular policy.
- Cover: display current policies, their covered members, shared family sum insured, any lower parent/in-law limit and policy dates returned by the API.

These screens are read-only. A factual or cover change follows the existing staff and endorsement process.

## Cover language

Each policy's sum insured is shared by its covered family. Base and top-up are separate policies; their limits belong to their own cover. A lower parent or in-law limit sits within that policy's floater and is shared by those covered parents or in-laws together. Display the lower-limit note only when the API provides a positive value below that policy's sum insured.

Employee responses and screens keep premiums and CD ledger data private. Show unavailable values honestly, using the appropriate empty or unavailable state rather than inventing a benefit, card or entitlement.

## Customer-specific content

Company identity, policies, family, eligibility, terms and status come from the API. The current app composes Home, Cover and Profile from that response, with Family as a detail screen. A customer without a top-up sees only its actual cover.

The approved claims foundation supports documentless admission-intimation drafts, edits, declaration, test submission and history through a network-free fake provider. The Claims entry appears only when the backend enables that capability; production remains disabled. Test receipts are not insurer approval, cashless authorisation or payment.

Live claims filing, reimbursement, documents, provider status/payment sync, hospital search, e-cards, card status, benefit and FAQ detail, OPD and wellness remain future modules. When a module is implemented, a versioned backend capability manifest can select its visibility and supported actions. The backend must enforce each action even when the UI hides it. Arbitrary layouts or executable code are not part of that proposed manifest.

## Session behaviour

Native apps keep the access token in platform secure storage. The browser keeps it in memory, so a page refresh requires sign-in again. Signing out removes the local token. A 401 response returns the user to sign-in; a network failure preserves a recoverable error state instead of displaying fabricated data.
