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

**Untrusted Discovery Content**:
All text originating from Source Evidence or Voice Samples, treated solely as data and never as instructions for the provider or extension. It cannot enable tools, access other extension data, or alter trusted generation rules.
_Avoid_: Provider instruction, trusted example, executable content

**Analysis Request**:
A single, explicit user instruction to analyze one Post Context. Enabling the extension alone never creates one, and only one Analysis Request may be active at a time.
_Avoid_: Scan, automatic analysis

**Analysis Consent**:
The user's informed and revocable authorization, provided during onboarding, for future Analysis Requests to transmit Post Context to Google Gemini immediately, including acknowledgment of Google's free-tier data-use disclosure. It does not authorize background analysis or any LinkedIn action.
_Avoid_: Implied consent, posting permission

**Discovery Consent**:
The user's informed and revocable authorization to transmit Source Evidence, their Engagement Profile, Discovery Topics, and Voice Guide to Groq for a user-initiated Discovery Run. Voice Samples are transmitted only through an explicit voice-analysis request; Discovery Consent never authorizes LinkedIn access or submission. Revoking it cancels an active Discovery Run, revokes discovery-source and Groq host permissions, and clears current or transient discovery data while retaining local settings, Voice Guide, and Publication History until the user explicitly deletes them.
_Avoid_: Analysis Consent, automatic opt-in, posting permission

**Risk Acknowledgment**:
The user's explicit confirmation that the independent product passively extracts selected LinkedIn content, is not endorsed by LinkedIn, may conflict with LinkedIn's extension policy, and carries non-zero account risk.
_Avoid_: Liability waiver, hidden disclaimer

**Passive Post Extraction**:
The user-triggered, read-only collection of already-rendered Post Context after the user identifies one post through Chrome's context menu. It performs no LinkedIn requests, scrolling, clicking, expansion, typing, submission, or DOM mutation.
_Avoid_: Background scraping, feed scanning, stealth extraction

**Supported Post Surface**:
A LinkedIn main-feed post or standalone post-detail page whose rendered structure the current release recognizes and tests. Profile activity, company, search, notification, group, newsletter, and embedded surfaces are deferred.
_Avoid_: Any LinkedIn page, universal post support

**Unsupported Post Layout**:
A selected LinkedIn post whose root, Visible Post Text, Response Target, or discussion structure cannot be identified uniquely and validated. It produces no provider request or Response Draft.
_Avoid_: Partial post, best-effort post

**Visible Discussion**:
The discussion content included in Post Context when an Analysis Request is made. A post target includes every rendered comment and reply; a discussion target includes only its Visible Thread, and hidden, collapsed, paginated, or otherwise unloaded content is never included.
_Avoid_: All comments

**Visible Thread**:
The top-level comment and every reply already rendered beneath it when a comment or reply is selected as the Response Target. It is included alongside Visible Post Text and excludes unrelated comment threads and the reply composer.
_Avoid_: Comment tree, all discussion, reply editor

**Context Overflow**:
An Analysis Request whose complete Post Context, Engagement Profile, instructions, and output allowance exceed the selected model's hard context limit. It is rejected before generation without silently truncating discussion or starting a multi-pass analysis.
_Avoid_: Partial analysis, automatic summarization

**Analysis History**:
A rolling local collection of the 20 most recent History Entries. It is not a post archive and never retains complete Post Context or Visible Discussion.
_Avoid_: Post archive, activity log

**Publication History**:
A rolling local collection of the 20 most recent Publication Draft records, including their Source Reference, assessment summary, creation time, and model identifier. It never retains Source Evidence.
_Avoid_: Analysis History, article archive, discovery cache

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

**Publication Draft**:
An AI-generated standalone LinkedIn post proposed from a relevant Discovery Source item, the user's Engagement Profile, and approved voice guidance. It is always reviewed and published manually by the user.
_Avoid_: Response Draft, generated comment, automatic post

**Post Opportunity Assessment**:
An evidence-qualified estimate of how well a Discovery Source item fits the user's professional context and audience, considering relevance, freshness, discussion value, credibility risk, and observable engagement signals. It includes uncertainty and never promises future engagement. A Discovery Run returns fewer opportunities or drafts when it lacks sufficiently relevant evidence instead of filling the requested count with generic popular content.
_Avoid_: Sentiment analysis, engagement prediction, virality score

