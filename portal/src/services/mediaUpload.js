function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadImageAsset({
  file,
  userId,
  category = 'profile',
  label = '',
  eventId = null,
}) {
  if (!file) throw new Error('File is required');
  if (!userId) throw new Error('User ID is required');

  const base64 = await toBase64(file);
  const response = await fetch('/api/media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'upload',
      base64,
      category,
      label: label || file.name.replace(/\.[^.]+$/, ''),
      eventId,
      userId,
      fileName: file.name,
      mimeType: file.type || 'image/jpeg',
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || 'Upload failed');
  }
  return String(payload.url || payload.record?.original_url || '').trim();
}

export async function uploadImageAssetsBatch({
  files = [],
  userId,
  category = 'event_media',
  eventId = null,
}) {
  const list = Array.from(files || []);
  const uploaded = [];
  for (const file of list) {
    const url = await uploadImageAsset({
      file,
      userId,
      category,
      eventId,
    });
    uploaded.push({
      url,
      name: file.name,
      source: 'upload',
      mimeType: file.type || '',
    });
  }
  return uploaded;
}
