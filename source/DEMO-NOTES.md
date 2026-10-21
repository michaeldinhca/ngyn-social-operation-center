# Municipal workflow prototype

This is a browser-local demonstration, not the production Next.js/NestJS service. Data, access checks, preferences, and audit history are saved in localStorage. Demo impersonation is deliberately available through “View as user”; it is not authentication or server-enforced authorization.

Implemented: grouped/collapsible navigation, light/dark per-user preferences, hierarchical brand direction, guideline review, reference selection, network-shaped content previews, create/review/approve/schedule demo content, SOC simulated updates and emergency pause, inbox/comment assignment, staff sentiment override, internal notes and reviewed resolution. No real social APIs, AI calls, invitations, replies, publishing, or spend.

Calendar currently reuses the filtered content schedule view. Analytics, advertising, and listening remain explicitly planned screens.

Master rules are always included before sub-guidelines. Updating master rules marks all sets for review and blocks reviewed-brief export until confirmed. Human attestation is a workflow guard; automated semantic contradiction detection is not implemented.

Common visual formats are working canvases, not guaranteed platform specifications. Stock images use remote Unsplash URLs with source credits; their locations are illustrative, not Harbourview. PNG/JPEG/WebP brand logos can be stored locally; they are not sent to an AI service.

Accessibility preferences are under My preferences only. The GHL reference kit was not present in available files. No AODA certification or legal compliance claim is made.

Run checks with `node --test tests/workflow.test.cjs` and `node --check dist/operations.js`.
