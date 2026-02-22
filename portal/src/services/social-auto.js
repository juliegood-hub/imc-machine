// ═══════════════════════════════════════════════════════════════
// IMC Machine: Social Media Auto-Posting
// All API calls routed through /api/distribute (server-side)
// ═══════════════════════════════════════════════════════════════

export async function postToFacebookPage(message, imageUrl = null, link = null) {
  try {
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
      return { success: true, postId: data.facebook.feedPost.postId, status: 'posted' };
    }
    if (data.facebook?.event?.success) {
      return { success: true, eventId: data.facebook.event.eventId, eventUrl: data.facebook.event.eventUrl, status: 'posted' };
    }
    return { success: false, error: data.error || data.facebook?.feedPost?.error || data.facebook?.event?.error || 'Facebook post failed' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function postToInstagram(caption, imageUrl) {
  if (!imageUrl || imageUrl.startsWith('data:')) {
    return { success: false, error: 'Instagram requires a publicly accessible image URL.' };
  }
  try {
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
    if (data.success) {
      return { success: true, mediaId: data.mediaId, status: 'posted' };
    }
    return { success: false, error: data.error || 'Instagram post failed' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function postToLinkedIn(text, imageUrl = null) {
  try {
    const res = await fetch('/api/distribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'post-linkedin',
        event: { title: text, description: text },
        venue: {},
        content: {},
        images: imageUrl ? { linkedin_post: imageUrl } : {},
      }),
    });
    const data = await res.json();
    if (data.success) {
      return { success: true, postId: data.postId, postUrl: data.postUrl, status: 'posted' };
    }
    return { success: false, error: data.error || 'LinkedIn post failed' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// DISTRIBUTE SOCIAL: Post to FB + IG + LinkedIn
// ═══════════════════════════════════════════════════════════════

export async function distributeSocial(socialCopy, imageUrl, ticketLink) {
  const results = {};

  // Facebook
  results.facebook = await postToFacebookPage(socialCopy, imageUrl, ticketLink);

  // Instagram (needs public image URL)
  if (imageUrl && !imageUrl.startsWith('data:')) {
    results.instagram = await postToInstagram(socialCopy, imageUrl);
  } else {
    results.instagram = {
      success: false,
      error: 'Instagram needs a public image URL. Generate graphics and upload to Drive first.',
    };
  }

  // LinkedIn
  results.linkedin = await postToLinkedIn(socialCopy, imageUrl);

  return results;
}
