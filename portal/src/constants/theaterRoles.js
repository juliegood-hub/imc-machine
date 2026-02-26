export const THEATER_GENRE_KEY = 'Theater | Plays | Musicals';

export const THEATER_DEPARTMENTS = [
  { key: 'leadership', label: 'Production Leadership' },
  { key: 'direction_writing', label: 'Direction & Writing' },
  { key: 'stage_management', label: 'Stage Management' },
  { key: 'performance', label: 'Performance' },
  { key: 'music', label: 'Music Department' },
  { key: 'movement', label: 'Choreography & Movement' },
  { key: 'scenic_props', label: 'Scenic, Props & Automation' },
  { key: 'lighting', label: 'Lighting Department' },
  { key: 'audio_video', label: 'Sound, Projection & Video' },
  { key: 'costume_hair_makeup', label: 'Costume, Hair, Makeup & Wigs' },
  { key: 'stage_ops', label: 'Stage Operations & Stagehands' },
  { key: 'foh_ticketing', label: 'Front of House & Ticketing' },
  { key: 'marketing_press', label: 'Marketing, Press & Sponsorship' },
  { key: 'education_safety', label: 'Education, Access & Safety' },
];

export const THEATER_ROLES_BY_DEPARTMENT = {
  leadership: [
    'Lead Producer',
    'Executive Producer',
    'Co-Producer',
    'General Manager',
    'Company Manager',
    'Production Manager',
    'Associate Producer',
    'Assistant Producer',
    'Line Producer',
    'Production Coordinator',
  ],
  direction_writing: [
    'Director',
    'Associate Director',
    'Assistant Director',
    'Resident Director',
    'Playwright',
    'Book Writer',
    'Dramaturg',
    'Literary Manager',
    'Script Supervisor',
  ],
  stage_management: [
    'Production Stage Manager',
    'Stage Manager',
    'Deputy Stage Manager',
    'Assistant Stage Manager',
    'Calling Stage Manager',
    'Deck Stage Manager',
    'Rehearsal Stage Manager',
    'Stage Management PA',
    'Prompt Book Assistant',
  ],
  performance: [
    'Lead Actor',
    'Supporting Actor',
    'Ensemble Performer',
    'Swing',
    'Understudy',
    'Standby',
    'Dance Captain',
    'Vocal Captain',
    'Fight Captain',
    'Child Performer Wrangler',
  ],
  music: [
    'Musical Director',
    'Associate Musical Director',
    'Conductor',
    'Assistant Conductor',
    'Orchestra Contractor',
    'Rehearsal Pianist',
    'Pit Musician',
    'Vocal Coach',
    'Orchestrator',
    'Arranger',
    'Copyist',
  ],
  movement: [
    'Choreographer',
    'Associate Choreographer',
    'Assistant Choreographer',
    'Movement Director',
    'Fight Director',
    'Intimacy Coordinator',
  ],
  scenic_props: [
    'Scenic Designer',
    'Associate Scenic Designer',
    'Set Decorator',
    'Art Director (Theater)',
    'Props Designer',
    'Properties Supervisor',
    'Props Master',
    'Assistant Props Master',
    'Scenic Charge Artist',
    'Scenic Painter',
    'Carpenter',
    'Head Carpenter',
    'Deck Carpenter',
    'Automation Carpenter',
    'Rigger',
    'Fly Rail Captain',
    'Fly Operator',
    'Draper / Soft Goods Lead',
  ],
  lighting: [
    'Lighting Designer',
    'Associate Lighting Designer',
    'Assistant Lighting Designer',
    'Lighting Supervisor',
    'Master Electrician',
    'Assistant Electrician',
    'Board Operator',
    'Spot Operator',
    'Programmer',
    'Followspot Operator',
  ],
  audio_video: [
    'Sound Designer',
    'Associate Sound Designer',
    'Audio Supervisor',
    'A1 Mixer',
    'A2 Audio Technician',
    'RF Coordinator',
    'Playback Programmer',
    'QLab Programmer',
    'Microphone Technician',
    'Projection Designer',
    'Associate Projection Designer',
    'Video Engineer',
    'Camera Operator',
    'Media Server Operator',
  ],
  costume_hair_makeup: [
    'Costume Designer',
    'Associate Costume Designer',
    'Costume Supervisor',
    'Wardrobe Supervisor',
    'Stitcher',
    'Tailor',
    'Dresser',
    'Hair Designer',
    'Wig Designer',
    'Wig Supervisor',
    'Wig Technician',
    'Makeup Designer',
    'Makeup Artist',
    'Quick Change Captain',
  ],
  stage_ops: [
    'Run Crew',
    'Deck Crew',
    'Stagehand',
    'Head Stagehand',
    'Backstage Coordinator',
    'Curtain Operator',
    'Scene Shift Captain',
    'Load-In Crew',
    'Load-Out Crew',
    'Truck Loader',
    'Automation Operator',
  ],
  foh_ticketing: [
    'Front of House Manager',
    'House Manager',
    'Assistant House Manager',
    'Box Office Manager',
    'Ticketing Coordinator',
    'Usher Captain',
    'Usher',
    'VIP Coordinator',
    'Accessibility Coordinator',
    'ASL Interpreter Coordinator',
  ],
  marketing_press: [
    'Marketing Director',
    'Social Media Manager',
    'Publicist',
    'Press Representative',
    'Photographer',
    'Videographer',
    'Graphic Designer',
    'Content Producer',
    'Development Director',
    'Sponsorship Manager',
  ],
  education_safety: [
    'Education Director',
    'Teaching Artist',
    'Community Outreach Manager',
    'Talkback Moderator',
    'Child Safety Coordinator',
    'COVID Compliance Officer',
    'Safety Officer',
    'First Aid Lead',
  ],
};

export const THEATER_ROLE_OPTIONS = THEATER_DEPARTMENTS.flatMap(
  ({ key }) => THEATER_ROLES_BY_DEPARTMENT[key] || []
);

const THEATER_ROLE_TO_DEPARTMENT = THEATER_DEPARTMENTS.reduce((acc, dept) => {
  for (const role of THEATER_ROLES_BY_DEPARTMENT[dept.key] || []) {
    acc[role.toLowerCase()] = dept.label;
  }
  return acc;
}, {});

export function getTheaterDepartmentForRole(role = '') {
  const raw = String(role || '').trim().toLowerCase();
  if (!raw) return '';
  return THEATER_ROLE_TO_DEPARTMENT[raw] || '';
}

export function findNearestTheaterRole(role = '') {
  const normalized = String(role || '').trim().toLowerCase();
  if (!normalized) return '';
  const exact = THEATER_ROLE_OPTIONS.find(r => r.toLowerCase() === normalized);
  if (exact) return exact;
  const partial = THEATER_ROLE_OPTIONS.find(r => {
    const v = r.toLowerCase();
    return v.includes(normalized) || normalized.includes(v);
  });
  return partial || '';
}
