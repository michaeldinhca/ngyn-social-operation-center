# ADR 0002: Agent access through MCP, and a thin advertising layer

- Status: **PROPOSED.** The direction is the Product Director's (2026-10-26). The design below needs approval before any build.
- Date: 2026-10-26
- Related: ADR 0001 (stack and Zernio), `docs/handoff/CLAUDE_HANDOFF.md` (access rules)

## Context

Director, 2026-10-26, on the advertising section: Google Ads and Meta Ads are structured differently, so replicating their management layouts is not the goal. "The top idea is to plug their ChatGPT into the system to control." On reports: "ChatGPT will connect through our MCP and do their task", so chart images in exports are not needed.

So the product is not a second ad manager or a second analytics tool. It is a **governed control layer**: people and AI agents both work through it, and it enforces who may do what, human approval, spend limits and a full audit trail.

## Decision (proposed)

1. **MCP server.** The product exposes an MCP server. The customer's ChatGPT (or any MCP client) connects to it and acts **for a named person**.
2. **One service layer.** MCP tools call the same service functions as the UI. In the mockup these are the functions in `web/src/mock/api*.ts`, which already check permissions per action. That is the contract: nothing is exposed to an agent that a person could not do in the UI.
3. **Identity and scope.** The agent acts as a delegate of the person who connected it. Its permissions are the **intersection** of that person's permissions and an agent scope an administrator sets (for example read-only, or drafts only). The audit actor is "ChatGPT for <person>".
4. **Human gates stay, and apply to agents.**
   - An agent can draft and submit posts and campaigns. Anything it writes counts as written by the delegating person, so **separation of duties** applies: another approver has to approve it (decided 2026-10-26 for posts and campaigns).
   - No tool approves its own output, schedules without an approved post, or publishes.
   - **No spend:** there is no launch or spend tool. The no-spend guard stays.
   - The emergency pause blocks scheduling for agents exactly as for people. Pausing and resuming stay human-only unless an administrator says otherwise.
5. **Advertising stays a thin layer.** A campaign is a provider-neutral brief (objective, creative, audience, schedule, simulated budget) with approval, a budget guard and an audit trail. It does not reproduce Meta or Google structures (ad sets, placements, bidding). A later gateway maps the brief to each platform. The mock ad accounts are governance records for now; the Director is unsure about the final model, so revisit it when the tool list is designed.
6. **Reports as data.** Analytics tools return structured data with source, refresh time and "unavailable" markers (never zero). PDF and CSV exports stay a human feature. No chart images.
7. **Untrusted content.** Resident comments, messages and mentions are untrusted input. Tool results mark them as data, and the agent must not treat them as instructions (prompt injection). Add rate limits and per-tool confirmation for writes.

## Risks and open questions

- **Privacy and residency.** Sending resident text to an external AI service is a data flow under the Canada-only privacy concern (see ADR 0001). Decide whether inbox and listening content is exposed to agents at all, and review the provider's data handling first.
- **Which ChatGPT surface:** a custom connector over MCP, or a custom GPT with actions? This sets how authentication works.
- **Authentication:** per-person OAuth against our identity provider, token lifetime and revocation, and one instance (tenant) per municipality.
- **Tool list:** start read-only (channels, posts, conversations, analytics), then drafts (post, campaign, reply draft, note), reviewed one tool at a time.
- **Accountability:** how an administrator sees and limits what each agent did (the activity log needs an agent filter).

## Consequences

- No Google or Meta management UI to build; effort goes into the governance layer (permissions, approvals, guard, audit) that the UI already demonstrates.
- The mock API doubles as the specification for the MCP tool set, so keep it small, explicit and permission-checked.
- A new requirement, E17 (agent access via MCP), enters `REQUIREMENTS.md`. Work item `MCP-AGENT-SURFACE` is queued behind the stack decision.