**Opportunity Rating**:
The descriptive outcome of a Post Opportunity Assessment: Strong opportunity, Consider, or Skip. Internal ordering values are not displayed as engagement probabilities.
_Avoid_: Engagement percentage, viral score, success probability

**Opportunity Type**:
A classification used to diversify selected Post Opportunities: timely trend, practical learning, or strongest general fit. It describes the publishing angle rather than the source's content format.
_Avoid_: Sentiment, source type, guaranteed slot

**Source Evidence**:
The content and metadata supplied directly by an approved Discovery Source through its API or RSS feed. It excludes arbitrary linked webpages, and a Publication Draft is not created when the available Source Evidence cannot support one.
_Avoid_: Full article, linked-page scrape, headline assumption

**Minimized Source Evidence**:
The subset of Source Evidence permitted in a Discovery Provider request: source title, permitted excerpt, tags, age, and aggregate engagement signals. It excludes author identities, profile data, URLs, user IDs, and full discussions.
_Avoid_: Source Reference, raw feed item, discussion transcript

**Source Reference**:
The platform name, source title, and canonical URL shown beside a Post Opportunity or Publication Draft for manual review. It remains separate from the draft and is not included when draft text is copied.
_Avoid_: Embedded attribution, generated citation, copied credit line

**Seen Item Record**:
A local source identifier or canonical-URL fingerprint with a discovery timestamp, retained for 30 days to suppress repeated and cross-source recommendations. It contains no article or discussion text.
_Avoid_: Browsing history, article cache, Source Evidence archive

**Evidence-Bound Draft**:
A Response Draft or Publication Draft whose personal claims are supported by the approved Engagement Profile and whose content claims are supported by its available context or Source Evidence. Source popularity is never treated as factual verification; unsupported statistics and definitive claims are omitted, while questionable claims are framed cautiously or cause the opportunity to be skipped. It qualifies uncertainty and never invents experience, relationships, results, credentials, opinions, or product usage.
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
Four distinct Response Drafts accompanying an Analysis Summary: one adds a professional insight, one asks a thoughtful specific question, one supports and extends the discussion, and one offers a Constructive Challenge.
_Avoid_: Alternatives list, generated comments

**Constructive Challenge**:
A Response Draft strategy that identifies a material contradiction or unsupported assumption, tests it with a direct question or counterpoint, and remains professionally focused without sarcasm or personal criticism.
_Avoid_: Hostile reply, sarcastic takedown, contrarian tone

**Draft Language**:
The language used by a Draft Set, matching the Response Target by default unless the user chooses a preferred language or a per-request override. English is the fallback when the target language is uncertain.
_Avoid_: Interface language, profile language

**Length Mode**:
The user's concise, standard, or detailed size preference for Response Drafts, interpreted relative to whether the Response Target is a post or discussion item. Standard is the default; emoji and hashtags require separate opt-in preferences.
_Avoid_: Token limit, verbosity

**Publication Length**:
The user's short, standard, or detailed size preference for Publication Drafts: 80–150, 150–250, or 250–400 words. Standard is the default and is independent from Response Draft Length Mode.
_Avoid_: Length Mode, token limit, LinkedIn character limit

**Publication Formatting**:
The user's standalone-post preferences for emoji and hashtags, independent from Response Draft preferences. Both are disabled by default; enabled drafts use at most three hashtags and remain plain, readable text without decorative formatting.
_Avoid_: Comment formatting, Markdown style, engagement decoration

**Publication Language**:
The user's preferred language for Publication Drafts, defaulted initially from the Engagement Profile but managed independently afterward. It does not follow the language of Source Evidence automatically.
_Avoid_: Source language, interface language, Response Draft language

**Publication Guidance Precedence**:
The conflict-resolution order for Publication Draft generation: safety and evidence rules first; explicit Publication Language, Publication Length, and Publication Formatting second; the saved Voice Guide third; and the Engagement Profile tone as the fallback. Generation remains available without a Voice Guide.
_Avoid_: Prompt priority, model preference, automatic voice training

**Response Target**:
The content a Response Draft directly addresses. It is the selected post when the user invokes analysis from post content, or the specific comment or reply from which analysis is invoked.
_Avoid_: Selected text, active element

**Manual Submission**:
The user's independent act of reviewing, optionally editing, copying, and submitting a Response Draft through LinkedIn.
_Avoid_: Auto-post, assisted posting

**Provider Credential**:
An API key for a supported AI provider, supplied and owned by the individual user. The product has no shared or bundled Provider Credential.
_Avoid_: Extension API key, shared key, application key

