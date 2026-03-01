export const HELP_CENTER_LAST_UPDATED = 'March 1, 2026';

export const HELP_MENU_LINKS = [
  { key: 'workflow', label: 'How It Works', path: '/workflow', icon: '📖' },
  { key: 'white-papers', label: 'White Papers', path: '/white-papers', icon: '📄' },
  { key: 'user-guide', label: 'User Guide', path: '/user-guide', icon: '🧭' },
  { key: 'buddy', label: 'CatBot Buddy', path: '/buddy', icon: '🐈‍⬛' },
];

export const BUDDY_HELP_TOPICS = [
  {
    key: 'lighting-guide',
    label: 'User Guide: Lighting + Sound',
    path: '/user-guide#lighting-sound-documentation',
    summary: 'Open the practical setup flow for channel charts, patch docs, and pre-show verification.',
    prompt: 'Show me the User Guide section on Lighting and Sound.',
  },
  {
    key: 'timeline-help',
    label: 'Timeline Editor Help',
    path: '/user-guide#using-timeline-editor',
    summary: 'Open the cue editing workflow for segment mode, timecode mode, and versioned paperwork refresh.',
    prompt: 'Take me to Timeline Editor help.',
  },
  {
    key: 'risk-white-paper',
    label: 'Risk Architecture White Paper',
    path: '/white-papers#wp-bridging-creative-compliance-risk-aware-event-architecture',
    summary: 'Open the policy and risk architecture paper for city, insurance, and board conversations.',
    prompt: 'Open the White Paper on risk-aware event architecture.',
  },
  {
    key: 'google-sync-guide',
    label: 'Calendar + Google Sync',
    path: '/user-guide#rehearsal-calendar-google-sync',
    summary: 'Open the sync-first scheduling workflow for rehearsals, calls, and deadlines.',
    prompt: 'Show me how Google Calendar sync works in IMC Machine.',
  },
];

const CORE_GUIDE_LINKS = {
  workflow: '/workflow',
  userGuide: '/user-guide',
  whitePapers: '/white-papers',
  buddy: '/buddy',
};

