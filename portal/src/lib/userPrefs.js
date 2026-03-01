export const USER_PREFS_UPDATED_EVENT = 'imc-user-prefs-updated';

export const FLOATING_BUTTON_MODE_OPTIONS = [
  {
    value: 'compact',
    label: 'Compact',
    description: 'Smaller chips: ↑ Top and 🐈‍⬛ Buddy.',
  },
  {
    value: 'standard',
    label: 'Standard',
    description: 'Larger buttons with full labels for easier tapping.',
  },
  {
    value: 'hidden_mobile',
    label: 'Hidden on mobile',
    description: 'Hide floating buttons on phones, keep them on tablet and desktop.',
  },
];

const DEFAULT_USER_PREFS = {
  notifications: {},
  ui: {
    floatingButtonsMode: 'compact',
  },
};

const VALID_FLOATING_BUTTON_MODES = new Set(
  FLOATING_BUTTON_MODE_OPTIONS.map((option) => option.value)
);

function storageKey(userId) {
  return `user_prefs_${userId || 'anonymous'}`;
}

export function normalizeFloatingButtonsMode(mode = '') {
  const normalized = String(mode || '').trim().toLowerCase();
  return VALID_FLOATING_BUTTON_MODES.has(normalized) ? normalized : 'compact';
}

export function getUserPrefs(userId) {
  if (typeof window === 'undefined' || !userId) return { ...DEFAULT_USER_PREFS };
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return { ...DEFAULT_USER_PREFS };
    const parsed = JSON.parse(raw);
    return {
      notifications: { ...(parsed?.notifications || {}) },
      ui: {
        floatingButtonsMode: normalizeFloatingButtonsMode(parsed?.ui?.floatingButtonsMode),
      },
      updatedAt: parsed?.updatedAt || null,
    };
  } catch {
    return { ...DEFAULT_USER_PREFS };
  }
}

export function saveUserPrefs(userId, patch = {}) {
  if (typeof window === 'undefined' || !userId) return { ...DEFAULT_USER_PREFS };

  const current = getUserPrefs(userId);
  const merged = {
    notifications: {
      ...(current.notifications || {}),
      ...(patch.notifications || {}),
    },
    ui: {
      floatingButtonsMode: normalizeFloatingButtonsMode(
        patch?.ui?.floatingButtonsMode ?? current?.ui?.floatingButtonsMode
      ),
    },
    updatedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(storageKey(userId), JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent(USER_PREFS_UPDATED_EVENT, { detail: { userId, prefs: merged } }));
  return merged;
}

export function getFloatingButtonsMode(userId) {
  return normalizeFloatingButtonsMode(getUserPrefs(userId)?.ui?.floatingButtonsMode);
}
