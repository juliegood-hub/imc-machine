// ═══════════════════════════════════════════════════════════════
// IMC Machine: Unified Social Distribution Service
//
// Single entry point for posting to all social channels.
// Each platform has its own dedicated service file.
//
// Channels:
//   ✅ Facebook Events  → facebook-events.js
//   ✅ Facebook Feed     → instagram.js (postToFacebookFeed)
//   ✅ Instagram         → instagram.js
//   ✅ LinkedIn          → linkedin.js
//   ✅ Eventbrite        → distribution.js
//   ✅ Email (Resend)    → distribution.js
//   ❌ X/Twitter         → dropped per Julie's decision
// ═══════════════════════════════════════════════════════════════

import { createFullFacebookEvent } from './facebook-events.js';
import { publishEventToInstagram, postToFacebookFeed, checkStatus as checkIgStatus } from './instagram.js';
import { publishEventToLinkedIn, checkStatus as checkLiStatus } from './linkedin.js';

// ═══════════════════════════════════════════════════════════════
// PUBLISH TO ALL SOCIAL CHANNELS
// Returns per-channel results
// ═══════════════════════════════════════════════════════════════

export async function publishToAllSocial(event, venue, research, images, hashtags = []) {
  const results = {
    facebook: null,
    instagram: null,
    linkedin: null,
    timestamp: new Date().toISOString(),
  };

  // Facebook Event (creates event on GCM page with co-hosts + cover)
  try {
    results.facebook = await createFullFacebookEvent(
      event, venue, research,
      images?.fb_event_banner,
    );
  } catch (err) {
    results.facebook = { success: false, error: err.message };
  }

  // Instagram (feed post + story + FB feed cross-post)
  try {
    results.instagram = await publishEventToInstagram(
      event, venue, research, images, hashtags,
    );
  } catch (err) {
    results.instagram = { success: false, error: err.message };
  }

  // LinkedIn (company page post with image)
  try {
    results.linkedin = await publishEventToLinkedIn(
      event, venue, research, images,
    );
  } catch (err) {
    results.linkedin = { success: false, error: err.message };
  }

  // Summary
  const channels = ['facebook', 'instagram', 'linkedin'];
  const succeeded = channels.filter(c => results[c]?.success);
  const failed = channels.filter(c => results[c] && !results[c].success);

  results.summary = {
    total: channels.length,
    succeeded: succeeded.length,
    failed: failed.length,
    channels: {
      succeeded,
      failed,
    },
  };

  console.log(`[Social] Published to ${succeeded.length}/${channels.length} channels`);
  return results;
}

// ═══════════════════════════════════════════════════════════════
// CHECK ALL SOCIAL CHANNEL STATUS
// ═══════════════════════════════════════════════════════════════

export async function checkAllStatus() {
  const [ig, li] = await Promise.all([
    checkIgStatus().catch(e => ({ connected: false, error: e.message })),
    checkLiStatus().catch(e => ({ connected: false, error: e.message })),
  ]);

  return {
    facebook: { connected: true, note: 'Uses server-side token via /api/distribute' },
    instagram: ig,
    linkedin: li,
  };
}

// Re-export individual services for direct access
export { createFullFacebookEvent } from './facebook-events.js';
export { publishEventToInstagram, postImage as postToInstagram, postStory as postInstagramStory, postCarousel as postInstagramCarousel, buildCaption as buildIgCaption } from './instagram.js';
export { publishEventToLinkedIn, postText as postToLinkedIn, postWithImage as postToLinkedInWithImage, postArticle as postLinkedInArticle, buildPostText as buildLinkedInText, getAuthUrl as getLinkedInAuthUrl } from './linkedin.js';
