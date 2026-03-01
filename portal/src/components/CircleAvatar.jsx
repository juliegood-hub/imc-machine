import { initialsFromName, resolveEntityAvatarUrl } from '../lib/entityAvatar';

export default function CircleAvatar({
  entity = {},
  type = '',
  name = '',
  src = '',
  size = 'w-10 h-10',
  textSize = 'text-xs',
  className = '',
}) {
  const computedName = String(name || entity?.name || entity?.title || '').trim();
  const imageUrl = String(src || resolveEntityAvatarUrl(entity, type) || '').trim();
  const initials = initialsFromName(computedName);
  const classes = `${size} rounded-full overflow-hidden bg-[#f1ede4] border border-[#d8c7a4] flex items-center justify-center text-[#7f5f2b] font-semibold ${textSize} ${className}`.trim();

  if (imageUrl) {
    return (
      <span className={classes}>
        <img src={imageUrl} alt={computedName || 'Profile'} className="w-full h-full object-cover" />
      </span>
    );
  }

  return <span className={classes}>{initials}</span>;
}
