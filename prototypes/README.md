# Thoughtline UI prototypes

Prototype files are immutable visual snapshots. Never edit an approved version in place. Any future UI change creates the next sequential `simplified-ui-vN.html` file and adds a changelog entry here.

`reference.json` is the machine-readable approval pointer used by automated UI tests. When a new prototype is approved, add the immutable HTML file, update this changelog, and move `reference.json` to that version in the same change. Tests fail if a newer version exists without an updated pointer.

## Versions

### Original baseline

`simplified-ui-original.html` preserves the approved prototype produced during the initial UI iteration.

### Version 2

`simplified-ui-v2.html` preserves the original visual system while visualizing decisions from the specification review:

- single explicit AI-processing consent with a separate non-automation safety note;
- provider-neutral Gemini-primary and automatic-Groq-fallback messaging;
- corrected context-menu and passive-extraction copy;
- required writing-profile fields and reviewed profile suggestions;
- Rewrite History filtering and records, revision disclosures, and confirmed deletion;
- Data Archive import/export, confirmed retention and Clear All surfaces;
- profile and credential removal controls;
- reviewed Style Guide and Learned Writing Preferences surfaces;
- an experience-based Idea post editor; and
- a non-persistent Schedule Preview result.

### Version 3

`simplified-ui-v3.html` keeps every Version 2 screen and interaction unchanged while updating the five-item bottom navigation to use the same visual treatment as the English/বাংলা tabs: a pale blue tab rail, white active surface, blue active label, and subtle one-pixel shadow. Touch-target dimensions and responsive behavior remain unchanged.

### Version 4

`simplified-ui-v4.html` keeps the Version 3 pale-blue navigation rail, restores the original solid blue selected tab with white text, and explicitly fixes the navigation to five equal `minmax(0, 1fr)` columns. The rail uses the same left content inset and reserves the scroll track on the right, keeping both edges aligned with the page cards at every supported panel width. Each equal tab control remains centered with a two-pixel inset on both sides.

### Version 5

`simplified-ui-v5.html` keeps the Version 4 side-panel visual system, moves the live onboarding progress (`Step 1 of 4` through `Step 4 of 4`) into the setup header’s right-side status position, and links AI-processing consent to a dedicated Terms of Service page. The redundant `Extension-local` status, duplicate progress label, and separate LinkedIn safety-assurance card are removed.

Version 5 now also documents the approved guarded LinkedIn layout-calibration workflow:

- exact bounded DOM evidence review before an AI request;
- a complete author, primary-text, and boundary confirmation preview;
- local two-example validation before a recipe can be saved;
- a one-item-only result when only one matching example is visible;
- a teal evidence-bracket visual that mirrors the temporary LinkedIn outline; and
- device-local calibrated-layout inspection, removal, and reset controls in Settings.

The production extension follows the highest prototype version explicitly approved by the user.

## Direct preview links

The prototype supports optional query parameters for visual review without changing product behavior:

- `?scene=settings`
- `?scene=history`
- `?scene=reply&replyState=loading`
- `?scene=ideas&ideaState=experience`
- `?scene=settings&dialog=style-guide-dialog`
- `?scene=calibration&calibrationState=evidence`
- `?scene=calibration&calibrationState=preview`
- `?scene=calibration&calibrationState=success`

The prototype's visible screen controls remain the primary way to move through states.
