function firstUrl(items = []) {
  if (!Array.isArray(items)) return '';
  for (const item of items) {
    if (!item) continue;
    if (typeof item === 'string' && item.trim()) return item.trim();
    if (typeof item === 'object') {
      const candidate = String(
        item.url
        || item.original_url
        || item.image_url
        || item.poster_url
        || ''
      ).trim();
      if (candidate) return candidate;
    }
  }
  return '';
}

export function resolveMainPosterUrl(entity = {}) {
  const productionDetails = (entity.productionDetails && typeof entity.productionDetails === 'object')
    ? entity.productionDetails
    : (entity.production_details && typeof entity.production_details === 'object')
      ? entity.production_details
      : {};
  const metadata = (entity.metadata && typeof entity.metadata === 'object') ? entity.metadata : {};

  return String(
    entity.mainPosterUrl
    || entity.main_poster_url
    || entity.posterUrl
    || entity.poster_url
    || entity.image_url
    || entity.imageUrl
    || productionDetails.mainPosterUrl
    || productionDetails.posterUrl
    || metadata.mainPosterUrl
    || firstUrl(productionDetails.uploadedImages)
    || firstUrl(entity.uploadedImages)
    || firstUrl(metadata.uploadedImages)
    || ''
  ).trim();
}

export function resolveEntityAvatarUrl(entity = {}, type = '') {
  const metadata = (entity.metadata && typeof entity.metadata === 'object') ? entity.metadata : {};
  const typeKey = String(type || '').trim().toLowerCase();
  const mainPosterUrl = resolveMainPosterUrl(entity);

  const explicit = String(
    entity.avatarUrl
    || entity.avatar_url
    || metadata.avatarUrl
    || entity.profileImageUrl
    || entity.profile_image_url
    || ''
  ).trim();
  if (explicit) return explicit;

  if (typeKey === 'event') {
    return mainPosterUrl;
  }

  const roleImage = String(
    entity.headshot
    || entity.headshot_url
    || entity.logo
    || entity.logo_url
    || ''
  ).trim();
  if (roleImage) return roleImage;

  return mainPosterUrl;
}

export function initialsFromName(name = '') {
  const cleaned = String(name || '').trim();
  if (!cleaned) return 'IMC';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}
