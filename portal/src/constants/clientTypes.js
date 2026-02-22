// ═══════════════════════════════════════════════════════════════
// IMC Machine: Client Types Constants
// ═══════════════════════════════════════════════════════════════

export const CLIENT_TYPES = [
  // Venue-side roles
  { key: 'venue_owner', icon: '🏛️', label: 'Venue Owner/Operator', desc: 'Bar, theater, gallery, club, restaurant, event space' },
  { key: 'venue_manager', icon: '🎪', label: 'Venue Manager', desc: 'Day-to-day venue operations, bookings' },
  { key: 'venue_marketing', icon: '📢', label: 'Venue Marketing Director', desc: 'Marketing, promotions, social media' },
  { key: 'venue_staff', icon: '🎭', label: 'Venue Staff', desc: 'Technical staff, bartenders, ushers' },
  { key: 'restaurant', icon: '🍽️', label: 'Restaurant / Commercial Kitchen', desc: 'Restaurant, hotel venue, commercial kitchen, catering space' },
  { key: 'festival_organizer', icon: '🎪', label: 'Festival Organizer', desc: 'Music festival, food festival, arts festival, cultural event' },
  
  // Artist-side roles
  { key: 'artist', icon: '🎵', label: 'Solo Artist / Band', desc: 'Musician, band, solo performer' },
  { key: 'promoter', icon: '🎪', label: 'Promoter', desc: 'Event promoter, concert promoter' },
  { key: 'manager', icon: '💼', label: 'Artist Manager', desc: 'Artist management, talent management' },
  { key: 'booking_agent', icon: '📞', label: 'Booking Agent', desc: 'Talent booking, agent representation' },
  { key: 'producer', icon: '🎬', label: 'Producer', desc: 'Event producer, show producer' },
  { key: 'dj', icon: '🎧', label: 'DJ / Electronic / Pop Act', desc: 'DJ, electronic, pop, hip-hop, solo recording artist' },
  { key: 'vendor', icon: '🛍️', label: 'Vendor / Retail Artist', desc: 'Art vendor, retail booth, merch seller, craft market' },
  
  // Speaker / Professional roles
  { key: 'attorney', icon: '⚖️', label: 'Attorney / Lawyer', desc: 'Attorney, lawyer, legal professional' },
  { key: 'educator', icon: '📚', label: 'Educator / Professor', desc: 'Teacher, professor, lecturer, academic' },
  { key: 'doctor', icon: '🩺', label: 'Doctor / Medical Professional', desc: 'Physician, medical professional, healthcare' },
  { key: 'speaker', icon: '🎤', label: 'Speaker / Panelist', desc: 'Keynote speaker, panelist, moderator' },
  { key: 'author', icon: '📖', label: 'Author / Writer', desc: 'Author, writer, poet, playwright' },
  { key: 'comedian', icon: '😂', label: 'Comedian', desc: 'Stand-up comedian, improv performer' },
  { key: 'activist', icon: '✊', label: 'Activist / Community Leader', desc: 'Activist, organizer, community leader' },
  { key: 'politician', icon: '🏛️', label: 'Elected Official / Politician', desc: 'Elected official, political figure, candidate' },
  { key: 'chef', icon: '👨‍🍳', label: 'Chef / Culinary Artist', desc: 'Chef, culinary professional, food artist' },
  
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

// Helper functions
export function getClientTypeInfo(clientType) {
  return CLIENT_TYPES.find(t => t.key === clientType) || 
         LEGACY_CLIENT_TYPES.find(t => t.key === clientType) ||
         { key: clientType, icon: '🏛️', label: clientType, desc: 'Unknown type' };
}

export function isVenueRole(clientType) {
  return ['venue_owner', 'venue_manager', 'venue_marketing', 'venue_staff', 'venue', 'restaurant', 'festival_organizer'].includes(clientType);
}

export function isArtistRole(clientType) {
  return ['artist', 'promoter', 'manager', 'booking_agent', 'producer', 'dj', 'performer', 'vendor'].includes(clientType);
}

export function isSpeakerRole(clientType) {
  return ['attorney', 'educator', 'doctor', 'speaker', 'author', 'comedian', 'activist', 'politician', 'chef'].includes(clientType);
}

export function isYouthRole(clientType) {
  return ['k12_school', 'conservatory', 'childrens_theater', 'youth_program'].includes(clientType);
}

export function getClientTypeColors(clientType) {
  const venueRoles = {
    bg: 'bg-blue-100', 
    text: 'text-blue-700', 
    icon: getClientTypeInfo(clientType).icon
  };
  
  const artistRoles = {
    bg: 'bg-purple-100', 
    text: 'text-purple-700', 
    icon: getClientTypeInfo(clientType).icon
  };
  
  const mediaRoles = {
    bg: 'bg-green-100', 
    text: 'text-green-700', 
    icon: getClientTypeInfo(clientType).icon
  };
  
  const sponsorRoles = {
    bg: 'bg-yellow-100', 
    text: 'text-yellow-700', 
    icon: getClientTypeInfo(clientType).icon
  };
  
  const adminRoles = {
    bg: 'bg-red-100', 
    text: 'text-red-700', 
    icon: getClientTypeInfo(clientType).icon
  };
  
  const speakerRoles = {
    bg: 'bg-indigo-100', 
    text: 'text-indigo-700', 
    icon: getClientTypeInfo(clientType).icon
  };
  
  const youthRoles = {
    bg: 'bg-amber-100', 
    text: 'text-amber-700', 
    icon: getClientTypeInfo(clientType).icon
  };
  
  if (isVenueRole(clientType)) return venueRoles;
  if (isArtistRole(clientType)) return artistRoles;
  if (isSpeakerRole(clientType)) return speakerRoles;
  if (isYouthRole(clientType)) return youthRoles;
  if (clientType === 'media') return mediaRoles;
  if (clientType === 'sponsor') return sponsorRoles;
  if (clientType === 'admin') return adminRoles;
  
  return venueRoles; // Default
}