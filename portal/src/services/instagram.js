// ═══════════════════════════════════════════════════════════════
// IMC Machine: Instagram Publishing Service
// All API calls routed through /api/distribute (server-side)
// NO API keys in client code
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// GET INSTAGRAM BUSINESS ACCOUNT ID
// ═══════════════════════════════════════════════════════════════

export async function getInstagramAccountId() {
  const res = await fetch('/api/distribute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'instagram-account-id' }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to get IG account');
  return data.igUserId;
}

// ═══════════════════════════════════════════════════════════════
// PUBLISH A SINGLE IMAGE POST
// ═══════════════════════════════════════════════════════════════

export async function postImage(caption, imageUrl) {
  const res = await fetch('/api/distribute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'post-instagram',
      event: { title: caption, description: caption },
      venue: {},
      content: {},
      images: { ig_post_square: imageUrl },
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'IG post failed');
  return { success: true, mediaId: data.mediaId, postUrl: data.postUrl };
}

// ═══════════════════════════════════════════════════════════════
// PUBLISH A CAROUSEL (2 to 10 images)
// ═══════════════════════════════════════════════════════════════

export async function postCarousel(caption, imageUrls) {
  if (!imageUrls?.length || imageUrls.length < 2) {
    throw new Error('Carousel requires at least 2 images');
  }
  const res = await fetch('/api/distribute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'instagram-carousel',
      caption,
      imageUrls,
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'IG carousel failed');
  return data;
}

// ═══════════════════════════════════════════════════════════════
// PUBLISH A STORY
// ═══════════════════════════════════════════════════════════════

export async function postStory(imageUrl) {
  const res = await fetch('/api/distribute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'instagram-story',
      imageUrl,
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'IG story failed');
  return data;
}

// ═══════════════════════════════════════════════════════════════
// POST TO FACEBOOK PAGE FEED
// ═══════════════════════════════════════════════════════════════

export async function postToFacebookFeed(message, imageUrl = null) {
  const res = await fetch('/api/distribute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'post-facebook',
      event: { title: message, description: message },
      venue: {},
      content: { socialFacebook: message },
      images: imageUrl ? { fb_post_landscape: imageUrl } : {},
    }),
  });
  const data = await res.json();
  if (data.facebook?.feedPost?.success) {
    return { success: true, postId: data.facebook.feedPost.postId, type: 'photo' };
  }
  throw new Error(data.error || 'FB feed post failed');
}

// ═══════════════════════════════════════════════════════════════
// BUILD INSTAGRAM CAPTION (client-side, no keys needed)
// ═══════════════════════════════════════════════════════════════

export function buildCaption(event, venue, research, hashtags = []) {
  const lines = [];
  lines.push(event.title);
  lines.push('');

  if (event.date) {
    const d = new Date(event.date + 'T00:00:00');
    const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    lines.push(`📅 ${dateStr}${event.time ? ` · ${event.time}` : ''}`);
  }
  if (venue?.name) lines.push(`📍 ${venue.name}`);
  if (event.ticketLink) lines.push(`🎟️ Link in bio`);
  else if (event.ticketPrice === 0 || event.ticketPrice === '0' || event.isFree) lines.push(`🎟️ Free`);

  lines.push('');
  if (event.description) {
    lines.push(event.description.substring(0, 500));
    lines.push('');
  }

  const defaultTags = ['#SanAntonio', '#SATX', '#LiveMusic', '#SanAntonioEvents'];
  const allTags = [...new Set([...hashtags, ...defaultTags])];
  lines.push(allTags.slice(0, 30).join(' '));
  lines.push('');
  lines.push('Presented by @goodcreativemedia');

  return lines.join('\n').substring(0, 2200);
}

// ═══════════════════════════════════════════════════════════════
// FULL FLOW: Generate caption + post image + optional story
// ═══════════════════════════════════════════════════════════════

export async function publishEventToInstagram(event, venue, research, images, hashtags = []) {
  const results = { feedPost: null, story: null, facebookPost: null };
  const caption = buildCaption(event, venue, research, hashtags);

  const feedImageUrl = images?.ig_post_square || images?.ig_post_portrait;
  if (feedImageUrl) {
    try { results.feedPost = await postImage(caption, feedImageUrl); }
    catch (err) { results.feedPost = { success: false, error: err.message }; }
  }

  const storyImageUrl = images?.ig_story || images?.fb_story;
  if (storyImageUrl) {
    try { results.story = await postStory(storyImageUrl); }
    catch (err) { results.story = { success: false, error: err.message }; }
  }

  const fbImageUrl = images?.fb_post_landscape || feedImageUrl;
  if (fbImageUrl) {
    try { results.facebookPost = await postToFacebookFeed(caption, fbImageUrl); }
    catch (err) { results.facebookPost = { success: false, error: err.message }; }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
// CHECK IG ACCOUNT STATUS
// ═══════════════════════════════════════════════════════════════

export async function checkStatus() {
  try {
    const res = await fetch('/api/distribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'instagram-status' }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return { connected: true, ...data };
  } catch (err) {
    return {
      connected: false,
      error: err.message,
      setup: [
        '1. Go to Meta Business Suite → Settings → Instagram Account',
        '2. Connect your Instagram Business or Creator account to the GCM Facebook Page',
        '3. Set FB_PAGE_ACCESS_TOKEN and FB_PAGE_ID in Vercel environment variables',
      ],
    };
  }
}