export const USER_GUIDE = {
  title: 'How to Use IMC Machine',
  version: 'v1.0',
  updatedAt: HELP_CENTER_LAST_UPDATED,
  intro: [
    'Welcome in. I built this guide so you can move fast, stay organized, and keep your team aligned even when show week gets loud.',
    'You can read straight through, or jump directly to the section you need. Every section tells you what it does, why it matters, and exactly what to do next.',
    'If you want help in real time, open CatBot Buddy and ask for the matching section by name.',
  ],
  links: CORE_GUIDE_LINKS,
  sections: [
    {
      id: 'getting-started',
      title: '1. Getting Started',
      whatItDoes: 'Sets your account profile, role lens, and base defaults so every module behaves the way your team actually works.',
      whyItMatters: 'Clean setup prevents bad data from leaking into staffing, contracts, and distribution.',
      steps: [
        'Create your account and choose your role stack. Use multiple roles if one person covers multiple jobs.',
        'Add core profile identity: business name, contact channels, timezone, and emergency coverage.',
        'Set floating controls and mobile preferences in Settings so daily use is friction-free.',
      ],
      proTips: [
        'If your venue team is small, save one baseline profile and duplicate from there.',
        'Use AI Intake to prefill profile details from existing bios or onboarding docs.',
      ],
      commonMistakes: [
        'Skipping timezone setup, then wondering why call times drift.',
        'Leaving emergency contacts blank before staffing publish.',
      ],
      modeGuidance: 'Basic mode is enough for pilot teams. Use Pro mode once you need stricter operations controls.',
    },
    {
      id: 'creating-first-event',
      title: '2. Creating Your First Event',
      whatItDoes: 'Builds the event record that every downstream module uses.',
      whyItMatters: 'If event foundations are weak, everything else becomes manual cleanup.',
      steps: [
        'Open Start Event and fill core fields: title, date, venue, and event type.',
        'Use AI Assist to paste email threads, speak notes, or upload documents to prefill details.',
        'Confirm official assets and lock poster/flyer policy before campaign generation.',
      ],
      proTips: [
        'Use recurring event options for repeating shows and workshops.',
        'Set ticketing provider now so reporting stays connected.',
      ],
      commonMistakes: [
        'Publishing campaigns before start/end times are final.',
        'Forgetting to select a performance zone for multi-zone venues.',
      ],
      modeGuidance: 'Basic mode keeps it short. Pro mode adds deeper production and ticketing controls.',
    },
    {
      id: 'building-plots-layouts',
      title: '3. Building Plots and Layouts',
      whatItDoes: 'Creates your visual and structured event layouts for stage, room, gallery, or vendor footprints.',
      whyItMatters: 'Plots eliminate assumptions and let departments execute from one shared map.',
      steps: [
        'Open Production Ops > Event Ops and start a plot template.',
        'Set dimensions, zones, and infrastructure layers.',
        'Place objects, add labels, and assign owner or department where needed.',
      ],
      proTips: [
        'Use layer toggles to keep the view clean during meetings.',
        'Duplicate plots per act, scene, or session instead of rebuilding.',
      ],
      commonMistakes: [
        'Using one layout for all scenes when timing and placement actually change.',
        'Skipping custom labels and leaving crew to guess object purpose.',
      ],
      modeGuidance: 'Basic mode handles standard floor plans. Pro mode unlocks discipline-level paperwork links.',
    },
    {
      id: 'lighting-sound-documentation',
      title: '4. Lighting and Sound Documentation',
      whatItDoes: 'Organizes lighting and sound metadata into paperwork your technical team can trust.',
      whyItMatters: 'Structured docs reduce cue errors, line-check delays, and patch confusion.',
      steps: [
        'Set fixture or input metadata on each object.',
        'Review channel and patch mappings before rehearsal.',
        'Export paperwork packets for LX and Sound handoff.',
      ],
      proTips: [
        'Use House vs Show overlays so permanent infrastructure stays separate from show adds.',
        'Store recurring consoles and fixtures in the equipment library for reuse.',
      ],
      commonMistakes: [
        'Treating notes as optional when they carry setup-critical context.',
        'Failing to publish updated paperwork after timeline edits.',
      ],
      modeGuidance: 'Basic mode gives quick docs. Pro mode includes expanded metadata and routing detail.',
    },
    {
      id: 'using-timeline-editor',
      title: '5. Using the Timeline Editor',
      whatItDoes: 'Controls cue timing visually across Run of Show, LX, Sound, Deck, and Projection tracks.',
      whyItMatters: 'It keeps departments synced to the same timing truth.',
      steps: [
        'Open Run of Show and switch to timeline view.',
        'Choose Segment mode for flexible timing or Timecode mode for fixed playback.',
        'Drag cues, trim durations, and lock confirmed cues before publish.',
      ],
      proTips: [
        'Use snap controls during cue-to-cue to avoid accidental offset drift.',
        'Group linked cues across departments when one trigger drives many actions.',
      ],
      commonMistakes: [
        'Editing in a live meeting without saving session notes.',
        'Ignoring dirty flags on paperwork after major timing changes.',
      ],
      modeGuidance: 'Basic mode for simple shows. Pro mode for dense cue stacks and version control.',
    },
    {
      id: 'cue-management',
      title: '6. Cue Management',
      whatItDoes: 'Maintains consistent cue IDs, trigger logic, and assignment ownership.',
      whyItMatters: 'Reliable cue naming and ownership prevents missed calls in high-pressure windows.',
      steps: [
        'Standardize cue tags by department and sequence.',
        'Set standby and go-call notes for each cue.',
        'Assign cue owners so accountability is explicit.',
      ],
      proTips: [
        'Keep one naming standard across all productions.',
        'Use linked cue groups for sequence-heavy sections.',
      ],
      commonMistakes: [
        'Reusing cue numbers after publish without versioning.',
        'Leaving trigger source blank for action-based cues.',
      ],
      modeGuidance: 'Basic mode supports small cue lists. Pro mode supports advanced linking and audit trace.',
    },
    {
      id: 'rehearsal-mode',
      title: '7. Rehearsal Mode',
      whatItDoes: 'Captures rehearsal-driven timing and ops adjustments without breaking live production baselines.',
      whyItMatters: 'Rehearsal edits are valuable, but they need controlled promotion into published docs.',
      steps: [
        'Tag rehearsal snapshots by session name.',
        'Capture notes and timing changes as you rehearse.',
        'Promote only approved changes into the published show package.',
      ],
      proTips: [
        'Use snapshot naming that maps to your production calendar.',
        'Keep one person responsible for final publish decisions.',
      ],
      commonMistakes: [
        'Mixing rehearsal experiments with published show docs.',
        'Skipping session summaries and losing context later.',
      ],
      modeGuidance: 'Basic mode tracks simple notes. Pro mode supports richer snapshots and traceability.',
    },
    {
      id: 'auto-versioned-paperwork',
      title: '8. Auto-Versioned Paperwork',
      whatItDoes: 'Regenerates and versions technical paperwork when timing or structure changes.',
      whyItMatters: 'Version control gives teams proof of what changed, when, and why.',
      steps: [
        'Review dirty flags after timeline or plot edits.',
        'Generate a new paperwork version and add change notes.',
        'Publish the right version for crew and stakeholders.',
      ],
      proTips: [
        'Batch edits in one session to avoid version spam.',
        'Keep prior versions available for rollback confidence.',
      ],
      commonMistakes: [
        'Overwriting without notes, then losing historical clarity.',
        'Distributing draft docs as if they were final.',
      ],
      modeGuidance: 'Basic mode can run manual versions. Pro mode automates most regeneration workflows.',
    },
    {
      id: 'projection-video',
      title: '9. Projection and Video',
      whatItDoes: 'Runs projection and video as a first-class department with routing, cueing, and paperwork.',
      whyItMatters: 'Projection failures are often routing failures, not content failures.',
      steps: [
        'Map video objects and outputs in the plot.',
        'Attach asset specs and playback notes.',
        'Generate projection cue lists and output maps before final rehearsal.',
      ],
      proTips: [
        'Define signal type and fallback path per output.',
        'Track confidence monitor coverage during rehearsals.',
      ],
      commonMistakes: [
        'Not documenting media versions alongside cue versions.',
        'Assuming source and destination frame rates match.',
      ],
      modeGuidance: 'Basic mode supports simple projector workflows. Pro mode supports full routing documentation.',
    },
    {
      id: 'safety-risk-management',
      title: '10. Safety and Risk Management',
      whatItDoes: 'Centralizes event risk profile, permits, readiness checks, and emergency response planning.',
      whyItMatters: 'Safety quality determines operational continuity and stakeholder trust.',
      steps: [
        'Set event risk factors and review calculated risk level.',
        'Attach permits, insurance records, and assigned owners.',
        'Generate and publish Emergency Action Plan packet.',
      ],
      proTips: [
        'Run readiness checks before doors and again before high-traffic windows.',
        'Use plot overlays for egress and safety object placement.',
      ],
      commonMistakes: [
        'Treating permits as file storage only, without expiration management.',
        'Skipping city or venue coordination notes in command plans.',
      ],
      modeGuidance: 'Basic mode covers required safety records. Pro mode adds surveillance and advanced compliance visibility.',
    },
    {
      id: 'insurance-permits',
      title: '11. Insurance and Permits',
      whatItDoes: 'Tracks policy coverage and permit status with owner accountability.',
      whyItMatters: 'Coverage gaps can block events or create avoidable legal exposure.',
      steps: [
        'Add policy details, limits, and expiration dates.',
        'Upload certificates and permit files with status tracking.',
        'Assign responsible contacts and alert cadence.',
      ],
      proTips: [
        'Use role-based assignments so renewals are never orphaned.',
        'Match policy adequacy against event risk class.',
      ],
      commonMistakes: [
        'Storing PDFs without structured metadata.',
        'Failing to mark venue or city additional insured requirements.',
      ],
      modeGuidance: 'Basic mode tracks essentials. Pro mode gives broader compliance and escalation workflows.',
    },
    {
      id: 'surveillance-access-control',
      title: '12. Surveillance and Access Control',
      whatItDoes: 'Plans and tracks monitoring, credential checkpoints, and controlled access zones.',
      whyItMatters: 'Security readiness depends on clear ownership and route design.',
      steps: [
        'Map camera and checkpoint objects in plots.',
        'Assign channel ownership and backup plans.',
        'Document entry flow for cast, crew, vendors, and public.',
      ],
      proTips: [
        'Pair monitoring stations with communication channels.',
        'Document emergency access overrides before show day.',
      ],
      commonMistakes: [
        'Placing screening points without flow analysis.',
        'Leaving surveillance retention policy undefined.',
      ],
      modeGuidance: 'Basic mode supports checklist-level control. Pro mode supports deeper monitoring governance.',
    },
    {
      id: 'setlists',
      title: '13. Setlists',
      whatItDoes: 'Tracks performance order, transitions, and performer-level timing flow.',
      whyItMatters: 'Setlist clarity drives both stage timing and audience experience.',
      steps: [
        'Build set order and planned durations.',
        'Attach transition notes and changeover needs.',
        'Sync final setlist into Run of Show and distribution copy where needed.',
      ],
      proTips: [
        'Store alternate set variants for flexible runtime control.',
        'Mark hard stop times directly in setlist notes.',
      ],
      commonMistakes: [
        'Treating setlists as separate from production timing.',
        'Skipping changeover durations in live run planning.',
      ],
      modeGuidance: 'Basic mode handles simple lineups. Pro mode supports tighter timeline integration.',
    },
    {
      id: 'rehearsal-calendar-google-sync',
      title: '14. Rehearsal Calendar and Google Sync',
      whatItDoes: 'Schedules rehearsals, calls, meetings, and dated tasks with Google Calendar synchronization.',
      whyItMatters: 'Calendar sync is the backbone for date-based execution across teams.',
      steps: [
        'Connect organization calendar settings in the calendar module.',
        'Create dated records through IMC Machine so sync mapping stays consistent.',
        'Confirm update and cancellation behavior before high-volume scheduling weeks.',
      ],
      proTips: [
        'Keep one source-of-truth calendar policy per organization.',
        'Use type templates so call naming stays consistent.',
      ],
      commonMistakes: [
        'Creating dated records outside calendar workflows, then expecting sync.',
        'Ignoring timezone mismatches between org defaults and event records.',
      ],
      modeGuidance: 'Basic mode supports one-way operational sync. Pro mode can add stricter reconciliation policies.',
    },
    {
      id: 'equipment-recognition',
      title: '15. Equipment Recognition',
      whatItDoes: 'Uses AI-assisted intake to recognize fixture and equipment metadata from photos.',
      whyItMatters: 'Fast equipment capture reduces manual inventory setup and improves documentation quality.',
      steps: [
        'Upload equipment images from labels, fixtures, or racks.',
        'Review extracted make/model and confidence suggestions.',
        'Confirm final values before saving to equipment library.',
      ],
      proTips: [
        'Capture one clear photo of each label plate for best results.',
        'Require human confirmation on uncertain reads.',
      ],
      commonMistakes: [
        'Saving low-confidence suggestions without verification.',
        'Skipping library categorization after confirmation.',
      ],
      modeGuidance: 'Basic mode supports manual confirmation flow. Pro mode supports larger inventory pipelines.',
    },
    {
      id: 'exporting-technical-packets',
      title: '16. Exporting Technical Packets',
      whatItDoes: 'Builds stakeholder-ready packets for production, safety, and communications.',
      whyItMatters: 'Clean packets prove readiness and speed up approvals.',
      steps: [
        'Select the packet preset that matches the audience.',
        'Choose sensitive-data visibility settings before export.',
        'Export to PDF or share links with stakeholder-specific access.',
      ],
      proTips: [
        'Use sanitized exports for board or sponsor audiences.',
        'Include version stamps on packet cover pages.',
      ],
      commonMistakes: [
        'Sharing unsanitized contact data externally.',
        'Exporting before checklist completion status is current.',
      ],
      modeGuidance: 'Basic mode is enough for quick sharing. Pro mode supports richer packet compositions.',
    },
    {
      id: 'collaboration-sharing',
      title: '17. Collaboration and Sharing',
      whatItDoes: 'Controls plot, document, and workflow permissions across event, organization, and venue scopes.',
      whyItMatters: 'Good permissions let teams move fast without losing control.',
      steps: [
        'Set owner, editor, commenter, and viewer permissions.',
        'Publish versions when changes are ready for operational use.',
        'Use role-based sharing for department-specific access.',
      ],
      proTips: [
        'Publish only after a final review pass by the responsible lead.',
        'Use version notes so collaborators understand what changed.',
      ],
      commonMistakes: [
        'Granting broad edit rights when comment-only access is safer.',
        'Forgetting to republish after critical changes.',
      ],
      modeGuidance: 'Basic mode supports straightforward collaboration. Pro mode gives tighter governance.',
    },
    {
      id: 'best-practices',
      title: '18. Best Practices',
      whatItDoes: 'Gives your team a repeatable operating rhythm from intake to closeout.',
      whyItMatters: 'Consistency is the difference between heroics and reliable operations.',
      steps: [
        'Run a weekly readiness review by section owner.',
        'Require checklist completion before major publish actions.',
        'Close each event with debrief notes and carry improvements forward.',
      ],
      proTips: [
        'Keep one owner per section even if multiple people execute tasks.',
        'Use Buddy for fast routing, then execute in the right module.',
      ],
      commonMistakes: [
        'Treating process documentation as optional during busy weeks.',
        'Skipping post-production learnings after successful events.',
      ],
      modeGuidance: 'Basic mode works for solo or tiny teams. Pro mode supports larger team accountability.',
    },
  ],
};

