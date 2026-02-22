import { parseLocalDate } from '../lib/dateUtils.js';
// ═══════════════════════════════════════════════════════════════
// IMC Machine — Auto-Generated Press Page Service
// Patent ref: §13.8 Auto-Generated Aggregated Press Page Subsystem
//
// For each event, generates a single web page aggregating:
// - Press release (English + Spanish)
// - Social media embeds
// - Graphics gallery (poster, social banner, IG story)
// - Event details (date, time, venue, genre, tickets)
// - Google Maps embed
// - Stakeholder info from Master Tag Sheet
// - Press coverage links
// - Ticket purchase / merch links
//
// Output: Standalone HTML page that can be:
// 1. Uploaded to Google Drive as a shareable link
// 2. Published to WordPress via REST API
// 3. Hosted on Vercel as a static page
// ═══════════════════════════════════════════════════════════════

export function generatePressPageHTML(event, venue, content, research, images, campaign) {
  const venueName = venue?.name || 'Venue';
  const eventDate = parseLocalDate(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const mapsUrl = research?.googleMapsUrl || research?.venue?.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((venue?.name || '') + ' ' + (venue?.address || '') + ' San Antonio TX')}`;
  const mapsQuery = encodeURIComponent((venue?.name || '') + ' San Antonio TX');
  const mapsEmbed = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${event.title} — ${venueName} | Press Kit</title>
  <meta name="description" content="${event.description || `${event.title} at ${venueName} in San Antonio, TX`}">
  <meta property="og:title" content="${event.title} — ${venueName}">
  <meta property="og:description" content="${event.description || ''}">
  <meta property="og:type" content="event">
  ${images?.[0]?.url ? `<meta property="og:image" content="${images[0].url}">` : ''}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; line-height: 1.7; background: #faf8f3; }
    .hero { background: linear-gradient(135deg, #0d1b2a 0%, #1b3a5c 100%); color: white; padding: 60px 20px 40px; text-align: center; }
    .hero h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 2.5rem; margin-bottom: 8px; }
    .hero .subtitle { font-size: 1.1rem; opacity: 0.85; }
    .hero .venue-name { color: #c8a45e; font-size: 0.9rem; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    .section { margin: 40px 0; }
    .section h2 { font-family: 'Playfair Display', Georgia, serif; color: #0d1b2a; font-size: 1.4rem; border-bottom: 2px solid #c8a45e; padding-bottom: 8px; margin-bottom: 16px; }
    .event-details { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .event-details .detail { }
    .event-details .label { font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 1px; }
    .event-details .value { font-size: 1rem; font-weight: 600; color: #0d1b2a; }
    .press-release { background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); white-space: pre-wrap; font-size: 0.95rem; }
    .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .gallery img { width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .gallery .img-label { font-size: 0.75rem; color: #888; text-align: center; margin-top: 4px; }
    .map-container { border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .map-container iframe { width: 100%; height: 300px; border: none; }
    .ticket-btn { display: inline-block; background: #c8a45e; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 1rem; transition: all 0.2s; }
    .ticket-btn:hover { background: #b8943e; transform: translateY(-1px); }
    .stakeholders { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .stakeholder { margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #eee; }
    .stakeholder:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .stakeholder .name { font-weight: 700; color: #0d1b2a; }
    .stakeholder .bio { font-size: 0.9rem; color: #555; margin-top: 4px; }
    .stakeholder .links { font-size: 0.85rem; margin-top: 4px; }
    .stakeholder .links a { color: #c8a45e; margin-right: 12px; text-decoration: none; }
    .spanish-toggle { background: #0d1b2a; color: #c8a45e; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; }
    .footer { background: #0d1b2a; color: #999; padding: 40px 20px; text-align: center; font-size: 0.8rem; margin-top: 60px; }
    .footer a { color: #c8a45e; }
    .badge { font-size: 0.7rem; color: #666; }
    @media (max-width: 600px) {
      .hero h1 { font-size: 1.8rem; }
      .event-details { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="hero">
    <div class="venue-name">${venueName}</div>
    <h1>${event.title}</h1>
    <div class="subtitle">${eventDate} at ${event.time || '7:00 PM'} — ${venue?.address || 'San Antonio, TX'}</div>
    ${event.ticketLink ? `<div style="margin-top:20px"><a href="${event.ticketLink}" class="ticket-btn">🎟️ Get Tickets</a></div>` : ''}
  </div>

  <div class="container">
    <!-- Event Details -->
    <div class="section">
      <h2>Event Details</h2>
      <div class="event-details">
        <div class="detail"><div class="label">Date</div><div class="value">${eventDate}</div></div>
        <div class="detail"><div class="label">Time</div><div class="value">${event.time || 'TBD'}</div></div>
        <div class="detail"><div class="label">Venue</div><div class="value">${venueName}</div></div>
        <div class="detail"><div class="label">Genre</div><div class="value">${event.genre || 'Live Entertainment'}</div></div>
        <div class="detail"><div class="label">Location</div><div class="value">${venue?.address || 'San Antonio, TX'}</div></div>
        ${event.ticketLink ? `<div class="detail"><div class="label">Tickets</div><div class="value"><a href="${event.ticketLink}" style="color:#c8a45e">Purchase →</a></div></div>` : ''}
      </div>
    </div>

    ${content?.press ? `
    <!-- Press Release -->
    <div class="section">
      <h2>Press Release</h2>
      <div class="press-release">${content.press.replace(/\n/g, '<br>')}</div>
    </div>` : ''}

    ${content?.spanish_press ? `
    <!-- Spanish Press Release -->
    <div class="section">
      <h2>Nota de Prensa 🇲🇽</h2>
      <div class="press-release">${content.spanish_press.replace(/\n/g, '<br>')}</div>
    </div>` : ''}

    ${images?.length > 0 ? `
    <!-- Media Gallery -->
    <div class="section">
      <h2>Media Assets</h2>
      <p style="font-size:0.85rem;color:#888;margin-bottom:16px">High-resolution files available for press use. Right-click to download.</p>
      <div class="gallery">
        ${images.filter(i => i.url).map(i => `<div><img src="${i.url}" alt="${i.label}"><div class="img-label">${i.label}</div></div>`).join('')}
      </div>
    </div>` : ''}

    ${research?.artists?.length > 0 ? `
    <!-- Artists / Stakeholders -->
    <div class="section">
      <h2>About the Artists</h2>
      <div class="stakeholders">
        ${research.artists.map(a => `
        <div class="stakeholder">
          <div class="name">${a.name}</div>
          <div class="bio">${a.bio || ''}</div>
          <div class="links">
            ${a.spotifyUrl ? `<a href="${a.spotifyUrl}" target="_blank">🎵 Spotify</a>` : ''}
            ${a.instagramHandle ? `<a href="https://instagram.com/${a.instagramHandle.replace('@','')}" target="_blank">📸 Instagram</a>` : ''}
            ${a.websiteUrl ? `<a href="${a.websiteUrl}" target="_blank">🌐 Website</a>` : ''}
          </div>
        </div>`).join('')}
      </div>
    </div>` : ''}

    ${research?.venue ? `
    <!-- Venue Info -->
    <div class="section">
      <h2>About ${research.venue.name || venueName}</h2>
      <p>${research.venue.description || ''}</p>
      ${research.venue.knownFor?.length ? `<p style="font-size:0.9rem;color:#555;margin-top:8px"><strong>Known for:</strong> ${research.venue.knownFor.join(', ')}</p>` : ''}
    </div>` : ''}

    <!-- Map -->
    <div class="section">
      <h2>Location</h2>
      <div class="map-container">
        <iframe src="${mapsEmbed}" allowfullscreen loading="lazy"></iframe>
      </div>
      <p style="text-align:center;margin-top:8px"><a href="${mapsUrl}" target="_blank" style="color:#c8a45e;font-size:0.9rem">📍 Get Directions →</a></p>
    </div>

    ${content?.social ? `
    <!-- Social Copy -->
    <div class="section">
      <h2>Social Media</h2>
      <div class="press-release" style="font-size:0.9rem">${content.social.replace(/\n/g, '<br>')}</div>
    </div>` : ''}

    <!-- Media Contact -->
    <div class="section">
      <h2>Media Contact</h2>
      <p><strong>Good Creative Media</strong><br>
      Email: <a href="mailto:thisisthegoodlife@juliegood.com" style="color:#c8a45e">thisisthegoodlife@juliegood.com</a><br>
      Web: <a href="https://goodcreativemedia.com" style="color:#c8a45e">goodcreativemedia.com</a></p>
    </div>
  </div>

  <div class="footer">
    <p>${venueName} — ${event.title} — ${eventDate}</p>
    <p class="badge" style="margin-top:8px">Press page powered by <a href="https://goodcreativemedia.com">The IMC Machine</a> — Good Creative Media, San Antonio TX</p>
    <p class="badge" style="margin-top:4px">The IMC Machine™ · © ${new Date().getFullYear()} Julie Good. All Rights Reserved.</p>
    <p class="badge" style="margin-top:2px">Created by Julie Good · Good Creative Media · San Antonio, TX</p>
  </div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// MASTER TAG SHEET — Stakeholder intelligence for social tagging
// Patent ref: §13.6 Automated PR Research and Stakeholder Intelligence
// ═══════════════════════════════════════════════════════════════

export function generateMasterTagSheet(research) {
  if (!research) return [];
  
  const tags = [];
  
  // Venue
  if (research.venue) {
    tags.push({
      type: 'venue',
      name: research.venue.name,
      instagram: research.venue.socialMedia?.instagram || null,
      facebook: research.venue.socialMedia?.facebook || null,
      twitter: research.venue.socialMedia?.twitter || null,
      website: research.venue.website || null,
      hashtags: [`#${(research.venue.name || '').replace(/[^a-zA-Z0-9]/g, '')}`, '#SanAntonio', '#SATX'],
    });
  }
  
  // Artists
  if (research.artists) {
    for (const a of research.artists) {
      tags.push({
        type: 'artist',
        name: a.name,
        instagram: a.instagramHandle || null,
        spotify: a.spotifyUrl || null,
        website: a.websiteUrl || null,
        hashtags: [
          `#${(a.name || '').replace(/[^a-zA-Z0-9]/g, '')}`,
          ...(a.genre ? [`#${a.genre.replace(/[^a-zA-Z0-9]/g, '')}`] : []),
        ],
      });
    }
  }
  
  // Context hashtags
  if (research.context?.hashtagSuggestions) {
    tags.push({
      type: 'context',
      name: 'Event Hashtags',
      hashtags: research.context.hashtagSuggestions,
    });
  }
  
  return tags;
}

// Format tags for a specific platform
export function formatTagsForPlatform(tags, platform = 'instagram') {
  const mentions = [];
  const hashtags = new Set();
  
  for (const tag of tags) {
    // Mentions
    if (platform === 'instagram' && tag.instagram) {
      mentions.push(tag.instagram.startsWith('@') ? tag.instagram : `@${tag.instagram}`);
    }
    if (platform === 'facebook' && tag.facebook) {
      mentions.push(tag.facebook);
    }
    
    // Hashtags
    if (tag.hashtags) {
      tag.hashtags.forEach(h => hashtags.add(h));
    }
  }
  
  return {
    mentions: mentions.filter(Boolean),
    hashtags: [...hashtags],
    mentionString: mentions.join(' '),
    hashtagString: [...hashtags].join(' '),
  };
}
