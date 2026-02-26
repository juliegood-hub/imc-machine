// ═══════════════════════════════════════════════════════════════
// IMC Machine: Client Types Constants
// ═══════════════════════════════════════════════════════════════
import { getRoleDisplayName } from './terminology';

export const CLIENT_TYPES = [
  // Venue-side roles
  { key: 'venue_owner', icon: '🏛️', label: 'Venue Owner/Operator', desc: 'Bar, theater, gallery, club, restaurant, event space' },
  { key: 'venue_manager', icon: '🎪', label: 'Venue Manager', desc: 'Day-to-day venue operations, bookings' },
  { key: 'venue_marketing', icon: '📢', label: 'Venue Marketing Director', desc: 'Marketing, promotions, social media' },
  { key: 'venue_staff', icon: '🎭', label: 'Venue Staff', desc: 'Technical staff, bartenders, ushers' },
  { key: 'restaurant', icon: '🍽️', label: 'Restaurant / Commercial Kitchen', desc: 'Restaurant, hotel venue, commercial kitchen, catering space' },
  { key: 'festival_organizer', icon: '🎪', label: 'Festival Organizer', desc: 'Music festival, food festival, arts festival, cultural event' },
  { key: 'theater_company', icon: '🎭', label: 'Theater Company', desc: 'Resident theater company, repertory, touring theater producer' },
  { key: 'nonprofit_arts_org', icon: '🏛️', label: 'Nonprofit Arts Organization', desc: 'Arts nonprofit, foundation, cultural institution' },
  { key: 'booking_manager', icon: '📅', label: 'Booking Agent', desc: 'Event booking, talent booking, booking calendar ownership' },
  { key: 'staff_scheduler', icon: '🧑‍💼', label: 'Staff Scheduler', desc: 'Workforce scheduling, crew shifts, staffing confirmations' },
  { key: 'ticketing_manager', icon: '🎟️', label: 'Ticketing Manager', desc: 'Ticketing operations, box office, admissions manager' },
  { key: 'hospitality_manager', icon: '🛋️', label: 'Hospitality Manager', desc: 'Artist hospitality, green room, rider fulfillment lead' },
  { key: 'technical_director', icon: '🎚️', label: 'Technical Director', desc: 'Production systems, audio/video/lighting technical leadership' },
  { key: 'stage_manager', icon: '🎬', label: 'Stage Manager', desc: 'Run-of-show coordination, cue calling, backstage operations' },
  
  // Artist-side roles
  { key: 'artist', icon: '🎵', label: 'Solo Artist / Band', desc: 'Musician, band, solo performer' },
  { key: 'promoter', icon: '🎪', label: 'Promoter', desc: 'Event promoter, concert promoter' },
  { key: 'manager', icon: '💼', label: 'Artist Manager', desc: 'Artist management, talent management' },
  { key: 'booking_agent', icon: '📞', label: 'Booking Agent', desc: 'Talent booking, agent representation' },
  { key: 'producer', icon: '🎬', label: 'Producer', desc: 'Event producer, show producer' },
  { key: 'production_company', icon: '🏗️', label: 'Production Company', desc: 'Live production vendor, touring production provider' },
  { key: 'performer', icon: '🎭', label: 'Actor / Performer', desc: 'Actor, stage performer, character performer, seasonal Santa actor' },
  { key: 'dj', icon: '🎧', label: 'DJ / Electronic / Pop Act', desc: 'DJ, electronic, pop, hip-hop, solo recording artist' },
  { key: 'vendor', icon: '🛍️', label: 'Vendor / Retail Artist', desc: 'Art vendor, retail booth, merch seller, craft market' },
  { key: 'artisan', icon: '🎨', label: 'Artisan / Visual Artist', desc: 'Painter, sculptor, ceramicist, printmaker, designer, maker' },
  { key: 'orchestra_ensemble', icon: '🎻', label: 'Orchestra / Ensemble', desc: 'Orchestra, chamber ensemble, instrumental group' },
  { key: 'choir_ensemble', icon: '🎼', label: 'Choir / Vocal Ensemble', desc: 'Choir, chorus, vocal ensemble' },
  
  // Speaker / Professional roles
  { key: 'attorney', icon: '⚖️', label: 'Attorney / Lawyer', desc: 'Attorney, lawyer, legal professional' },
  { key: 'educator', icon: '📚', label: 'Educator / Professor', desc: 'Teacher, professor, lecturer, academic' },
  { key: 'professor', icon: '🎓', label: 'Professor / Researcher', desc: 'Professor, researcher, academic expert' },
  { key: 'doctor', icon: '🩺', label: 'Doctor / Medical Professional', desc: 'Physician, medical professional, healthcare' },
  { key: 'speaker', icon: '🎤', label: 'Speaker / Panelist', desc: 'Keynote speaker, panelist, moderator' },
  { key: 'author', icon: '📖', label: 'Author / Writer', desc: 'Author, writer, poet, playwright' },
  { key: 'writer', icon: '✍️', label: 'Writer / Copywriter', desc: 'Writer, essayist, copywriter, columnist' },
  { key: 'journalist', icon: '🗞️', label: 'Journalist / Reporter', desc: 'Reporter, journalist, correspondent, critic' },
  { key: 'editor', icon: '📝', label: 'Editor / Publisher', desc: 'Editor, publication lead, publishing professional' },
  { key: 'poet', icon: '🖋️', label: 'Poet / Spoken Word', desc: 'Poet, spoken word artist, literary performer' },
  { key: 'playwright', icon: '🎭', label: 'Playwright / Dramaturg', desc: 'Playwright, scriptwriter, dramaturg' },
  { key: 'podcaster', icon: '🎙️', label: 'Podcaster / Host', desc: 'Podcast host, interviewer, broadcast personality' },
  { key: 'moderator', icon: '🎛️', label: 'Moderator / MC', desc: 'Moderator, emcee, host, facilitator' },
  { key: 'coach', icon: '🏋️', label: 'Coach / Trainer', desc: 'Coach, trainer, workshop leader' },
  { key: 'consultant', icon: '💡', label: 'Consultant / Advisor', desc: 'Consultant, strategist, advisor' },
  { key: 'comedian', icon: '😂', label: 'Comedian', desc: 'Stand-up comedian, improv performer' },
  { key: 'activist', icon: '✊', label: 'Activist / Community Leader', desc: 'Activist, organizer, community leader' },
  { key: 'politician', icon: '🏛️', label: 'Elected Official / Politician', desc: 'Elected official, political figure, candidate' },
  { key: 'chef', icon: '👨‍🍳', label: 'Chef / Culinary Artist', desc: 'Chef, culinary professional, food artist' },
  { key: 'speaker_bureau', icon: '🎤', label: 'Speaker Bureau', desc: 'Speaker representation agency, lecture bureau, panel programming' },
  
  // Youth / Education roles (minors involved — special content rules apply)
  { key: 'k12_school', icon: '🏫', label: 'K-12 School', desc: 'Public or private school band, choir, theater, dance program' },
  { key: 'conservatory', icon: '🎼', label: 'Conservatory / Music School', desc: 'Private conservatory, music academy, dance studio, arts school' },
  { key: 'childrens_theater', icon: '🎭', label: "Children's Theater / Youth Company", desc: "Children's theater, youth orchestra, junior ensemble" },
  { key: 'youth_program', icon: '⭐', label: 'Youth Arts Program', desc: 'After-school program, summer camp, community youth arts' },
  
  // Other roles
  { key: 'media', icon: '📰', label: 'Media / Press', desc: 'Journalist, blogger, media outlet' },
  { key: 'sponsor', icon: '🤝', label: 'Sponsor / Partner', desc: 'Corporate sponsor, business partner' },
  { key: 'admin', icon: '👑', label: 'System Admin', desc: 'System administrator' },
];