**Credential Vault**:
The extension-only persistence boundary that automatically encrypts a Provider Credential with a non-exportable device key and restores the plaintext only to protected browser-session storage. It is defense in depth rather than an operating-system keychain.
_Avoid_: Password manager, hashed API key, guaranteed secret storage

**Discovery Provider**:
The AI provider that evaluates Discovery Source items and creates Publication Drafts. It is independent from the provider reserved for Response Drafts. Discovery cannot be enabled or run until its Provider Credential validates, although source and voice settings remain editable beforehand.
_Avoid_: Scraper, source provider, automatic fallback

**Manual Provider Override**:
The user's explicit choice to retry one failed discovery operation with the Response Draft provider when the Discovery Provider is unavailable: either the failed assessment batch or one selected draft. It is never triggered automatically and never switches the entire Discovery Run.
_Avoid_: Provider fallback, silent retry, load balancing

**Voice Sample**:
One of up to five user-authored post examples voluntarily supplied, managed, and retained locally to guide the style of future Publication Drafts. Voice Samples are not model-training data and do not establish facts about the user's experience or credentials.
_Avoid_: Training example, borrowed post, profile evidence

**Voice Guide**:
An editable style description derived from all submitted Voice Samples and retained locally for reuse in Publication Draft generation. It describes writing patterns but never establishes facts about the user's experience, opinions, or credentials. It changes only through explicit voice actions in Settings; editing, saving, or copying a Publication Draft never updates it automatically.
_Avoid_: Fine-tuned model, trained persona, professional profile

**Profile PDF**:
A resume-format PDF that a user exports from their own LinkedIn profile and voluntarily supplies to create their professional context. A PDF of another member's profile is never accepted.
_Avoid_: Member profile PDF, third-party profile

**Engagement Profile**:
The user's editable and approved professional context, created from their own Profile PDF or through manual entry, that guides the relevance, voice, and boundaries of Response Drafts. It excludes contact details and the raw Profile PDF.
_Avoid_: LinkedIn profile copy, user dossier, persona

**Quota Fallback**:
A single retry with Gemini 3.1 Flash-Lite after Gemini explicitly reports that Gemini 3.5 Flash is rate-limited or has exhausted its quota. An ambiguous timeout, network failure, authentication failure, or malformed response never starts a Quota Fallback.
_Avoid_: Automatic retry, paid fallback

**Discovery Run**:
A user-initiated collection of recent developer-publication candidates for evaluation against the user's professional context, with at most one run active at a time. It is independent of LinkedIn content and may run concurrently with one Analysis Request without interacting with a LinkedIn page.
_Avoid_: Scheduled discovery, LinkedIn scan, cloud crawler

**Discovery Request Budget**:
The normal AI-call boundary for one Discovery Run: one compact, structured Groq request assesses all locally filtered candidates and creates up to three Publication Drafts together. The request uses a conservative preflight token estimate below the free 8,000 TPM ceiling. Voice analysis, selected-opportunity generation, and alternative generation use separate requests only after an explicit user action. A provider rate or quota limit stops the operation, preserves completed results, and displays available retry timing without automatic retries or provider switching.
_Avoid_: Daily quota, source request limit, automatic retry budget

**Discovery Source**:
An approved, machine-readable publication channel considered during a Discovery Run. The initial set consists of Hacker News, DEV, Medium, Lobsters, and Stack Overflow; Reddit and daily.dev are not Discovery Sources.
_Avoid_: Scraped website, social network feed, arbitrary URL

**Source Preference**:
The user's local choice of whether a Discovery Source participates in Discovery Runs and whether it may contribute one to five recommendations. After the user opts into discovery, all five initial Discovery Sources start enabled with a target of three recommendations each; the user may deselect sources before Chrome requests their host access.
_Avoid_: Scrape quota, platform permission, global result limit

**Source Freshness Policy**:
The age boundary applied before opportunity ranking. Timely-trend candidates must have been published within the last seven days, while practical or educational candidates may be up to thirty days old.
_Avoid_: Seen-item window, publication schedule, universal seven-day cutoff

**Discovery Topic**:
One of up to ten user-editable subjects derived initially from the Engagement Profile and used to focus Discovery Sources and Post Opportunity Assessments. Discovery Topics are managed locally in Settings.
_Avoid_: Source tag, search history, fixed profile field
