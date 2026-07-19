const styles = {
  shell: 'min-h-screen px-4 pt-4 pb-20',
  wide: 'mx-auto w-full max-w-[920px] px-6 pt-6 pb-16 max-[600px]:px-4 max-[600px]:pt-4',
  header: 'mb-4 flex items-center justify-between gap-3',
  sidePanelHeader:
    'sticky top-0 z-30 -mx-4 -mt-4 border-b border-rule bg-canvas/95 px-4 py-3 backdrop-blur-md',
  onboardingHeader:
    'sticky top-0 z-30 -mx-6 -mt-6 !mb-6 border-b border-rule bg-canvas/95 px-6 pt-6 pb-4 backdrop-blur-md max-[600px]:-mx-4 max-[600px]:-mt-4 max-[600px]:px-4 max-[600px]:pt-4',
  brandLockup: 'flex min-w-0 items-center gap-3',
  markFrame: 'grid size-9 shrink-0 place-items-center rounded-lg border border-rule bg-surface',
  mark: 'block size-7 object-contain',
  title: 'm-0 font-display text-[18px] leading-5 font-[680] tracking-[-.025em] text-ink',
  eyebrow:
    'mb-1 font-utility text-[9px] leading-[1.4] font-semibold tracking-[.07em] text-muted uppercase',
  headerPromise: 'mt-1 truncate text-[11px] leading-4 text-muted',
  headerSupportLink:
    'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-field bg-surface px-2.5 text-[10px] font-semibold text-primary no-underline hover:border-primary hover:bg-soft [&_svg]:size-3.5',
  setupCount:
    'shrink-0 whitespace-nowrap font-utility text-[10px] font-semibold tracking-[.04em] text-muted uppercase',
  onboardingIntro:
    'mb-6 [&_h2]:m-0 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-[680] [&_p]:mt-2 [&_p]:max-w-[600px] [&_p]:text-sm [&_p]:leading-6 [&_p]:text-muted',
  subtle: 'mt-1 text-[12px] leading-[1.55] text-muted',
  lead: 'mt-2 text-[13px] leading-5 text-muted',
  leadCompact: 'mt-2 text-[13px] leading-5 text-muted',
  card: 'relative mb-4 rounded-[10px] border border-rule bg-surface p-4 [&_h2]:m-0 [&_h2]:font-display [&_h2]:text-[18px] [&_h2]:leading-[1.28] [&_h2]:font-[680] [&_h2]:tracking-[-.02em] [&_h2]:text-ink [&_h3]:m-0 [&_h3]:font-display [&_h3]:text-sm [&_h3]:leading-5 [&_h3]:font-[680] [&_h3]:text-ink [&_p]:leading-[1.55]',
  cardActions: 'mt-3 flex items-center gap-2',
  activeSurface:
    'before:absolute before:top-3 before:bottom-3 before:left-0 before:w-[3px] before:rounded-r-full before:bg-proof before:content-["_"]',
  heroCard: 'border-rule bg-surface',
  heroCardSoft: 'border-rule bg-surface',
  setupPreview:
    'my-4 grid gap-2 [&_span]:flex [&_span]:items-center [&_span]:gap-2 [&_span]:text-xs [&_span]:text-ink [&_b]:font-utility [&_b]:text-[10px] [&_b]:text-proof',
  loadingCard: 'flex min-h-[116px] items-start gap-3 !py-6',
  runningExcerpt:
    'mt-2 line-clamp-2 overflow-hidden border-l border-rule pl-2 text-[12px] leading-[1.5] text-muted italic',
  stateIcon:
    'mx-auto mb-4 grid size-10 place-items-center rounded-lg border border-rule bg-soft text-primary [&_svg]:size-5',
  stateIconError:
    'mb-4 grid size-10 place-items-center rounded-lg border border-[#e5c8c6] bg-[#fff4f3] text-lg font-bold text-[#a33b3b]',
  empty: '!px-6 !py-6 text-center [&>p:last-of-type]:mx-auto',
  trustRow:
    'mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-rule pt-3 [&_span]:text-[10px] [&_span]:font-medium [&_span]:text-muted [&_span]:before:mr-1.5 [&_span]:before:text-proof [&_span]:before:content-["✓"]',
  reassurance: 'mt-3 text-center text-[10px] leading-[1.5] text-muted',
  supportingNote: 'text-[10px] leading-[1.5] text-muted',
  reassuranceLeft: 'mt-3 text-[10px] leading-[1.5] text-muted',
  analysisCard: 'border-rule',
  analysisOverview: 'my-4 text-[13px] text-ink',
  insightBlock: 'mt-4 border-t border-rule pt-4',
  modelMeta: 'mt-4 font-utility text-[9px] text-muted',
  sectionIntro:
    'mt-6 mb-3 flex items-end justify-between gap-3 [&_h2]:m-0 [&_h2]:font-display [&_h2]:text-base [&_h2]:font-[680] [&_h2]:tracking-[-.02em] [&_h2]:text-ink',
  draftCard: 'focus-within:border-primary [&>textarea]:mt-3',
  strategyPromise: 'm-0 text-[11px] font-medium text-muted',
  draftActions:
    'mt-3 flex items-center justify-between gap-3 max-[440px]:items-stretch max-[440px]:flex-col max-[440px]:[&>button]:w-full',
  draftStrategyTabs:
    'mb-2 grid grid-cols-4 gap-1 rounded-lg border border-rule bg-tint p-1 [&_button]:min-h-9 [&_button]:rounded-md [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-1 [&_button]:text-[9.5px] [&_button]:font-semibold [&_button]:whitespace-nowrap [&_button]:text-muted [&_button[data-active=true]]:bg-surface [&_button[data-active=true]]:text-primary',
  historyCard: 'pt-4 [&>details]:mt-3 [&>button:last-child]:mt-4',
  historyExcerpt: 'mt-3 mb-2 text-[12px] font-semibold text-ink',
  historySummary: 'text-[12px] text-muted',
  draft: 'mt-3 border-t border-rule pt-3',
  privacyList:
    'mt-4 grid gap-3 [&>span]:relative [&>span]:grid [&>span]:gap-0.5 [&>span]:pl-6 [&>span]:before:absolute [&>span]:before:top-px [&>span]:before:left-0 [&>span]:before:text-[11px] [&>span]:before:font-bold [&>span]:before:text-proof [&>span]:before:content-["✓"] [&_b]:text-xs [&_b]:text-ink [&_small]:block [&_small]:text-[10px] [&_small]:leading-[1.45] [&_small]:text-muted',
  developerName: 'mt-2 mb-1 text-[12px] font-semibold text-ink',
  externalLinks: 'mt-3 flex flex-wrap gap-2',
  linkButton: 'inline-flex items-center justify-center no-underline',
  inlineLink: 'w-fit text-[11px] font-semibold text-proof underline-offset-2',
  warning:
    'mt-3 rounded-lg border border-[#ead7ae] bg-[#fff8e8] p-3 text-[11px] leading-[1.55] text-[#76501b] [&_p]:mt-2',
  error:
    'mt-3 rounded-lg border border-[#e7c5c3] bg-[#fff4f3] p-3 text-[11px] leading-[1.55] text-[#8d3535] [&_p]:mt-2 [&>button]:mt-3',
  success:
    'mt-3 rounded-lg border border-[#bddbd3] bg-[#edf7f4] p-3 text-[11px] leading-[1.55] text-[#2e6f63]',
  field: 'mt-4 grid gap-2 [&_label]:text-[11px] [&_label]:font-semibold [&_label]:text-ink',
  label: 'text-[11px] font-semibold text-ink',
  fieldHint: 'text-[9.5px] leading-[1.45] text-muted',
  actionNote: 'mt-3',
  input:
    'w-full min-h-10 rounded-lg border border-field bg-surface px-3 py-2 text-[12px] text-ink placeholder:text-[#8a98a9] hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none',
  textarea:
    'min-h-[128px] w-full resize-y rounded-lg border border-field bg-surface px-3 py-3 text-[12.5px] leading-[1.62] text-ink placeholder:text-[#8a98a9] hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none',
  select:
    'w-full min-h-10 rounded-lg border border-field bg-surface px-3 py-2 text-[12px] text-ink hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none',
  between: 'flex items-start justify-between gap-3',
  button:
    'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-4 py-2 text-[11px] leading-4 font-semibold text-white transition-colors duration-150 hover:not-disabled:border-primary-strong hover:not-disabled:bg-primary-strong active:not-disabled:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-45',
  buttonWide: 'mt-4 w-full',
  secondary:
    '!border-field !bg-surface !text-primary hover:not-disabled:!border-primary hover:not-disabled:!bg-soft',
  danger:
    '!border-[#e0c4c2] !bg-surface !text-[#a33b3b] hover:not-disabled:!border-[#c88f8b] hover:not-disabled:!bg-[#fff4f3]',
  compact: 'min-h-8 px-3 py-1 text-[10px]',
  copied: '!border-[#9bc8b8] !bg-[#edf7f4] !text-proof',
  check:
    'my-3 flex items-start gap-3 text-[11.5px] leading-[1.55] text-ink [&_input]:mt-1 [&_input]:size-4 [&_input]:shrink-0 [&_input]:accent-primary',
  choiceGroup: 'mt-4 grid gap-2',
  checkCard:
    'm-0 rounded-lg border border-rule bg-soft p-3 has-[input:checked]:border-[#9bbebc] has-[input:checked]:bg-[#edf7f4]',
  scopeCard:
    'my-4 grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-rule bg-soft p-3 [&_b]:block [&_b]:text-xs [&_b]:text-ink [&_small]:mt-1 [&_small]:block [&_small]:text-[9.5px] [&_small]:text-muted',
  scopeIcon:
    'grid size-8 place-items-center rounded-md bg-[#0a66c2] text-[11px] font-bold text-white',
  scopeGranted:
    'rounded-full bg-[#e3f1ee] px-2 py-1 font-utility text-[8.5px] font-semibold text-proof uppercase',
  scopePending:
    'rounded-full bg-tint px-2 py-1 font-utility text-[8.5px] font-semibold text-muted uppercase',
  switch:
    'h-6 w-[42px] shrink-0 rounded-full border-0 bg-field p-[3px] transition-colors duration-150 data-[state=checked]:bg-primary',
  thumb:
    'block size-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-transform duration-150 data-[state=checked]:translate-x-[18px]',
  tabs: 'fixed right-3 bottom-3 left-3 z-20 grid grid-cols-3 rounded-[10px] border border-rule bg-surface/95 p-1 shadow-[0_8px_24px_rgba(32,50,71,.12)] backdrop-blur-md',
  tab: 'min-h-10 rounded-md border-0 bg-transparent px-2 text-[11px] font-semibold text-muted data-[state=active]:bg-primary data-[state=active]:text-white',
  tabContent: '[animation:reveal-work_160ms_ease-out] motion-reduce:animate-none',
  list: 'mt-2 list-disc pl-4 text-[11.5px] leading-[1.6] text-muted [&_li+li]:mt-1',
  badge:
    'inline-block rounded-full border border-rule bg-soft px-2 py-1 font-utility text-[8px] font-semibold tracking-[.03em] text-muted uppercase',
  meta: 'font-utility text-[9px] leading-[1.4] text-muted',
  discoverySettings: 'mb-4 grid gap-3 [&>*]:mb-0',
  settingsDisclosure:
    'group !p-0 [&>summary]:flex [&>summary]:cursor-pointer [&>summary]:list-none [&>summary]:items-center [&>summary]:justify-between [&>summary]:gap-4 [&>summary]:p-4 [&>summary::-webkit-details-marker]:hidden [&>summary_small]:mt-1 [&>summary_small]:block [&>summary_small]:text-[9.5px] [&>summary_small]:leading-[1.4] [&>summary_small]:text-muted [&[open]>summary]:border-b [&[open]>summary]:border-rule',
  settingsDisclosureBody: 'p-4 !pt-2',
  disclosureIcon:
    'relative size-6 shrink-0 rounded-md border border-rule bg-soft before:absolute before:top-1/2 before:left-1/2 before:h-px before:w-2 before:-translate-x-1/2 before:-translate-y-1/2 before:bg-muted before:content-["_"] after:absolute after:top-1/2 after:left-1/2 after:h-px after:w-2 after:-translate-x-1/2 after:-translate-y-1/2 after:rotate-90 after:bg-muted after:content-["_"] group-open:after:opacity-0',
  credentialActions: 'mt-1 flex items-center justify-between gap-3',
  keyGuide:
    'mt-1 rounded-lg border border-rule bg-soft text-[10px] text-muted [&>summary]:cursor-pointer [&>summary]:list-none [&>summary]:px-3 [&>summary]:py-2 [&>summary]:font-semibold [&>summary]:text-primary [&>summary::-webkit-details-marker]:hidden [&>summary]:after:ml-2 [&>summary]:after:content-["+"] [&[open]>summary]:border-b [&[open]>summary]:border-rule [&[open]>summary]:after:content-["−"] [&>div]:p-3 [&_ol]:m-0 [&_ol]:grid [&_ol]:gap-2 [&_ol]:pl-4 [&_a]:mt-3 [&_a]:inline-block [&_a]:font-semibold [&_a]:text-primary',
  textButton:
    'min-h-8 border-0 bg-transparent px-0 py-1 text-[10px] font-semibold text-primary hover:underline hover:underline-offset-2',
  textDanger: 'text-[#a33b3b]',
  voiceHeaderRow:
    'mt-3 mb-1 flex items-start justify-between gap-3 max-[520px]:flex-col max-[520px]:items-stretch [&>label]:mt-1 [&>label]:shrink-0',
  discoveryActionCard: 'grid gap-3',
  actionCardMain:
    'flex items-start justify-between gap-3 [&>div:last-child]:!mt-0 [&>div:last-child]:justify-end max-[520px]:flex-col max-[520px]:items-stretch max-[520px]:[&>div:last-child]:!mt-3 max-[520px]:[&_button]:w-full',
  sourceList: 'my-3 grid gap-2',
  sourceRow:
    'flex items-center justify-between gap-3 rounded-lg border border-rule bg-soft p-3 has-[input:checked]:border-[#9bbebc] has-[input:checked]:bg-[#edf7f4] [&_label]:flex [&_label]:min-w-0 [&_label]:items-center [&_label]:gap-2 [&_label]:text-[11px] [&_label]:text-ink [&_label>span]:grid [&_label>span]:gap-1 [&_small]:text-[9px] [&_small]:text-muted',
  smallSelect: 'w-14 rounded-md border border-field bg-surface p-2 text-[11px] text-ink',
  fieldGrid: 'grid grid-cols-1 gap-0',
  voiceSample: 'mt-3 grid gap-2',
  buttonRow: 'mt-3 flex flex-wrap items-center gap-2',
  badgeRow: 'flex flex-wrap items-center gap-2',
  discoveryHero: 'border-rule bg-surface',
  segmentedTabs:
    'my-1 mb-4 grid grid-cols-2 gap-1 rounded-lg border border-rule bg-tint p-1 [&_button]:flex [&_button]:min-h-9 [&_button]:items-center [&_button]:justify-center [&_button]:gap-2 [&_button]:rounded-md [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-2 [&_button]:text-[10px] [&_button]:font-semibold [&_button]:text-muted [&_button[data-active=true]]:bg-surface [&_button[data-active=true]]:text-primary [&_button_span]:font-utility [&_button_span]:text-[8px]',
  discoveryStats:
    'mb-3 grid grid-cols-3 divide-x divide-rule rounded-lg border border-rule bg-soft py-3 [&_span]:grid [&_span]:gap-1 [&_span]:px-3 [&_span]:text-left [&_span]:font-utility [&_span]:text-[8px] [&_span]:text-muted [&_b]:font-body [&_b]:text-sm [&_b]:text-ink [&_i]:relative [&_i]:mt-1 [&_i]:block [&_i]:h-1 [&_i]:overflow-hidden [&_i]:rounded-full [&_i]:bg-tint [&_i]:after:absolute [&_i]:inset-y-0 [&_i]:left-0 [&_i]:w-[var(--meter)] [&_i]:rounded-full [&_i]:bg-proof [&_i]:content-["_"]',
  opportunityList: 'grid gap-3',
  progressStatus:
    'mt-3 flex items-center gap-3 rounded-lg border border-rule bg-soft p-3 text-[10.5px] font-semibold text-ink [&>div:first-child]:size-[18px]',
  opportunityCard:
    'grid gap-3 p-4 [&>div:first-child]:items-start [&>div:first-child>span:last-child]:max-w-[42%] [&>div:first-child>span:last-child]:text-right',
  opportunityTitle: 'text-[13px] leading-[1.4] text-ink',
  opportunitySummary: 'line-clamp-2 overflow-hidden text-[11px] leading-[1.5] text-muted',
  disclosureButton:
    'flex min-h-9 w-full items-center justify-between border-0 border-t border-rule bg-transparent pt-2 text-[10px] font-semibold text-proof [&_span]:text-sm [&_span]:font-normal',
  opportunityDetails: 'grid gap-3 border-t border-rule pt-3',
  assessmentGrid:
    'grid gap-3 [&>div]:border-l-2 [&>div]:border-[#a8c6c3] [&>div]:pl-3 [&_dt]:font-utility [&_dt]:text-[8.5px] [&_dt]:font-semibold [&_dt]:text-muted [&_dt]:uppercase [&_dd]:mt-1 [&_dd]:text-[11px] [&_dd]:leading-[1.5] [&_dd]:text-muted',
  ratingStrong: 'border-[#a8c6c3] bg-[#edf7f4] text-proof',
  ratingSkip: 'border-[#e3c1bf] bg-[#fff4f3] text-[#963b3b]',
  publicationDraft: 'border-t border-rule pt-3',
  draftHeading:
    'flex items-start justify-between gap-3 max-[520px]:flex-col max-[520px]:items-stretch [&_small]:mt-1 [&_small]:block [&_small]:text-[9px] [&_small]:text-muted [&>span:last-child]:max-w-[48%] [&>span:last-child]:shrink-0 [&>span:last-child]:text-right [&>span:last-child]:whitespace-nowrap max-[520px]:[&>span:last-child]:max-w-full max-[520px]:[&>span:last-child]:text-left',
  publicationTextarea: 'mt-3 min-h-[190px]',
  publicationActions:
    'mt-3 grid grid-cols-2 gap-2 [&>button]:w-full [&>button:nth-child(3)]:col-span-2',
  generateActions: 'flex gap-2 [&>button]:min-w-0 [&>button]:flex-1',
  evidenceBoundary:
    'rounded-lg border border-rule bg-soft p-3 text-[9.5px] leading-[1.5] text-muted',
  publicationHistoryItem:
    'group overflow-hidden rounded-lg border border-rule bg-surface [&>summary]:flex [&>summary]:min-h-12 [&>summary]:cursor-pointer [&>summary]:list-none [&>summary]:items-center [&>summary]:justify-between [&>summary]:gap-4 [&>summary]:p-3 [&>summary::-webkit-details-marker]:hidden [&>summary>span:first-child]:grid [&>summary>span:first-child]:min-w-0 [&>summary>span:first-child]:gap-1 [&_b]:line-clamp-2 [&_b]:overflow-hidden [&_b]:text-[11px] [&_b]:leading-[1.4] [&_b]:text-ink [&_small]:text-[9px] [&_small]:text-muted',
  historyLibrary: 'p-4',
  historyHeader: 'mb-3 flex items-start justify-between gap-3',
  historyList: 'grid gap-3',
  historyItemBody: 'border-t border-rule p-3 [&>button]:mt-3',
  historyActions: 'mt-3 grid grid-cols-3 gap-2 [&>*]:min-h-10 [&>*]:w-full [&>*]:px-2',
  setupLayout:
    'grid grid-cols-[180px_minmax(0,1fr)] items-start gap-8 max-[680px]:grid-cols-1 max-[680px]:gap-4',
  setupMain: 'min-w-0',
  wizardStepper:
    'sticky top-[100px] grid gap-6 max-[680px]:static max-[680px]:flex max-[680px]:gap-4 max-[680px]:overflow-x-auto max-[680px]:border-b max-[680px]:border-rule max-[680px]:pb-3',
  wizardPhase:
    'min-w-[150px] max-[680px]:min-w-[140px] [&>p]:mb-2 [&>p]:font-utility [&>p]:text-[9px] [&>p]:font-semibold [&>p]:tracking-[.08em] [&>p]:text-muted [&>p]:uppercase [&_ol]:m-0 [&_ol]:grid [&_ol]:gap-1 [&_ol]:p-0 [&_ol]:list-none [&_button]:flex [&_button]:min-h-9 [&_button]:w-full [&_button]:items-center [&_button]:gap-2 [&_button]:rounded-md [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-2 [&_button]:text-left [&_button]:text-[10.5px] [&_button]:font-semibold [&_button]:text-muted [&_button:hover:not(:disabled)]:bg-tint [&_button[data-current=true]]:bg-tint [&_button[data-current=true]]:text-primary [&_button:disabled]:cursor-wait [&_button:disabled]:opacity-50',
  wizardStepNumber:
    'grid size-5 shrink-0 place-items-center rounded-full border border-field bg-surface font-utility text-[8px] font-semibold text-muted [[data-current=true]_&]:border-primary [[data-current=true]_&]:bg-primary [[data-current=true]_&]:text-white [[data-complete=true]_&]:border-[#a8c6c3] [[data-complete=true]_&]:text-proof',
  wizardStepLabel: 'block truncate',
  wizardCard:
    'border-rule !p-6 before:absolute before:top-3 before:bottom-3 before:left-0 before:w-[3px] before:rounded-r-full before:bg-proof before:content-["_"] max-[520px]:!p-4',
  wizardActions:
    'sticky bottom-3 z-10 mt-4 flex justify-end gap-2 rounded-[10px] border border-rule bg-surface/95 p-2 backdrop-blur-md',
  profileEditor: 'mt-4 grid gap-3',
  profileSection: 'rounded-lg border border-rule bg-soft p-4',
  profileSectionHeading:
    'mb-3 flex items-start gap-3 [&>span]:grid [&>span]:size-6 [&>span]:shrink-0 [&>span]:place-items-center [&>span]:rounded-md [&>span]:border [&>span]:border-rule [&>span]:bg-surface [&>span]:font-utility [&>span]:text-[8px] [&>span]:font-semibold [&>span]:text-proof [&_b]:text-xs [&_b]:text-ink [&_small]:block [&_small]:text-[9.5px] [&_small]:leading-[1.45] [&_small]:text-muted',
  preferenceRow:
    'flex items-center justify-between gap-4 border-t border-rule py-3 [&_b]:text-xs [&_b]:text-ink [&_small]:block [&_small]:text-[9.5px] [&_small]:leading-[1.45] [&_small]:text-muted',
  spinner:
    'size-5 shrink-0 rounded-full border-2 border-field border-t-primary [animation:proof-spin_.8s_linear_infinite] motion-reduce:animate-none',
} as const;

export default styles;
