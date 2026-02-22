export const PLATFORM_FORMATS = [
  // Eventbrite
  { key: 'eventbrite_banner', label: 'Eventbrite Banner', width: 2160, height: 1080, platform: 'Eventbrite' },
  { key: 'eventbrite_profile', label: 'Eventbrite Profile', width: 500, height: 500, platform: 'Eventbrite' },
  { key: 'eventbrite_thumb', label: 'Eventbrite Thumbnail', width: 800, height: 450, platform: 'Eventbrite' },
  // Facebook
  { key: 'fb_event_cover', label: 'Facebook Event Cover', width: 1920, height: 1005, platform: 'Facebook' },
  { key: 'fb_post', label: 'Facebook Post', width: 1200, height: 630, platform: 'Facebook' },
  { key: 'fb_story', label: 'Facebook Story', width: 1080, height: 1920, platform: 'Facebook' },
  // Instagram
  { key: 'ig_square', label: 'Instagram Square', width: 1080, height: 1080, platform: 'Instagram' },
  { key: 'ig_portrait', label: 'Instagram Portrait', width: 1080, height: 1350, platform: 'Instagram' },
  { key: 'ig_story', label: 'Instagram Story', width: 1080, height: 1920, platform: 'Instagram' },
  { key: 'ig_reel_cover', label: 'Instagram Reel Cover', width: 1080, height: 1920, platform: 'Instagram' },
  // LinkedIn
  { key: 'li_post', label: 'LinkedIn Post', width: 1200, height: 627, platform: 'LinkedIn' },
  { key: 'li_event', label: 'LinkedIn Event', width: 1584, height: 396, platform: 'LinkedIn' },
  // YouTube
  { key: 'yt_thumbnail', label: 'YouTube Thumbnail', width: 1280, height: 720, platform: 'YouTube' },
  { key: 'yt_banner', label: 'YouTube Banner', width: 2560, height: 1440, platform: 'YouTube' },
  // Calendar / Listings
  { key: 'do210_hero', label: 'Do210 Hero', width: 1200, height: 630, platform: 'Do210' },
  { key: 'do210_poster', label: 'Do210 Poster', width: 800, height: 1200, platform: 'Do210' },
  // Email
  { key: 'email_header', label: 'Email Header', width: 600, height: 200, platform: 'Email' },
  // Web / SEO
  { key: 'og_image', label: 'OG Image', width: 1200, height: 630, platform: 'Web' },
  { key: 'press_hero', label: 'Press Page Hero', width: 1600, height: 900, platform: 'Press' },
  // Print
  { key: 'print_8x10', label: 'Print 8×10', width: 2400, height: 3000, platform: 'Print' },
  { key: 'print_11x17', label: 'Print 11×17', width: 3300, height: 5100, platform: 'Print' },
  { key: 'print_24x36', label: 'Print 24×36', width: 7200, height: 10800, platform: 'Print' },
];

// Group by platform for UI
export function getFormatsByPlatform() {
  const groups = {};
  PLATFORM_FORMATS.forEach(f => {
    if (!groups[f.platform]) groups[f.platform] = [];
    groups[f.platform].push(f);
  });
  return groups;
}