// Legacy mapping for backward compatibility
export const LEGACY_CLIENT_TYPES = [
  { key: 'venue', icon: '🏛️', label: 'Venue', desc: 'Bar, theater, gallery, club, restaurant' },
  { key: 'artist', icon: '🎵', label: 'Artist / Band', desc: 'Musician, band, solo performer' },
  { key: 'performer', icon: '🎭', label: 'Performer / Actor', desc: 'Theater, Broadway, comedy, dance' },
  { key: 'producer', icon: '🎪', label: 'Producer / Promoter', desc: 'Event producer, festival organizer' },
];

export const CLIENT_TYPE_ALIASES = {
  lawyer: 'attorney',
  legal_professional: 'attorney',
  actor: 'performer',
  acting: 'performer',
  theatre_company: 'theater_company',
  box_office: 'ticketing_manager',
  booking_operations: 'staff_scheduler',
  booking_staff: 'staff_scheduler',
  booking_scheduler: 'staff_scheduler',
  staffing_scheduler: 'staff_scheduler',
};

export function normalizeClientType(clientType) {
  const raw = String(clientType || '').trim();
  if (!raw) return '';
  return CLIENT_TYPE_ALIASES[raw] || raw;
}

// Helper functions
export function getClientTypeInfo(clientType) {
  const normalized = normalizeClientType(clientType);
  const matched = CLIENT_TYPES.find(t => t.key === normalized)
    || LEGACY_CLIENT_TYPES.find(t => t.key === normalized);

  if (matched) {
    return {
      ...matched,
      label: getRoleDisplayName(matched.key) || matched.label,
    };
  }

  return {
    key: normalized,
    icon: '🏛️',
    label: getRoleDisplayName(normalized) || normalized,
    desc: 'Unknown type',
  };
}

