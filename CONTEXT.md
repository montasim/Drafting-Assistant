# Professional Drafting Assistant

A user-controlled assistant that turns the context of one LinkedIn post into professional comment or reply drafts. It supports human-authored engagement rather than performing engagement on the user's behalf.

## Language

**Drafting Assistant**:
The product that analyzes one user-selected post and proposes professional responses for the user to review and copy.
_Avoid_: Engagement bot, commenting bot, growth bot

**Post Context**:
The already-rendered textual content associated with one user-selected post, including its text, anonymous participant roles, aggregate reaction summary, and visible discussion. It excludes participant identities, profile metadata, unloaded content, images, and video.
_Avoid_: All post data, scraped post

**Visible Post Text**:
Text rendered within the selected post, including ordinary post text, repost commentary, quoted post text, poll choices, and link-preview titles or descriptions. It excludes the contents of external link destinations.
_Avoid_: Linked article, external page content

**Untrusted Post Content**:
All text originating from a LinkedIn post or its Visible Discussion, treated solely as data and never as instructions for the provider or extension.
_Avoid_: User prompt, embedded instruction

**Analysis Request**:
A single, explicit user instruction to analyze one Post Context. Enabling the extension alone never creates one, and only one Analysis Request may be active at a time.
_Avoid_: Scan, automatic analysis

**Analysis Consent**:
The user's informed and revocable authorization, provided during onboarding, for future Analysis Requests to transmit Post Context to Google Gemini immediately, including acknowledgment of Google's free-tier data-use disclosure. It does not authorize background analysis or any LinkedIn action.
_Avoid_: Implied consent, posting permission

**Risk Acknowledgment**:
The user's explicit confirmation that the independent product passively extracts selected LinkedIn content, is not endorsed by LinkedIn, may conflict with LinkedIn's extension policy, and carries non-zero account risk.
_Avoid_: Liability waiver, hidden disclaimer

**Passive Post Extraction**:
The user-triggered collection of already-rendered Post Context after the user identifies one post through Chrome's context menu. It neither loads additional LinkedIn content nor changes or acts on the LinkedIn page.
_Avoid_: Background scraping, feed scanning, stealth extraction

**Supported Post Surface**:
A LinkedIn main-feed post or standalone post-detail page whose rendered structure the current release recognizes and tests. Profile activity, company, search, notification, group, newsletter, and embedded surfaces are deferred.
_Avoid_: Any LinkedIn page, universal post support

**Unsupported Post Layout**:
A selected LinkedIn post whose root, Visible Post Text, Response Target, or discussion structure cannot be identified uniquely and validated. It produces no provider request or Response Draft.
_Avoid_: Partial post, best-effort post

**Visible Discussion**:
Every comment and reply already rendered for the selected post when an Analysis Request is made. Hidden, collapsed, paginated, and otherwise unloaded discussion is not included.
_Avoid_: All comments

**Context Overflow**:
An Analysis Request whose complete Post Context, Engagement Profile, instructions, and output allowance exceed the selected model's hard context limit. It is rejected before generation without silently truncating discussion or starting a multi-pass analysis.
_Avoid_: Partial analysis, automatic summarization

**Analysis History**:
A rolling local collection of the 20 most recent History Entries. It is not a post archive and never retains complete Post Context or Visible Discussion.
_Avoid_: Post archive, activity log

**History Entry**:
A minimized record containing creation time, Response Target type, a short post excerpt, Analysis Summary, Draft Set, Draft Language, and model identifier.
_Avoid_: Prompt snapshot, complete analysis input

**Diagnostic Bundle**:
A user-inspectable local export containing sanitized extension version, environment, timing, and error information for support. It excludes LinkedIn content, Response Drafts, Engagement Profiles, Provider Credentials, and browsing history.
_Avoid_: Telemetry event, remote log

**Participant Label**:
A temporary role that preserves discussion structure without identifying a LinkedIn member, such as Post Author, Target Commenter, or Commenter A.
_Avoid_: Member name, profile identity

**Reaction Summary**:
Aggregate reaction types and counts visible on the selected post. It never contains the identities of members who reacted.
_Avoid_: Reactor list, reaction identities

**Response Draft**:
AI-generated text proposed as either a comment on the selected post or a reply within its Visible Discussion. It is never submitted to LinkedIn by the Drafting Assistant.
_Avoid_: Posted comment, automatic reply

**Evidence-Bound Draft**:
A Response Draft whose personal claims are supported by the approved Engagement Profile or Post Context. It qualifies uncertainty and never invents experience, relationships, results, credentials, or product usage.
_Avoid_: Plausible anecdote, synthetic experience

**Draft Edit**:
A user's local modification to a Response Draft before copying it. It updates the corresponding History Entry but is not sent to Gemini or inserted into LinkedIn.
_Avoid_: Refinement request, submitted comment

**Analysis Summary**:
A concise interpretation of the Response Target covering its main themes, communication intent, important uncertainty, and potential reputational risk.
_Avoid_: Full transcript, engagement score

**Engagement Risk**:
A potential professional, privacy, safety, or credibility cost of responding to the selected content, including conflict, harassment, confidential information, regulated claims, or unsupported allegations. It prompts a visible warning and conservative drafts but leaves the engagement decision to the user.
_Avoid_: Sentiment score, automatic refusal

**Draft Set**:
Three distinct Response Drafts accompanying an Analysis Summary: one adds a professional insight, one asks a thoughtful specific question, and one supports and extends the discussion.
_Avoid_: Alternatives list, generated comments

**Draft Language**:
The language used by a Draft Set, matching the Response Target by default unless the user chooses a preferred language or a per-request override. English is the fallback when the target language is uncertain.
_Avoid_: Interface language, profile language

**Length Mode**:
The user's concise, standard, or detailed size preference for Response Drafts, interpreted relative to whether the Response Target is a post or discussion item. Standard is the default; emoji and hashtags require separate opt-in preferences.
_Avoid_: Token limit, verbosity

**Response Target**:
The content a Response Draft directly addresses. It is the selected post when the user invokes analysis from post content, or the specific comment or reply from which analysis is invoked.
_Avoid_: Selected text, active element

**Manual Submission**:
The user's independent act of reviewing, optionally editing, copying, and submitting a Response Draft through LinkedIn.
_Avoid_: Auto-post, assisted posting

**Provider Credential**:
A Google Gemini API key supplied and owned by the individual user. The product has no shared or bundled Provider Credential.
_Avoid_: Extension API key, shared key, application key

**Profile PDF**:
A resume-format PDF that a user exports from their own LinkedIn profile and voluntarily supplies to create their professional context. A PDF of another member's profile is never accepted.
_Avoid_: Member profile PDF, third-party profile

**Engagement Profile**:
The user's editable and approved professional context, created from their own Profile PDF or through manual entry, that guides the relevance, voice, and boundaries of Response Drafts. It excludes contact details and the raw Profile PDF.
_Avoid_: LinkedIn profile copy, user dossier, persona

**Quota Fallback**:
A single retry with Gemini 2.5 Flash-Lite after Gemini explicitly reports that Gemini 2.5 Flash is rate-limited or has exhausted its quota. An ambiguous timeout, network failure, authentication failure, or malformed response never starts a Quota Fallback.
_Avoid_: Automatic retry, paid fallback