const WHITE_PAPER_SECTION_ORDER = [
  { key: 'executiveSummary', title: 'Executive Summary' },
  { key: 'problemStatement', title: 'Problem Statement' },
  { key: 'industryContext', title: 'Industry Context' },
  { key: 'imcSolution', title: 'IMC Machine Solution' },
  { key: 'technicalArchitecture', title: 'Technical Architecture Overview' },
  { key: 'operationalBenefits', title: 'Operational Benefits' },
  { key: 'riskReductionBenefits', title: 'Risk Reduction Benefits' },
  { key: 'versionComplianceAdvantages', title: 'Version Control and Compliance Advantages' },
  { key: 'futureRoadmap', title: 'Future Roadmap' },
  { key: 'conclusion', title: 'Conclusion' },
];

export const WHITE_PAPERS = [
  {
    id: 'wp-reinventing-production-infrastructure-unified-digital-backbone-live-events',
    title: 'Reinventing Production Infrastructure: A Unified Digital Backbone for Live Events',
    version: 'v1.0',
    updatedAt: HELP_CENTER_LAST_UPDATED,
    audience: 'Investors, producers, venue operators, public funding partners',
    sections: {
      executiveSummary: 'Live events are still managed through disconnected tools, inbox chains, and last-minute spreadsheets. IMC Machine unifies planning, production, compliance, and distribution in one operating system so teams can execute with speed and evidence.',
      problemStatement: 'Most teams still separate creative planning from operations data. That gap causes duplicate work, version confusion, and failure points during high-pressure windows such as load-in, tech, doors, and settlement.',
      industryContext: 'The modern live-event market expects professional documentation standards from small clubs up through institutional theaters. Teams need enterprise-grade control with small-team usability.',
      imcSolution: 'IMC Machine links events, plots, staffing, safety, risk, calendar, and distribution so each department works from one trusted record. The platform supports both simple workflows and pro-level technical depth.',
      technicalArchitecture: 'The architecture centers around event-linked entities, reusable libraries, role-aware permissions, and versioned artifacts. Module data is synchronized through shared identifiers so updates propagate without manual re-entry.',
      operationalBenefits: 'Teams reduce setup time, avoid redundant data entry, and move from reactive troubleshooting to proactive coordination. Department leads get clear ownership, cleaner handoffs, and faster decision cycles.',
      riskReductionBenefits: 'Risk scoring, permits, insurance, incident tracking, and emergency planning are integrated into operations instead of being separate compliance paperwork. This lowers exposure and improves readiness.',
      versionComplianceAdvantages: 'Versioned paperwork and publish states create auditable history. Teams can prove what was approved and when, which supports unions, city review, insurance, and internal governance.',
      futureRoadmap: 'Next phases include deeper connectors, stronger analytics, and role-specific automation packs while keeping a single operational source of truth.',
      conclusion: 'A unified backbone is no longer optional for modern live production. IMC Machine turns fragmented operations into disciplined execution.',
    },
    versionHistory: [
      { version: 'v1.0', date: HELP_CENTER_LAST_UPDATED, notes: 'Initial white paper release.' },
    ],
  },
  {
    id: 'wp-from-stage-plot-to-emergency-action-plan-fully-integrated-event-operations-framework',
    title: 'From Stage Plot to Emergency Action Plan: A Fully Integrated Event Operations Framework',
    version: 'v1.0',
    updatedAt: HELP_CENTER_LAST_UPDATED,
    audience: 'City partners, venue management, production teams, safety officers',
    sections: {
      executiveSummary: 'Operational systems fail when technical planning and safety planning are disconnected. IMC Machine links both into one workflow from plot design through emergency readiness.',
      problemStatement: 'Production teams often create stage and technical documents without integrated permit, insurance, and emergency context. Safety teams then operate from separate documents and stale data.',
      industryContext: 'Regulatory and public safety expectations continue to rise for gatherings, especially in mixed-use spaces and multi-stage environments.',
      imcSolution: 'IMC Machine provides shared event context across plots, staffing, security, surveillance, and emergency workflows. Departments coordinate from the same environment with controlled permissions.',
      technicalArchitecture: 'Safety objects, egress layers, and risk metadata are tied to event and layout records. Emergency Action Plans are generated from live data rather than static templates.',
      operationalBenefits: 'Teams move faster in prep meetings, coordinate checkpoints and response roles earlier, and avoid day-of-show surprises created by fragmented planning.',
      riskReductionBenefits: 'Integrated risk scoring and readiness checks improve coverage for crowd flow, medical response, and escalation protocol.',
      versionComplianceAdvantages: 'Safety artifacts and updates are traceable by publish state and timestamp, supporting inspections and post-event review.',
      futureRoadmap: 'Planned enhancements include smarter alerting, advanced monitoring integrations, and scenario simulation.',
      conclusion: 'When safety and production share a system, teams can execute confidently while meeting modern compliance expectations.',
    },
    versionHistory: [
      { version: 'v1.0', date: HELP_CENTER_LAST_UPDATED, notes: 'Initial white paper release.' },
    ],
  },
  {
    id: 'wp-version-controlled-technical-documentation-live-production-environments',
    title: 'Version-Controlled Technical Documentation in Live Production Environments',
    version: 'v1.0',
    updatedAt: HELP_CENTER_LAST_UPDATED,
    audience: 'Technical directors, union teams, production managers, board oversight',
    sections: {
      executiveSummary: 'Live production teams need documentation discipline similar to software release management. IMC Machine applies versioned control to technical paperwork and operational artifacts.',
      problemStatement: 'Teams still circulate conflicting PDFs with unclear ownership and no changelog. This causes operational errors and accountability gaps.',
      industryContext: 'High-complexity production now spans lighting, sound, projection, safety, and staffing layers. Change velocity is high, especially during rehearsal and tech.',
      imcSolution: 'IMC Machine marks impacted artifacts as out-of-date, regenerates documentation, and tracks version histories tied to timeline and layout edits.',
      technicalArchitecture: 'Artifacts are versioned by department with draft/published states, author attribution, timestamps, and change summaries linked to event snapshots.',
      operationalBenefits: 'Department heads get cleaner handoffs, fewer miscommunications, and faster confidence in what is current.',
      riskReductionBenefits: 'Versioned control lowers the chance of executing from stale cue sheets or outdated patch documentation.',
      versionComplianceAdvantages: 'Auditable records support internal QA, external compliance checks, and contractual accountability.',
      futureRoadmap: 'Future releases will deepen release governance and offer richer comparison tooling between versions.',
      conclusion: 'Version control is the operational safety net live production has needed for years.',
    },
    versionHistory: [
      { version: 'v1.0', date: HELP_CENTER_LAST_UPDATED, notes: 'Initial white paper release.' },
    ],
  },
  {
    id: 'wp-bridging-creative-compliance-risk-aware-event-architecture',
    title: 'Bridging Creative and Compliance: Risk-Aware Event Architecture',
    version: 'v1.0',
    updatedAt: HELP_CENTER_LAST_UPDATED,
    audience: 'Executive leadership, public stakeholders, institutional partners',
    sections: {
      executiveSummary: 'Creative excellence and compliance discipline should reinforce each other, not compete. IMC Machine is designed to support both in one event architecture.',
      problemStatement: 'Creative teams are often forced into compliance workflows late in the process, creating friction and rushed approvals.',
      industryContext: 'Stakeholders now expect evidence of preparedness, from permits and insurance to emergency planning and staffing coverage.',
      imcSolution: 'IMC Machine embeds compliance checkpoints directly into planning and production workflows so teams can stay creative while staying accountable.',
      technicalArchitecture: 'Risk scoring, policy records, and operational readiness data are connected to event modules, layouts, and time-based execution plans.',
      operationalBenefits: 'Organizations gain better visibility, smoother interdepartmental coordination, and stronger operational confidence before doors open.',
      riskReductionBenefits: 'Continuous readiness checks reduce blind spots in staffing, safety routing, and incident response planning.',
      versionComplianceAdvantages: 'Published versions and audit traces create defensible records for board review, city coordination, and insurance oversight.',
      futureRoadmap: 'Next iterations include expanded reporting and policy intelligence for multi-site organizations.',
      conclusion: 'Risk-aware architecture is not about slowing creative work. It is about protecting it.',
    },
    versionHistory: [
      { version: 'v1.0', date: HELP_CENTER_LAST_UPDATED, notes: 'Initial white paper release.' },
    ],
  },
];

export function getWhitePaperSectionOrder() {
  return WHITE_PAPER_SECTION_ORDER;
}