export function isVenueRole(clientType) {
  const normalized = normalizeClientType(clientType);
  return ['venue_owner', 'venue_manager', 'venue_marketing', 'venue_staff', 'venue', 'restaurant', 'festival_organizer', 'theater_company', 'nonprofit_arts_org', 'booking_manager', 'staff_scheduler', 'ticketing_manager', 'hospitality_manager', 'technical_director', 'stage_manager'].includes(normalized);
}

export function isArtistRole(clientType) {
  const normalized = normalizeClientType(clientType);
  return ['artist', 'promoter', 'manager', 'booking_agent', 'producer', 'production_company', 'dj', 'performer', 'vendor', 'artisan', 'orchestra_ensemble', 'choir_ensemble'].includes(normalized);
}

export function isSpeakerRole(clientType) {
  const normalized = normalizeClientType(clientType);
  return ['attorney', 'educator', 'professor', 'doctor', 'speaker', 'author', 'writer', 'journalist', 'editor', 'poet', 'playwright', 'podcaster', 'moderator', 'coach', 'consultant', 'comedian', 'activist', 'politician', 'chef', 'speaker_bureau'].includes(normalized);
}

export function isYouthRole(clientType) {
  const normalized = normalizeClientType(clientType);
  return ['k12_school', 'conservatory', 'childrens_theater', 'youth_program'].includes(normalized);
}

export function getClientTypeColors(clientType) {
  const normalized = normalizeClientType(clientType);
  const venueRoles = {
    bg: 'bg-blue-100', 
    text: 'text-blue-700', 
    icon: getClientTypeInfo(normalized).icon
  };
  
  const artistRoles = {
    bg: 'bg-purple-100', 
    text: 'text-purple-700', 
    icon: getClientTypeInfo(normalized).icon
  };
  
  const mediaRoles = {
    bg: 'bg-green-100', 
    text: 'text-green-700', 
    icon: getClientTypeInfo(normalized).icon
  };
  
  const sponsorRoles = {
    bg: 'bg-yellow-100', 
    text: 'text-yellow-700', 
    icon: getClientTypeInfo(normalized).icon
  };
  
  const adminRoles = {
    bg: 'bg-red-100', 
    text: 'text-red-700', 
    icon: getClientTypeInfo(normalized).icon
  };
  
  const speakerRoles = {
    bg: 'bg-indigo-100', 
    text: 'text-indigo-700', 
    icon: getClientTypeInfo(normalized).icon
  };
  
  const youthRoles = {
    bg: 'bg-amber-100', 
    text: 'text-amber-700', 
    icon: getClientTypeInfo(normalized).icon
  };
  
  if (isVenueRole(normalized)) return venueRoles;
  if (isArtistRole(normalized)) return artistRoles;
  if (isSpeakerRole(normalized)) return speakerRoles;
  if (isYouthRole(normalized)) return youthRoles;
  if (normalized === 'media') return mediaRoles;
  if (normalized === 'sponsor') return sponsorRoles;
  if (normalized === 'admin') return adminRoles;
  
  return venueRoles; // Default
}
