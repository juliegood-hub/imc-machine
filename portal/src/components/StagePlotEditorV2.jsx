import { useEffect, useMemo, useRef, useState } from 'react';
import { STAGE_PLOT_ITEM_LIBRARY } from '../constants/productionLibrary';

const CELL = 24;
const MAX_VERSION_HISTORY_ENTRIES = 30;
const DEFAULT_LAYOUT = {
  width: 24,
  depth: 16,
  ceilingHeightFeet: '',
  gridHeightFeet: '',
  stageTrimHeightFeet: '',
  maxOccupancy: '',
  structuralColumns: '',
  walls: '',
  windows: '',
  fixedBars: '',
  fixedFeatures: '',
  terminologyMode: 'theater',
  viewMode: 'physical',
  overlayMode: 'both',
  houseLayerLocked: false,
  lightingProMode: false,
  soundProMode: false,
  projectionProMode: false,
  labelDisplayMode: 'item',
  egress: {
    showPaths: false,
    showFireLanes: false,
    highlightEmergencyExits: true,
    showCrowdFlowArrows: false,
    notes: '',
  },
  exportOptions: {
    includeSystemTypes: true,
    includeDefaultLabels: true,
    includeCustomLabels: true,
    includeBoth: false,
  },
  sharing: {
    visibility: 'private',
    publishState: 'draft',
    ownerName: '',
    ownerEmail: '',
    eventShare: { enabled: true, permission: 'viewer' },
    organizationShare: { enabled: false, permission: 'viewer' },
    venueShare: { enabled: false, permission: 'viewer' },
    individuals: [],
    groups: [],
    links: [],
    comments: [],
    versionHistory: [],
    audit: {
      updatedAt: '',
      updatedBy: '',
      updatedByEmail: '',
      publishedAt: '',
      publishedBy: '',
      publishedByEmail: '',
      publishNote: '',
    },
  },
  houseSystem: {
    houseLightControlLocation: '',
    relayPanelLocation: '',
    houseLightController: '',
    emergencyLightingCircuits: '',
    houseLooks: '',
    monitorWorldLocation: '',
    houseConsoleLocation: '',
    housePatchInfrastructure: '',
  },
  equipmentLibrary: [],
  items: [],
};

const VIEW_MODES = [
  { value: 'physical', label: 'Physical' },
  { value: 'lighting', label: 'Lighting' },
  { value: 'lighting_focus', label: 'Focus View' },
  { value: 'sound', label: 'Sound' },
  { value: 'projection_video', label: 'Projection / Video' },
  { value: 'operations', label: 'Operations' },
  { value: 'power', label: 'Power View' },
  { value: 'safety', label: 'Safety / Egress' },
  { value: 'surveillance', label: 'Surveillance View' },
  { value: 'access_control', label: 'Access Control View' },
  { value: 'weather_risk', label: 'Weather Risk View' },
];

const OVERLAY_MODES = [
  { value: 'both', label: 'House + Show' },
  { value: 'house', label: 'House Only' },
  { value: 'show', label: 'Show Only' },
];

const ITEM_LAYER_OPTIONS = [
  { value: 'show', label: 'Show Overlay' },
  { value: 'house', label: 'House System' },
];

const LABEL_DISPLAY_MODES = [
  { value: 'item', label: 'Per-item visibility' },
  { value: 'system', label: 'System only' },
  { value: 'custom', label: 'Custom only' },
  { value: 'both', label: 'System + Custom' },
];

const SHARE_PERMISSION_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'editor', label: 'Editor' },
  { value: 'commenter', label: 'Commenter' },
  { value: 'viewer', label: 'Viewer' },
];

const SHARE_VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private (explicit only)' },
  { value: 'event', label: 'Event-visible' },
  { value: 'organization', label: 'Org-visible' },
  { value: 'venue', label: 'Venue-visible' },
];

const PUBLISH_STATE_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
];

const DEFAULT_ROLE_GROUPS = [
  { key: 'lighting', label: 'Lighting' },
  { key: 'sound', label: 'Sound' },
  { key: 'ops', label: 'Ops' },
  { key: 'stage_management', label: 'Stage Management' },
  { key: 'vendors_artists', label: 'Vendors/Artists' },
  { key: 'foh', label: 'FOH Staff' },
];

const CUSTOM_LABEL_VISIBILITY_OPTIONS = [
  { value: 'custom', label: 'Show custom only' },
  { value: 'both', label: 'Show both (system + custom)' },
  { value: 'system', label: 'Show system only' },
];

const VOLTAGE_OPTIONS = ['120V', '208V', '240V', '3-Phase'];
const DOOR_SWING_OPTIONS = ['in', 'out', 'sliding', 'roll-up'];
const ENTRY_TYPE_OPTIONS = ['public', 'crew', 'boh', 'emergency'];
const SIGNAL_TYPE_OPTIONS = ['HDMI', 'SDI', 'NDI', 'DisplayPort', 'Fiber', 'Analog'];
const DMX_MODE_OPTIONS = ['8-bit', '16-bit', 'Extended', 'Custom'];
const LIGHTING_PURPOSE_OPTIONS = ['wash', 'special', 'backlight', 'sidelight', 'practical', 'effect'];
const LIGHTING_SNAP_ZONES = [
  { value: 'foh_1', label: 'FOH 1', xPct: 0.15, yPct: 0.08 },
  { value: 'foh_2', label: 'FOH 2', xPct: 0.82, yPct: 0.08 },
  { value: 'balcony_rail', label: 'Balcony Rail', xPct: 0.5, yPct: 0.12 },
  { value: 'first_electric', label: '1st Electric', xPct: 0.5, yPct: 0.25 },
  { value: 'second_electric', label: '2nd Electric', xPct: 0.5, yPct: 0.4 },
  { value: 'third_electric', label: '3rd Electric', xPct: 0.5, yPct: 0.56 },
  { value: 'box_boom_sl', label: 'Box Boom SL', xPct: 0.1, yPct: 0.38 },
  { value: 'box_boom_sr', label: 'Box Boom SR', xPct: 0.9, yPct: 0.38 },
  { value: 'ground_row', label: 'Ground Row', xPct: 0.5, yPct: 0.82 },
  { value: 'catwalk', label: 'Catwalk', xPct: 0.5, yPct: 0.18 },
  { value: 'grid_pipe', label: 'Grid Pipe', xPct: 0.5, yPct: 0.32 },
];

const CATEGORY_LABELS = {
  physical: 'Physical',
  safety: 'Doors / Safety',
  surveillance: 'Surveillance / CCTV',
  access_control: 'Access Control',
  weather: 'Weather / Medical',
  sound: 'Audio / Sound',
  lighting: 'Lighting (LX)',
  video: 'Projection / Video',
  operations: 'Operations',
  power: 'Power / Electrical',
  comms: 'Comms',
};

const TERMINOLOGY_HINTS = {
  theater: ['Stage Left', 'Stage Right', 'FOH', 'Electrics', 'Fly rail', 'Company switch'],
  gallery: ['Display wall', 'Pedestal row', 'Vendor zone', 'Public entry'],
  workshop: ['Presenter zone', 'Audience seating', 'Breakout area', 'Charging station'],
  vendor: ['Booth grid', 'Shared power drop', 'Aisle spacing', 'Public flow'],
  touring: ['Load-in', 'Local crew', 'Tour patch', 'Generator and distro'],
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toNumberOrBlank(value) {
  if (value === '' || value === null || value === undefined) return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : '';
}

function safeText(value, max = 240) {
  return String(value || '').slice(0, max);
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      const base64 = value.includes(',') ? value.split(',')[1] : value;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function slugify(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildIndexedLabel(base = 'Item', index = 1) {
  return `${String(base || 'Item')} ${index}`.trim();
}

function inferCategory(template = {}, item = {}) {
  return item.category || template.category || 'physical';
}

function defaultLayerForCategory(category = '', template = {}) {
  if (template?.defaultLayer === 'house') return 'house';
  const value = String(category || '').toLowerCase();
  if (['lighting', 'sound', 'video', 'power'].includes(value)) return 'show';
  return 'show';
}

function normalizeOverlayMode(value = '') {
  return ['both', 'house', 'show'].includes(value) ? value : 'both';
}

function isVisibleInOverlay(item = {}, overlayMode = 'both') {
  const layer = item?.layer === 'house' ? 'house' : 'show';
  if (overlayMode === 'house') return layer === 'house';
  if (overlayMode === 'show') return layer !== 'house';
  return true;
}

function getSnapZonePosition(layout = DEFAULT_LAYOUT, zoneValue = '') {
  const zone = LIGHTING_SNAP_ZONES.find((entry) => entry.value === zoneValue);
  if (!zone) return null;
  const width = Number(layout?.width || DEFAULT_LAYOUT.width);
  const depth = Number(layout?.depth || DEFAULT_LAYOUT.depth);
  return {
    x: clamp(Math.round((width - 1) * zone.xPct), 0, Math.max(width - 1, 0)),
    y: clamp(Math.round((depth - 1) * zone.yPct), 0, Math.max(depth - 1, 0)),
  };
}

function isLightingCategory(item = {}) {
  return String(item?.category || '').toLowerCase() === 'lighting';
}

function isSoundCategory(item = {}) {
  return String(item?.category || '').toLowerCase() === 'sound';
}

function isVideoCategory(item = {}) {
  return String(item?.category || '').toLowerCase() === 'video';
}

function isElectricalSource(item = {}) {
  return !!item.isElectricalSource;
}

function isDoor(item = {}) {
  return !!item.isDoor;
}

function inferAmps(item = {}) {
  const direct = Number(item.amperage);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const watts = Number(item.wattage);
  const voltageRaw = String(item.voltage || '120V');
  const baseVoltage = Number(voltageRaw.replace(/[^0-9.]/g, '')) || 120;
  if (Number.isFinite(watts) && watts > 0 && Number.isFinite(baseVoltage) && baseVoltage > 0) {
    return watts / baseVoltage;
  }
  return 0;
}

function resolveItemLabelMode(item = {}, globalMode = 'item') {
  if (globalMode !== 'item') return globalMode;
  return item.customLabelVisibility || 'both';
}

function buildDisplayLabel(item = {}, globalMode = 'item') {
  const mode = resolveItemLabelMode(item, globalMode);
  const system = safeText(item.systemType || item.type || 'Item', 80);
  const fallbackDefault = safeText(item.defaultLabel || item.label || system, 80);
  const custom = safeText(item.customLabel || '', 120);

  if (mode === 'custom') return custom || fallbackDefault || system;
  if (mode === 'system') return fallbackDefault || system;
  if (mode === 'both' && custom) return `${fallbackDefault} · ${custom}`;
  return fallbackDefault || custom || system;
}

function buildPersistedItem(item = {}, globalMode = 'item') {
  return {
    ...item,
    type: item.type || slugify(item.systemType || item.defaultLabel || 'item'),
    category: item.category || 'physical',
    label: item.customLabel || item.defaultLabel || item.systemType || item.type || 'Item',
    displayLabel: buildDisplayLabel(item, globalMode),
  };
}

function normalizeItem(raw = {}, index = 0, templateMap = new Map()) {
  const template = templateMap.get(raw.type) || {};
  const systemType = safeText(raw.systemType || template.label || raw.type || 'Item', 120);
  const defaultLabel = safeText(raw.defaultLabel || raw.label || buildIndexedLabel(systemType, index + 1), 120);
  const customLabel = safeText(raw.customLabel || raw.custom_label || '', 180);

  return {
    id: raw.id || `plot-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${index}`,
    type: raw.type || slugify(systemType),
    category: inferCategory(template, raw),
    systemType,
    defaultLabel,
    customLabel,
    customLabelVisibility: ['custom', 'system', 'both'].includes(raw.customLabelVisibility || raw.custom_label_visibility)
      ? (raw.customLabelVisibility || raw.custom_label_visibility)
      : (customLabel ? 'both' : 'system'),
    layer: ['house', 'show'].includes(raw.layer) ? raw.layer : defaultLayerForCategory(inferCategory(template, raw), template),
    x: Number.isFinite(Number(raw.x)) ? Number(raw.x) : 0,
    y: Number.isFinite(Number(raw.y)) ? Number(raw.y) : 0,
    w: Number.isFinite(Number(raw.w)) && Number(raw.w) > 0 ? Number(raw.w) : (template.w || 1),
    h: Number.isFinite(Number(raw.h)) && Number(raw.h) > 0 ? Number(raw.h) : (template.h || 1),
    rotation: Number.isFinite(Number(raw.rotation)) ? Number(raw.rotation) : 0,

    assignedPerson: safeText(raw.assignedPerson || raw.assigned_person || '', 120),
    role: safeText(raw.role || '', 120),
    department: safeText(raw.department || '', 80),
    notes: safeText(raw.notes || '', 1200),
    tags: Array.isArray(raw.tags)
      ? raw.tags.map((tag) => safeText(tag, 40)).filter(Boolean)
      : String(raw.tags || '')
        .split(',')
        .map((tag) => safeText(tag.trim(), 40))
        .filter(Boolean),

    powerRequired: raw.powerRequired !== undefined
      ? !!raw.powerRequired
      : !!template.powerRequired,
    wattage: toNumberOrBlank(raw.wattage ?? template.defaultWattage ?? ''),
    voltage: safeText(raw.voltage || template.defaultVoltage || '120V', 20),
    amperage: toNumberOrBlank(raw.amperage ?? ''),
    assignedCircuitId: safeText(raw.assignedCircuitId || '', 120),
    departmentOwner: safeText(raw.departmentOwner || raw.department_owner || '', 80),

    isElectricalSource: raw.isElectricalSource !== undefined
      ? !!raw.isElectricalSource
      : !!template.isElectricalSource,
    sourceVoltage: safeText(raw.sourceVoltage || template.defaultVoltage || raw.voltage || '120V', 20),
    sourceAmperage: toNumberOrBlank(raw.sourceAmperage ?? template.defaultAmperage ?? raw.amperage ?? ''),

    isDoor: raw.isDoor !== undefined ? !!raw.isDoor : !!template.isDoor,
    doorWidthFeet: toNumberOrBlank(raw.doorWidthFeet ?? template.defaultDoorWidthFeet ?? ''),
    swingDirection: safeText(raw.swingDirection || (template.isRollUpDoor ? 'roll-up' : 'in') || 'in', 24),
    isDoubleDoor: raw.isDoubleDoor !== undefined ? !!raw.isDoubleDoor : !!template.isDoubleDoor,
    isRollUpDoor: raw.isRollUpDoor !== undefined ? !!raw.isRollUpDoor : !!template.isRollUpDoor,
    isEmergencyExit: raw.isEmergencyExit !== undefined ? !!raw.isEmergencyExit : !!template.isEmergencyExit,
    isADA: raw.isADA !== undefined ? !!raw.isADA : !!template.isADA,
    entryType: safeText(raw.entryType || template.defaultEntryType || 'public', 24),

    // Lighting metadata (basic + pro)
    channel: safeText(raw.channel || '', 64),
    dimmer: safeText(raw.dimmer || '', 64),
    circuit: safeText(raw.circuit || '', 64),
    unitNumber: safeText(raw.unitNumber || raw.unit_number || '', 64),
    universe: safeText(raw.universe || '', 64),
    dmxAddress: safeText(raw.dmxAddress || raw.dmx_address || '', 64),
    dmxMode: safeText(raw.dmxMode || raw.mode || '', 64),
    gel: safeText(raw.gel || '', 64),
    gobo: safeText(raw.gobo || '', 64),
    focusArea: safeText(raw.focusArea || raw.focus_area || '', 180),
    focusNotes: safeText(raw.focusNotes || raw.focus_notes || '', 500),
    purpose: safeText(raw.purpose || '', 80),
    riggingPosition: safeText(raw.riggingPosition || raw.rigging_position || '', 80),
    snapZone: safeText(raw.snapZone || raw.snap_zone || '', 80),
    powerDrawWatts: toNumberOrBlank(raw.powerDrawWatts ?? raw.power_draw_watts ?? raw.wattage ?? ''),

    // Sound metadata (basic + pro)
    inputNumber: safeText(raw.inputNumber || raw.input_number || '', 64),
    sourceName: safeText(raw.sourceName || raw.source || '', 180),
    micType: safeText(raw.micType || '', 120),
    phantom: raw.phantom !== undefined ? !!raw.phantom : false,
    insertPoint: safeText(raw.insertPoint || raw.insert || '', 120),
    fohPatch: safeText(raw.fohPatch || raw.foh_patch || '', 120),
    monitorSend: safeText(raw.monitorSend || raw.monitor_send || '', 120),
    rfFrequency: safeText(raw.rfFrequency || raw.rf_frequency || '', 80),
    packNumber: safeText(raw.packNumber || raw.pack_number || '', 80),
    spareAssigned: raw.spareAssigned !== undefined ? !!raw.spareAssigned : false,

    // Projection / video metadata
    signalType: safeText(raw.signalType || raw.signal_type || '', 80),
    resolution: safeText(raw.resolution || '', 80),
    aspectRatio: safeText(raw.aspectRatio || raw.aspect_ratio || '', 40),
    throwDistance: safeText(raw.throwDistance || raw.throw_distance || '', 80),
    lensNotes: safeText(raw.lensNotes || raw.lens_notes || '', 240),
    outputMapping: safeText(raw.outputMapping || raw.output_mapping || '', 180),
    targetOutput: safeText(raw.targetOutput || raw.target_output || '', 120),

    manufacturer: safeText(raw.manufacturer || '', 120),
    model: safeText(raw.model || '', 120),
  };
}

function normalizeLayout(layout = DEFAULT_LAYOUT) {
  const templateMap = new Map(STAGE_PLOT_ITEM_LIBRARY.map((item) => [item.type, item]));
  const egress = (layout.egress && typeof layout.egress === 'object') ? layout.egress : {};
  const exportOptions = (layout.exportOptions && typeof layout.exportOptions === 'object')
    ? layout.exportOptions
    : {};
  const houseSystem = (layout.houseSystem && typeof layout.houseSystem === 'object') ? layout.houseSystem : {};
  const equipmentLibrary = Array.isArray(layout.equipmentLibrary) ? layout.equipmentLibrary : [];

  return {
    width: Number(layout.width) > 0 ? Number(layout.width) : DEFAULT_LAYOUT.width,
    depth: Number(layout.depth) > 0 ? Number(layout.depth) : DEFAULT_LAYOUT.depth,
    ceilingHeightFeet: toNumberOrBlank(layout.ceilingHeightFeet),
    gridHeightFeet: toNumberOrBlank(layout.gridHeightFeet),
    stageTrimHeightFeet: toNumberOrBlank(layout.stageTrimHeightFeet),
    maxOccupancy: toNumberOrBlank(layout.maxOccupancy),
    structuralColumns: safeText(layout.structuralColumns || '', 1000),
    walls: safeText(layout.walls || '', 1000),
    windows: safeText(layout.windows || '', 1000),
    fixedBars: safeText(layout.fixedBars || '', 1000),
    fixedFeatures: safeText(layout.fixedFeatures || '', 1000),
    terminologyMode: safeText(layout.terminologyMode || 'theater', 40),
    viewMode: safeText(layout.viewMode || 'physical', 20),
    overlayMode: normalizeOverlayMode(layout.overlayMode || 'both'),
    houseLayerLocked: layout.houseLayerLocked !== undefined ? !!layout.houseLayerLocked : false,
    lightingProMode: !!layout.lightingProMode,
    soundProMode: !!layout.soundProMode,
    projectionProMode: !!layout.projectionProMode,
    labelDisplayMode: safeText(layout.labelDisplayMode || 'item', 20),
    egress: {
      showPaths: egress.showPaths !== undefined ? !!egress.showPaths : false,
      showFireLanes: egress.showFireLanes !== undefined ? !!egress.showFireLanes : false,
      highlightEmergencyExits: egress.highlightEmergencyExits !== undefined ? !!egress.highlightEmergencyExits : true,
      showCrowdFlowArrows: egress.showCrowdFlowArrows !== undefined ? !!egress.showCrowdFlowArrows : false,
      notes: safeText(egress.notes || '', 1000),
    },
    exportOptions: {
      includeSystemTypes: exportOptions.includeSystemTypes !== false,
      includeDefaultLabels: exportOptions.includeDefaultLabels !== false,
      includeCustomLabels: exportOptions.includeCustomLabels !== false,
      includeBoth: !!exportOptions.includeBoth,
    },
    houseSystem: {
      houseLightControlLocation: safeText(houseSystem.houseLightControlLocation || '', 200),
      relayPanelLocation: safeText(houseSystem.relayPanelLocation || '', 200),
      houseLightController: safeText(houseSystem.houseLightController || '', 200),
      emergencyLightingCircuits: safeText(houseSystem.emergencyLightingCircuits || '', 500),
      houseLooks: safeText(houseSystem.houseLooks || '', 1000),
      monitorWorldLocation: safeText(houseSystem.monitorWorldLocation || '', 200),
      houseConsoleLocation: safeText(houseSystem.houseConsoleLocation || '', 200),
      housePatchInfrastructure: safeText(houseSystem.housePatchInfrastructure || '', 1000),
    },
    equipmentLibrary: equipmentLibrary.map((entry, index) => ({
      id: String(entry?.id || `eq_${index}_${Math.random().toString(36).slice(2, 8)}`),
      category: safeText(entry?.category || 'equipment', 80),
      systemType: safeText(entry?.systemType || entry?.fixtureType || 'Equipment', 180),
      manufacturer: safeText(entry?.manufacturer || '', 120),
      model: safeText(entry?.model || '', 160),
      powerDrawWatts: toNumberOrBlank(entry?.powerDrawWatts ?? entry?.power_draw_watts ?? ''),
      channelCount: toNumberOrBlank(entry?.channelCount ?? entry?.channel_count ?? ''),
      dmxModes: safeText(entry?.dmxModes || entry?.dmx_modes || '', 500),
      confidence: toNumberOrBlank(entry?.confidence ?? ''),
      confirmed: entry?.confirmed !== false,
      notes: safeText(entry?.notes || '', 1200),
      createdAt: entry?.createdAt || new Date().toISOString(),
    })),
    sharing: normalizeSharing(layout.sharing || {}, layout),
    items: Array.isArray(layout.items)
      ? layout.items.map((item, index) => normalizeItem(item, index, templateMap))
      : [],
  };
}

function materializeLayout(layout = DEFAULT_LAYOUT) {
  const normalized = normalizeLayout(layout);
  return {
    ...normalized,
    sharing: normalizeSharing(normalized.sharing || {}, normalized),
    items: normalized.items.map((item) => buildPersistedItem(item, normalized.labelDisplayMode || 'item')),
  };
}

function isVisibleInMode(item = {}, mode = 'physical') {
  const category = item.category || 'physical';
  if (mode === 'physical') return true;
  if (mode === 'lighting') return ['lighting', 'power', 'physical'].includes(category);
  if (mode === 'lighting_focus') return ['lighting', 'power'].includes(category);
  if (mode === 'sound') return ['sound', 'power', 'physical', 'comms'].includes(category);
  if (mode === 'projection_video') return ['video', 'power', 'operations', 'comms'].includes(category);
  if (mode === 'operations') return ['operations', 'physical', 'safety', 'comms', 'access_control', 'weather'].includes(category);
  if (mode === 'power') return category === 'power' || !!item.powerRequired || !!item.isElectricalSource;
  if (mode === 'safety') return category === 'safety' || !!item.isDoor || category === 'physical';
  if (mode === 'surveillance') return ['surveillance', 'safety', 'physical', 'power'].includes(category);
  if (mode === 'access_control') return ['access_control', 'safety', 'operations', 'physical'].includes(category);
  if (mode === 'weather_risk') return ['weather', 'safety', 'operations', 'physical'].includes(category);
  return true;
}

function colorClassForItem(item = {}, mode = 'physical', isSelected = false, emergencyHighlight = false) {
  if (isSelected) return 'border-[#c8a45e] bg-[#faf4e2]';
  if (mode === 'power' && item.isElectricalSource) return 'border-blue-500 bg-blue-50';
  if (mode === 'power' && item.powerRequired) return 'border-indigo-400 bg-indigo-50';
  if (mode === 'safety' && emergencyHighlight && item.isEmergencyExit) return 'border-green-600 bg-green-50';

  switch (item.category) {
    case 'lighting': return 'border-amber-500 bg-amber-50';
    case 'sound': return 'border-violet-500 bg-violet-50';
    case 'video': return 'border-fuchsia-500 bg-fuchsia-50';
    case 'operations': return 'border-cyan-500 bg-cyan-50';
    case 'power': return 'border-blue-500 bg-blue-50';
    case 'safety': return 'border-green-500 bg-green-50';
    case 'surveillance': return 'border-purple-500 bg-purple-50';
    case 'access_control': return 'border-orange-500 bg-orange-50';
    case 'weather': return 'border-sky-500 bg-sky-50';
    case 'comms': return 'border-teal-500 bg-teal-50';
    default: return 'border-gray-400 bg-white';
  }
}

function createItemFromTemplate(template = {}, layout = DEFAULT_LAYOUT, index = 0) {
  const systemType = template.label || template.type || 'Item';
  const nextNumber = (layout.items || []).filter((item) => (item.systemType || item.type) === systemType).length + 1;
  const defaultLabel = buildIndexedLabel(systemType, nextNumber);

  return normalizeItem({
    id: `plot-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${index}`,
    type: template.type || slugify(systemType),
    category: template.category || 'physical',
    systemType,
    defaultLabel,
    customLabel: '',
    customLabelVisibility: 'both',
    layer: template.defaultLayer === 'house' ? 'house' : 'show',
    x: 0,
    y: 0,
    w: template.w || 1,
    h: template.h || 1,
    rotation: 0,
    notes: '',
    tags: [],
    powerRequired: !!template.powerRequired,
    wattage: template.defaultWattage || '',
    voltage: template.defaultVoltage || '120V',
    isElectricalSource: !!template.isElectricalSource,
    sourceVoltage: template.defaultVoltage || '120V',
    sourceAmperage: template.defaultAmperage || '',
    isDoor: !!template.isDoor,
    doorWidthFeet: template.defaultDoorWidthFeet || '',
    swingDirection: template.isRollUpDoor ? 'roll-up' : 'in',
    isDoubleDoor: !!template.isDoubleDoor,
    isRollUpDoor: !!template.isRollUpDoor,
    isEmergencyExit: !!template.isEmergencyExit,
    isADA: !!template.isADA,
    entryType: template.defaultEntryType || 'public',
    signalType: template.category === 'video' ? 'HDMI' : '',
    resolution: template.category === 'video' ? '1920x1080' : '',
    aspectRatio: template.category === 'video' ? '16:9' : '',
    dmxMode: template.category === 'lighting' ? '16-bit' : '',
    purpose: template.category === 'lighting' ? 'wash' : '',
  }, index, new Map(STAGE_PLOT_ITEM_LIBRARY.map((item) => [item.type, item])));
}

function parseTagInput(value = '') {
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function permissionRank(value = 'viewer') {
  if (value === 'owner') return 4;
  if (value === 'editor') return 3;
  if (value === 'commenter') return 2;
  return 1;
}

function mergePermission(current = 'viewer', next = 'viewer') {
  return permissionRank(next) > permissionRank(current) ? next : current;
}

function toEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function randomShareToken() {
  return `plot_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeMemberRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      name: String(row?.name || row?.displayName || row?.display_name || '').trim(),
      email: toEmail(row?.email || row?.contactEmail || row?.contact_email || ''),
    }))
    .filter((row) => row.name || row.email);
}

function normalizeSharing(raw = {}, layout = DEFAULT_LAYOUT) {
  const sharing = (raw && typeof raw === 'object') ? raw : {};
  const baseGroups = Array.isArray(sharing.groups) ? sharing.groups : [];
  const groups = DEFAULT_ROLE_GROUPS.map((group) => {
    const existing = baseGroups.find((entry) => entry?.key === group.key) || {};
    return {
      key: group.key,
      label: existing.label || group.label,
      enabled: !!existing.enabled,
      permission: ['owner', 'editor', 'commenter', 'viewer'].includes(existing.permission)
        ? existing.permission
        : 'viewer',
    };
  });

  const normalizedVersionHistory = (Array.isArray(sharing.versionHistory) ? sharing.versionHistory : [])
    .map((entry) => {
      const snapshot = (entry?.snapshot && typeof entry.snapshot === 'object') ? deepClone(entry.snapshot) : null;
      const snapshotItems = Array.isArray(snapshot?.items) ? snapshot.items.length : 0;
      return {
        id: String(entry?.id || `version_${Math.random().toString(36).slice(2, 8)}`),
        createdAt: entry?.createdAt || '',
        state: ['draft', 'published'].includes(entry?.state) ? entry.state : 'draft',
        note: safeText(entry?.note || '', 500),
        authorName: safeText(entry?.authorName || '', 140),
        authorEmail: toEmail(entry?.authorEmail || ''),
        width: safeNumber(entry?.width, safeNumber(snapshot?.width, safeNumber(layout?.width, 0))),
        depth: safeNumber(entry?.depth, safeNumber(snapshot?.depth, safeNumber(layout?.depth, 0))),
        itemCount: safeNumber(entry?.itemCount, snapshotItems),
        snapshot,
      };
    })
    .filter((entry) => entry.createdAt && entry.snapshot)
    .slice(0, MAX_VERSION_HISTORY_ENTRIES);

  return {
    visibility: ['private', 'event', 'organization', 'venue'].includes(sharing.visibility)
      ? sharing.visibility
      : 'private',
    publishState: ['draft', 'published'].includes(sharing.publishState)
      ? sharing.publishState
      : 'draft',
    ownerName: safeText(sharing.ownerName || '', 140),
    ownerEmail: toEmail(sharing.ownerEmail || ''),
    eventShare: {
      enabled: sharing?.eventShare?.enabled !== false,
      permission: ['owner', 'editor', 'commenter', 'viewer'].includes(sharing?.eventShare?.permission)
        ? sharing.eventShare.permission
        : 'viewer',
    },
    organizationShare: {
      enabled: !!sharing?.organizationShare?.enabled,
      permission: ['owner', 'editor', 'commenter', 'viewer'].includes(sharing?.organizationShare?.permission)
        ? sharing.organizationShare.permission
        : 'viewer',
    },
    venueShare: {
      enabled: !!sharing?.venueShare?.enabled,
      permission: ['owner', 'editor', 'commenter', 'viewer'].includes(sharing?.venueShare?.permission)
        ? sharing.venueShare.permission
        : 'viewer',
    },
    individuals: (Array.isArray(sharing.individuals) ? sharing.individuals : [])
      .map((entry) => ({
        name: safeText(entry?.name || '', 140),
        email: toEmail(entry?.email || ''),
        permission: ['owner', 'editor', 'commenter', 'viewer'].includes(entry?.permission) ? entry.permission : 'viewer',
      }))
      .filter((entry) => entry.email),
    groups,
    links: (Array.isArray(sharing.links) ? sharing.links : [])
      .map((entry) => ({
        id: entry?.id || `link_${Math.random().toString(36).slice(2, 8)}`,
        token: safeText(entry?.token || randomShareToken(), 120),
        permission: ['commenter', 'viewer'].includes(entry?.permission) ? entry.permission : 'viewer',
        expiresAt: entry?.expiresAt || '',
        createdAt: entry?.createdAt || '',
        createdBy: safeText(entry?.createdBy || '', 120),
      })),
    comments: (Array.isArray(sharing.comments) ? sharing.comments : [])
      .map((entry) => ({
        id: entry?.id || `comment_${Math.random().toString(36).slice(2, 8)}`,
        text: safeText(entry?.text || '', 2000),
        authorName: safeText(entry?.authorName || '', 140),
        authorEmail: toEmail(entry?.authorEmail || ''),
        createdAt: entry?.createdAt || '',
      }))
      .filter((entry) => entry.text),
    versionHistory: normalizedVersionHistory,
    audit: {
      updatedAt: sharing?.audit?.updatedAt || '',
      updatedBy: safeText(sharing?.audit?.updatedBy || '', 140),
      updatedByEmail: toEmail(sharing?.audit?.updatedByEmail || ''),
      publishedAt: sharing?.audit?.publishedAt || '',
      publishedBy: safeText(sharing?.audit?.publishedBy || '', 140),
      publishedByEmail: toEmail(sharing?.audit?.publishedByEmail || ''),
      publishNote: safeText(sharing?.audit?.publishNote || '', 500),
    },
    exportEnabledForViewers: sharing.exportEnabledForViewers !== false,
    versionNotes: safeText(sharing.versionNotes || '', 500),
  };
}

function resolveMembership({
  currentEmail = '',
  currentMembership = {},
  eventMembers = [],
  organizationMembers = [],
  venueMembers = [],
  currentUser = {},
}) {
  const email = toEmail(currentEmail || currentUser?.email || '');
  const eventEmails = new Set(eventMembers.map((row) => toEmail(row.email)));
  const orgEmails = new Set(organizationMembers.map((row) => toEmail(row.email)));
  const venueEmails = new Set(venueMembers.map((row) => toEmail(row.email)));
  const roleKeys = Array.isArray(currentMembership?.groups)
    ? currentMembership.groups.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)
    : [];

  return {
    isEventMember: currentMembership?.event === true || (!!email && eventEmails.has(email)),
    isOrganizationMember: currentMembership?.organization === true || (!!email && orgEmails.has(email)),
    isVenueMember: currentMembership?.venue === true || (!!email && venueEmails.has(email)),
    groupKeys: roleKeys,
  };
}

function buildLayoutSnapshot(layout = DEFAULT_LAYOUT) {
  const normalizedLayout = normalizeLayout(layout);
  return deepClone({
    width: normalizedLayout.width,
    depth: normalizedLayout.depth,
    ceilingHeightFeet: normalizedLayout.ceilingHeightFeet,
    gridHeightFeet: normalizedLayout.gridHeightFeet,
    stageTrimHeightFeet: normalizedLayout.stageTrimHeightFeet,
    maxOccupancy: normalizedLayout.maxOccupancy,
    structuralColumns: normalizedLayout.structuralColumns,
    walls: normalizedLayout.walls,
    windows: normalizedLayout.windows,
    fixedBars: normalizedLayout.fixedBars,
    fixedFeatures: normalizedLayout.fixedFeatures,
    terminologyMode: normalizedLayout.terminologyMode,
    viewMode: normalizedLayout.viewMode,
    overlayMode: normalizedLayout.overlayMode,
    houseLayerLocked: normalizedLayout.houseLayerLocked,
    lightingProMode: normalizedLayout.lightingProMode,
    soundProMode: normalizedLayout.soundProMode,
    projectionProMode: normalizedLayout.projectionProMode,
    labelDisplayMode: normalizedLayout.labelDisplayMode,
    egress: normalizedLayout.egress,
    exportOptions: normalizedLayout.exportOptions,
    houseSystem: normalizedLayout.houseSystem,
    equipmentLibrary: normalizedLayout.equipmentLibrary,
    items: normalizedLayout.items,
  });
}

function resolveCurrentPermission({
  sharing = {},
  currentEmail = '',
  membership = {},
}) {
  const email = toEmail(currentEmail);
  if (!email) return 'viewer';

  if (sharing.ownerEmail && toEmail(sharing.ownerEmail) === email) return 'owner';
  if (!sharing.ownerEmail) return 'owner';

  let permission = 'viewer';
  const direct = (sharing.individuals || []).find((entry) => toEmail(entry.email) === email);
  if (direct) permission = mergePermission(permission, direct.permission || 'viewer');

  if (membership.isEventMember && sharing.eventShare?.enabled) {
    permission = mergePermission(permission, sharing.eventShare.permission || 'viewer');
  }
  if (membership.isOrganizationMember && sharing.organizationShare?.enabled) {
    permission = mergePermission(permission, sharing.organizationShare.permission || 'viewer');
  }
  if (membership.isVenueMember && sharing.venueShare?.enabled) {
    permission = mergePermission(permission, sharing.venueShare.permission || 'viewer');
  }

  const groups = Array.isArray(sharing.groups) ? sharing.groups : [];
  groups.forEach((group) => {
    if (!group?.enabled) return;
    if ((membership.groupKeys || []).includes(String(group.key || '').toLowerCase())) {
      permission = mergePermission(permission, group.permission || 'viewer');
    }
  });

  return permission;
}

export default function StagePlotEditorV2({
  layout,
  onChange,
  editable = true,
  title = 'Stage Plot Layout',
  defaultViewMode = 'physical',
  lockedViewMode = '',
  currentUser = null,
  currentMembership = null,
  eventMembers = [],
  organizationMembers = [],
  venueMembers = [],
  roleGroups = [],
}) {
  const normalized = useMemo(() => normalizeLayout(layout), [layout]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [dragState, setDragState] = useState(null);
  const [inlineEditingId, setInlineEditingId] = useState('');
  const [bulkTemplate, setBulkTemplate] = useState('');
  const [bulkPrefix, setBulkPrefix] = useState('');
  const [bulkSuffix, setBulkSuffix] = useState('');
  const [bulkStartNumber, setBulkStartNumber] = useState(1);
  const [shareOpen, setShareOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePermission, setInvitePermission] = useState('viewer');
  const [linkPermission, setLinkPermission] = useState('viewer');
  const [linkDays, setLinkDays] = useState(0);
  const [commentDraft, setCommentDraft] = useState('');
  const [publishNoteDraft, setPublishNoteDraft] = useState('');
  const [equipmentExtracting, setEquipmentExtracting] = useState(false);
  const [equipmentStatus, setEquipmentStatus] = useState('');
  const [equipmentCandidate, setEquipmentCandidate] = useState(null);

  const boardRef = useRef(null);
  const equipmentInputRef = useRef(null);

  const boardWidthPx = normalized.width * CELL;
  const boardDepthPx = normalized.depth * CELL;
  const activeViewMode = lockedViewMode || normalized.viewMode || defaultViewMode;

  const currentName = safeText(currentUser?.name || currentUser?.displayName || '', 140);
  const currentEmail = toEmail(currentUser?.email || '');
  const normalizedEventMembers = useMemo(() => normalizeMemberRows(eventMembers), [eventMembers]);
  const normalizedOrganizationMembers = useMemo(() => normalizeMemberRows(organizationMembers), [organizationMembers]);
  const normalizedVenueMembers = useMemo(() => normalizeMemberRows(venueMembers), [venueMembers]);
  const membership = useMemo(() => resolveMembership({
    currentEmail,
    currentMembership,
    eventMembers: normalizedEventMembers,
    organizationMembers: normalizedOrganizationMembers,
    venueMembers: normalizedVenueMembers,
    currentUser,
  }), [currentEmail, currentMembership, normalizedEventMembers, normalizedOrganizationMembers, normalizedVenueMembers, currentUser]);
  const currentPermission = useMemo(() => resolveCurrentPermission({
    sharing: normalized.sharing || {},
    currentEmail,
    membership,
  }), [normalized.sharing, currentEmail, membership]);
  const canEditPlot = editable && (currentPermission === 'owner' || currentPermission === 'editor');
  const canEditHouseLayer = editable && (currentPermission === 'owner' || membership.isVenueMember);
  const canCommentPlot = currentPermission === 'owner' || currentPermission === 'editor' || currentPermission === 'commenter';
  const canManageShare = editable && currentPermission === 'owner';

  const roleGroupRows = useMemo(() => {
    const fromProps = Array.isArray(roleGroups) && roleGroups.length
      ? roleGroups
      : DEFAULT_ROLE_GROUPS;
    return fromProps.map((group) => ({
      key: String(group?.key || '').trim() || slugify(group?.label || ''),
      label: String(group?.label || group?.key || '').trim() || 'Group',
    })).filter((group) => group.key && group.label);
  }, [roleGroups]);

  const allKnownMembers = useMemo(() => {
    const rows = [
      ...normalizedEventMembers,
      ...normalizedOrganizationMembers,
      ...normalizedVenueMembers,
    ];
    const map = new Map();
    rows.forEach((row) => {
      const key = row.email || row.name.toLowerCase();
      if (!key) return;
      if (!map.has(key)) map.set(key, row);
    });
    return [...map.values()];
  }, [normalizedEventMembers, normalizedOrganizationMembers, normalizedVenueMembers]);

  const touchAudit = (nextLayout, options = {}) => {
    const nextSharing = normalizeSharing(nextLayout?.sharing || {}, nextLayout);
    const nextAudit = {
      ...nextSharing.audit,
      updatedAt: new Date().toISOString(),
      updatedBy: currentName || nextSharing.audit.updatedBy || nextSharing.ownerName || 'Unknown',
      updatedByEmail: currentEmail || nextSharing.audit.updatedByEmail || nextSharing.ownerEmail || '',
    };

    if (options.publishState === 'published') {
      nextAudit.publishedAt = new Date().toISOString();
      nextAudit.publishedBy = currentName || nextSharing.ownerName || 'Unknown';
      nextAudit.publishedByEmail = currentEmail || nextSharing.ownerEmail || '';
      nextAudit.publishNote = safeText(options.publishNote || '', 500);
    }

    return {
      ...nextLayout,
      sharing: {
        ...nextSharing,
        publishState: options.publishState || nextSharing.publishState || 'draft',
        versionNotes: options.versionNotes !== undefined
          ? safeText(options.versionNotes || '', 500)
          : nextSharing.versionNotes,
        audit: nextAudit,
      },
    };
  };

  const emit = (next) => {
    if (typeof onChange === 'function') onChange(materializeLayout(next));
  };

  const updateLayout = (next, options = {}) => {
    if (!canEditPlot) return;
    emit(touchAudit(next, options));
  };

  const canMutateItem = (item = {}) => {
    if (!canEditPlot) return false;
    if (!normalized.houseLayerLocked) return true;
    if (item.layer !== 'house') return true;
    return canEditHouseLayer;
  };

  const updateItems = (itemIds = [], updater) => {
    if (!canEditPlot) return;
    if (!itemIds.length) return;
    const itemSet = new Set(itemIds);
    updateLayout({
      ...normalized,
      items: normalized.items.map((item) => (
        itemSet.has(item.id) && canMutateItem(item)
          ? updater(item)
          : item
      )),
    });
  };

  const updateItem = (itemId, patch = {}) => {
    updateItems([itemId], (item) => ({ ...item, ...patch }));
  };

  const deleteItems = (itemIds = []) => {
    if (!canEditPlot) return;
    if (!itemIds.length) return;
    const itemSet = new Set(
      itemIds.filter((id) => canMutateItem(normalized.items.find((item) => item.id === id) || {}))
    );
    if (!itemSet.size) return;
    updateLayout({
      ...normalized,
      items: normalized.items.filter((item) => !itemSet.has(item.id)),
    });
    setSelectedIds((prev) => prev.filter((id) => !itemSet.has(id)));
  };

  const addItem = (template) => {
    if (!canEditPlot) return;
    const preferredLayer = normalized.overlayMode === 'house'
      ? 'house'
      : normalized.overlayMode === 'show'
        ? 'show'
        : (template.defaultLayer === 'house' ? 'house' : 'show');
    const created = createItemFromTemplate(template, normalized, normalized.items.length);
    const next = {
      ...normalized,
      items: [...normalized.items, { ...created, layer: preferredLayer }],
    };
    updateLayout(next);
  };

  const resizeGrid = (axis, value) => {
    if (!canEditPlot) return;
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed < 8 || parsed > 120) return;
    updateLayout({
      ...normalized,
      [axis]: parsed,
      items: normalized.items.map((item) => ({
        ...item,
        x: axis === 'width' ? clamp(item.x, 0, Math.max(parsed - (item.w || 1), 0)) : item.x,
        y: axis === 'depth' ? clamp(item.y, 0, Math.max(parsed - (item.h || 1), 0)) : item.y,
      })),
    });
  };

  const paletteGroups = useMemo(() => {
    const groups = new Map();
    STAGE_PLOT_ITEM_LIBRARY.forEach((template) => {
      const key = template.category || 'physical';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(template);
    });
    return [...groups.entries()];
  }, []);

  const selectedItems = useMemo(
    () => normalized.items.filter((item) => selectedIds.includes(item.id)),
    [normalized.items, selectedIds]
  );

  const singleSelectedItem = selectedItems.length === 1 ? selectedItems[0] : null;

  const circuitSources = useMemo(
    () => normalized.items.filter((item) => isElectricalSource(item)),
    [normalized.items]
  );

  const powerLoads = useMemo(
    () => normalized.items.filter((item) => !isElectricalSource(item) && !!item.powerRequired),
    [normalized.items]
  );

  const circuitSummary = useMemo(() => {
    const loadMap = new Map();
    powerLoads.forEach((item) => {
      const circuitId = item.assignedCircuitId || '';
      if (!circuitId) return;
      if (!loadMap.has(circuitId)) loadMap.set(circuitId, []);
      loadMap.get(circuitId).push({ ...item, computedAmps: inferAmps(item) });
    });

    return circuitSources.map((source) => {
      const loads = loadMap.get(source.id) || [];
      const capacity = Number(source.sourceAmperage || source.amperage || 0) || 0;
      const assignedLoad = loads.reduce((sum, item) => sum + (Number(item.computedAmps) || 0), 0);
      const remaining = capacity - assignedLoad;
      return {
        id: source.id,
        label: source.customLabel || source.defaultLabel || source.systemType || source.type || 'Circuit',
        voltage: source.sourceVoltage || source.voltage || '120V',
        capacity,
        assignedLoad,
        remaining,
        overloaded: capacity > 0 && remaining < 0,
        loads,
      };
    });
  }, [circuitSources, powerLoads]);

  const unassignedPowerLoads = useMemo(
    () => powerLoads.filter((item) => !item.assignedCircuitId),
    [powerLoads]
  );

  const powerSummaryByDepartment = useMemo(() => {
    const totals = {
      lighting: 0,
      audio: 0,
      vendor: 0,
      operations: 0,
      comms: 0,
      other: 0,
    };

    powerLoads.forEach((item) => {
      const amps = inferAmps(item);
      const department = String(item.department || item.departmentOwner || item.category || '').toLowerCase();
      if (department.includes('light') || department.includes('lx')) totals.lighting += amps;
      else if (department.includes('audio') || department.includes('sound') || department.includes('foh')) totals.audio += amps;
      else if (department.includes('vendor') || department.includes('merch') || department.includes('booth')) totals.vendor += amps;
      else if (department.includes('comm')) totals.comms += amps;
      else if (department.includes('ops') || department.includes('stage') || department.includes('production')) totals.operations += amps;
      else totals.other += amps;
    });

    const totalCapacity = circuitSummary.reduce((sum, row) => sum + row.capacity, 0);
    const totalAssigned = circuitSummary.reduce((sum, row) => sum + row.assignedLoad, 0);

    return {
      ...totals,
      totalCapacity,
      totalAssigned,
      remainingHeadroom: totalCapacity - totalAssigned,
      overloadedCircuitCount: circuitSummary.filter((row) => row.overloaded).length,
    };
  }, [circuitSummary, powerLoads]);

  const doorSummary = useMemo(() => {
    const doors = normalized.items.filter((item) => isDoor(item));
    const emergencyDoors = doors.filter((item) => item.isEmergencyExit);
    const adaDoors = doors.filter((item) => item.isADA);
    return {
      total: doors.length,
      emergency: emergencyDoors.length,
      ada: adaDoors.length,
    };
  }, [normalized.items]);

  const visibleItems = useMemo(
    () => normalized.items.filter((item) => (
      isVisibleInMode(item, activeViewMode) && isVisibleInOverlay(item, normalized.overlayMode || 'both')
    )),
    [normalized.items, activeViewMode, normalized.overlayMode]
  );

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => normalized.items.some((item) => item.id === id)));
  }, [normalized.items]);

  useEffect(() => {
    if (!currentEmail) return;
    if (normalized.sharing.ownerEmail) return;
    if (typeof onChange !== 'function') return;
    const next = {
      ...normalized,
      sharing: {
        ...normalized.sharing,
        ownerName: currentName || normalized.sharing.ownerName || '',
        ownerEmail: currentEmail,
        groups: roleGroupRows.map((group) => {
          const existing = (normalized.sharing.groups || []).find((row) => row.key === group.key) || {};
          return {
            key: group.key,
            label: group.label,
            enabled: !!existing.enabled,
            permission: existing.permission || 'viewer',
          };
        }),
      },
    };
    onChange(materializeLayout(touchAudit(next)));
  }, [currentEmail, currentName, normalized, onChange, roleGroupRows]);

  useEffect(() => {
    if (!lockedViewMode) return;
    if (normalized.viewMode === lockedViewMode) return;
    updateLayout({
      ...normalized,
      viewMode: lockedViewMode,
    });
  }, [lockedViewMode, normalized]);

  useEffect(() => {
    if (!dragState || !canEditPlot) return undefined;

    const onMove = (event) => {
      const dx = Math.round((event.clientX - dragState.startClientX) / CELL);
      const dy = Math.round((event.clientY - dragState.startClientY) / CELL);
      if (dx === dragState.lastDx && dy === dragState.lastDy) return;

      const moveById = new Map();
      dragState.snapshot.forEach((point) => {
        const maxX = Math.max(normalized.width - (point.w || 1), 0);
        const maxY = Math.max(normalized.depth - (point.h || 1), 0);
        moveById.set(point.id, {
          x: clamp(point.x + dx, 0, maxX),
          y: clamp(point.y + dy, 0, maxY),
        });
      });

      updateLayout({
        ...normalized,
        items: normalized.items.map((item) => (
          moveById.has(item.id)
            ? { ...item, ...moveById.get(item.id) }
            : item
        )),
      });

      setDragState((prev) => prev ? { ...prev, lastDx: dx, lastDy: dy } : prev);
    };

    const onUp = () => setDragState(null);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragState, canEditPlot, normalized]);

  const handleSelect = (event, itemId) => {
    const additive = event.metaKey || event.ctrlKey || event.shiftKey;
    if (!additive) {
      setSelectedIds([itemId]);
      return;
    }
    setSelectedIds((prev) => (
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    ));
  };

  const handlePointerDown = (event, item) => {
    if (!canEditPlot) return;
    if (!canMutateItem(item)) return;
    event.preventDefault();
    event.stopPropagation();

    const additive = event.metaKey || event.ctrlKey || event.shiftKey;
    let nextSelected = selectedIds;
    if (!nextSelected.includes(item.id)) {
      nextSelected = additive ? [...nextSelected, item.id] : [item.id];
      setSelectedIds(nextSelected);
    }

    const idsToMove = (nextSelected.includes(item.id) ? nextSelected : [item.id])
      .filter((id) => canMutateItem(normalized.items.find((row) => row.id === id) || {}));
    if (!idsToMove.length) return;
    const snapshot = normalized.items
      .filter((row) => idsToMove.includes(row.id))
      .map((row) => ({ id: row.id, x: row.x, y: row.y, w: row.w || 1, h: row.h || 1 }));

    setDragState({
      ids: idsToMove,
      snapshot,
      startClientX: event.clientX,
      startClientY: event.clientY,
      lastDx: 0,
      lastDy: 0,
    });
  };

  const handleSetViewMode = (nextMode) => {
    if (lockedViewMode) return;
    updateLayout({
      ...normalized,
      viewMode: nextMode,
    });
  };

  const applyBulkTemplate = () => {
    if (!selectedItems.length || !bulkTemplate.trim()) return;
    const sorted = [...selectedItems].sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const idToLabel = new Map();

    sorted.forEach((item, idx) => {
      const number = Number(bulkStartNumber || 1) + idx;
      const custom = bulkTemplate
        .replace(/\{#\}/g, String(number))
        .replace(/\{name\}/g, item.assignedPerson || '')
        .replace(/\{role\}/g, item.role || '')
        .replace(/\{type\}/g, item.systemType || item.type || 'Item')
        .replace(/\{default\}/g, item.defaultLabel || '');
      idToLabel.set(item.id, safeText(custom, 180));
    });

    updateItems(sorted.map((row) => row.id), (item) => ({
      ...item,
      customLabel: idToLabel.get(item.id) || item.customLabel,
    }));
  };

  const applyBulkAffixes = () => {
    if (!selectedItems.length) return;
    updateItems(selectedItems.map((item) => item.id), (item) => ({
      ...item,
      customLabel: safeText(
        `${bulkPrefix || ''}${item.customLabel || item.defaultLabel || item.systemType || ''}${bulkSuffix || ''}`,
        180
      ),
    }));
  };

  const resetAllCustomLabels = () => {
    updateLayout({
      ...normalized,
      items: normalized.items.map((item) => ({ ...item, customLabel: '' })),
    });
  };

  const snapSelectedLightingToZone = () => {
    if (!singleSelectedItem || !isLightingCategory(singleSelectedItem)) return;
    const snapZone = singleSelectedItem.snapZone || '';
    if (!snapZone) return;
    const snapped = getSnapZonePosition(normalized, snapZone);
    if (!snapped) return;
    updateItem(singleSelectedItem.id, snapped);
  };

  const applyLayerToSelection = (layer = 'show') => {
    if (!selectedItems.length) return;
    updateItems(
      selectedItems.map((item) => item.id),
      (item) => ({ ...item, layer: layer === 'house' ? 'house' : 'show' })
    );
  };

  const classifyTemplateTypeForEquipment = (entry = {}) => {
    const haystack = `${entry?.systemType || ''} ${entry?.category || ''} ${entry?.model || ''}`.toLowerCase();
    if (haystack.includes('projector')) return 'video_projector_front';
    if (haystack.includes('led wall')) return 'video_led_wall';
    if (haystack.includes('switcher')) return 'video_switcher';
    if (haystack.includes('camera')) return 'video_camera_imag';
    if (haystack.includes('mic')) return 'mic_dynamic';
    if (haystack.includes('wireless')) return 'mic_wireless';
    if (haystack.includes('speaker') || haystack.includes('sub')) return 'powered_speaker';
    if (haystack.includes('dimmer')) return 'dimmer_rack';
    if (haystack.includes('moving')) return 'moving_light';
    if (haystack.includes('led')) return 'led_fixture';
    return 'set_piece';
  };

  const saveEquipmentCandidate = () => {
    if (!equipmentCandidate) return;
    const entry = {
      ...equipmentCandidate,
      id: `eq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      confirmed: true,
      createdAt: new Date().toISOString(),
    };
    updateLayout({
      ...normalized,
      equipmentLibrary: [entry, ...(normalized.equipmentLibrary || [])].slice(0, 120),
    });
    setEquipmentStatus('Equipment saved to org library for drag-and-drop use.');
  };

  const addEquipmentLibraryEntryToPlot = (entry) => {
    if (!entry) return;
    const type = classifyTemplateTypeForEquipment(entry);
    const template = STAGE_PLOT_ITEM_LIBRARY.find((item) => item.type === type) || STAGE_PLOT_ITEM_LIBRARY[0];
    if (!template) return;
    const created = createItemFromTemplate(template, normalized, normalized.items.length);
    updateLayout({
      ...normalized,
      items: [...normalized.items, {
        ...created,
        manufacturer: entry.manufacturer || '',
        model: entry.model || '',
        powerDrawWatts: entry.powerDrawWatts || created.powerDrawWatts || '',
        systemType: entry.systemType || created.systemType,
        defaultLabel: buildIndexedLabel(entry.systemType || created.systemType || 'Equipment', normalized.items.length + 1),
        category: entry.category || created.category || template.category || 'operations',
      }],
    });
  };

  const handleEquipmentUpload = async (filesLike = []) => {
    const file = Array.from(filesLike || [])[0];
    if (!file) return;
    setEquipmentExtracting(true);
    setEquipmentStatus('');
    try {
      const base64 = await fileToBase64(file);
      const extractionPrompt = `You are a production equipment recognition parser.
Return JSON only:
{
  "manufacturer": "",
  "model": "",
  "systemType": "",
  "category": "lighting|sound|video|power|operations",
  "powerDrawWatts": 0,
  "channelCount": 0,
  "dmxModes": "",
  "confidence": 0
}
If unknown, leave blanks or 0.`;
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'extract-upload',
          fileData: base64,
          mimeType: file.type || 'image/jpeg',
          extractionPrompt,
        }),
      });
      const data = await response.json();
      if (!data?.success) throw new Error(data?.error || 'Equipment recognition failed.');
      const extracted = data.extracted || {};
      const candidate = {
        manufacturer: safeText(extracted.manufacturer || '', 120),
        model: safeText(extracted.model || '', 160),
        systemType: safeText(extracted.systemType || extracted.fixtureType || 'Equipment', 200),
        category: safeText(extracted.category || 'operations', 80).toLowerCase(),
        powerDrawWatts: toNumberOrBlank(extracted.powerDrawWatts ?? extracted.power_draw_watts ?? ''),
        channelCount: toNumberOrBlank(extracted.channelCount ?? extracted.channel_count ?? ''),
        dmxModes: safeText(extracted.dmxModes || extracted.dmx_modes || '', 500),
        confidence: toNumberOrBlank(extracted.confidence ?? ''),
        notes: '',
      };
      setEquipmentCandidate(candidate);
      setEquipmentStatus(`Recognition ready (${candidate.confidence || 0}% confidence). Review and confirm before save.`);
    } catch (err) {
      setEquipmentStatus(`I hit a snag reading that equipment photo: ${err.message}`);
    } finally {
      setEquipmentExtracting(false);
    }
  };

  const selectedItemCircuitMeta = singleSelectedItem
    ? (() => {
      const source = circuitSummary.find((row) => row.id === singleSelectedItem.assignedCircuitId);
      if (!source) return null;
      return {
        ...source,
        loadForItem: inferAmps(singleSelectedItem),
      };
    })()
    : null;

  const createSharePatch = (patch = {}, options = {}) => {
    const nextSharing = normalizeSharing(
      {
        ...(normalized.sharing || {}),
        ...patch,
      },
      normalized
    );

    let audit = {
      ...nextSharing.audit,
      updatedAt: new Date().toISOString(),
      updatedBy: currentName || nextSharing.audit.updatedBy || nextSharing.ownerName || 'Unknown',
      updatedByEmail: currentEmail || nextSharing.audit.updatedByEmail || nextSharing.ownerEmail || '',
    };

    if (options.publishState === 'published') {
      audit = {
        ...audit,
        publishedAt: new Date().toISOString(),
        publishedBy: currentName || nextSharing.ownerName || 'Unknown',
        publishedByEmail: currentEmail || nextSharing.ownerEmail || '',
        publishNote: safeText(options.publishNote || '', 500),
      };
    }

    let versionHistory = Array.isArray(nextSharing.versionHistory) ? [...nextSharing.versionHistory] : [];
    if (options.recordVersion) {
      const snapshot = buildLayoutSnapshot(normalized);
      const nextEntry = {
        id: `version_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        state: options.publishState === 'published' ? 'published' : 'draft',
        note: safeText(options.versionNotes || options.publishNote || nextSharing.versionNotes || '', 500),
        authorName: currentName || nextSharing.ownerName || 'Owner',
        authorEmail: currentEmail || nextSharing.ownerEmail || '',
        width: safeNumber(snapshot.width, normalized.width),
        depth: safeNumber(snapshot.depth, normalized.depth),
        itemCount: Array.isArray(snapshot.items) ? snapshot.items.length : 0,
        snapshot,
      };
      versionHistory = [nextEntry, ...versionHistory].slice(0, MAX_VERSION_HISTORY_ENTRIES);
    }

    return {
      ...normalized,
      sharing: {
        ...nextSharing,
        publishState: options.publishState || nextSharing.publishState,
        versionNotes: options.versionNotes !== undefined
          ? safeText(options.versionNotes || '', 500)
          : nextSharing.versionNotes,
        versionHistory,
        audit,
      },
    };
  };

  const patchSharing = (patch = {}, options = {}) => {
    if (!canManageShare) return;
    const next = createSharePatch(patch, options);
    emit(next);
  };

  const addIndividualShare = (emailText = '', permission = 'viewer', name = '') => {
    if (!canManageShare) return;
    const email = toEmail(emailText);
    if (!email) return;
    const individuals = [...(normalized.sharing.individuals || [])];
    const existingIdx = individuals.findIndex((row) => toEmail(row.email) === email);
    const nextEntry = {
      email,
      name: safeText(name || (allKnownMembers.find((row) => toEmail(row.email) === email)?.name || ''), 140),
      permission: ['owner', 'editor', 'commenter', 'viewer'].includes(permission) ? permission : 'viewer',
    };
    if (existingIdx >= 0) individuals.splice(existingIdx, 1, nextEntry);
    else individuals.push(nextEntry);
    patchSharing({ individuals });
  };

  const removeIndividualShare = (emailText = '') => {
    if (!canManageShare) return;
    const email = toEmail(emailText);
    patchSharing({
      individuals: (normalized.sharing.individuals || []).filter((row) => toEmail(row.email) !== email),
    });
  };

  const upsertShareLink = () => {
    if (!canManageShare) return;
    const now = new Date();
    const expiresAt = Number(linkDays) > 0
      ? new Date(now.getTime() + (Number(linkDays) * 86400000)).toISOString()
      : '';
    const nextLink = {
      id: `link_${Math.random().toString(36).slice(2, 8)}`,
      token: randomShareToken(),
      permission: ['commenter', 'viewer'].includes(linkPermission) ? linkPermission : 'viewer',
      expiresAt,
      createdAt: now.toISOString(),
      createdBy: currentName || currentEmail || 'Owner',
    };
    patchSharing({ links: [nextLink, ...(normalized.sharing.links || [])] });
  };

  const removeShareLink = (linkId = '') => {
    if (!canManageShare) return;
    patchSharing({
      links: (normalized.sharing.links || []).filter((row) => row.id !== linkId),
    });
  };

  const addComment = () => {
    if (!canCommentPlot) return;
    const text = safeText(commentDraft, 2000).trim();
    if (!text) return;
    const comment = {
      id: `comment_${Math.random().toString(36).slice(2, 8)}`,
      text,
      authorName: currentName || currentEmail || 'Collaborator',
      authorEmail: currentEmail || '',
      createdAt: new Date().toISOString(),
    };
    const next = {
      ...normalized,
      sharing: {
        ...normalized.sharing,
        comments: [...(normalized.sharing.comments || []), comment],
      },
    };
    if (canEditPlot) {
      updateLayout(next);
    } else if (typeof onChange === 'function') {
      onChange(materializeLayout(touchAudit(next)));
    }
    setCommentDraft('');
  };

  const markPublished = (nextState = 'published') => {
    if (!canManageShare) return;
    const publishState = nextState === 'published' ? 'published' : 'draft';
    patchSharing(
      {
        publishState,
      },
      {
        publishState,
        publishNote: publishState === 'published' ? publishNoteDraft : '',
        versionNotes: publishNoteDraft,
        recordVersion: true,
      }
    );
  };

  const restoreVersionToDraft = (versionId = '') => {
    if (!canEditPlot) return;
    const history = normalized.sharing.versionHistory || [];
    const version = history.find((entry) => entry.id === versionId);
    if (!version?.snapshot || typeof version.snapshot !== 'object') return;

    const restoredLayout = normalizeLayout({
      ...normalized,
      ...deepClone(version.snapshot),
    });

    updateLayout(
      {
        ...restoredLayout,
        sharing: {
          ...normalized.sharing,
          publishState: 'draft',
          versionNotes: safeText(version.note || normalized.sharing.versionNotes || '', 500),
          versionHistory: history,
        },
      },
      {
        publishState: 'draft',
        versionNotes: safeText(version.note || normalized.sharing.versionNotes || '', 500),
      }
    );

    setPublishNoteDraft(safeText(version.note || '', 500));
    setSelectedIds([]);
  };

  const shareStatusText = normalized.sharing.publishState === 'published'
    ? `Published${normalized.sharing.audit?.publishedAt ? ` · ${new Date(normalized.sharing.audit.publishedAt).toLocaleString()}` : ''}`
    : 'Draft';

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h3 className="text-base m-0">{title}</h3>
          <p className="text-xs text-gray-500 m-0 mt-1">
            Universal production plotting with House vs Show overlays, LX/Sound/Projection pro metadata, power, and safety layers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            W
            <input
              type="number"
              value={normalized.width}
              min={8}
              max={120}
              onChange={(e) => resizeGrid('width', e.target.value)}
              className="w-16 px-2 py-1 border border-gray-300 rounded"
              disabled={!canEditPlot}
            />
          </label>
          <label className="flex items-center gap-1">
            D
            <input
              type="number"
              value={normalized.depth}
              min={8}
              max={120}
              onChange={(e) => resizeGrid('depth', e.target.value)}
              className="w-16 px-2 py-1 border border-gray-300 rounded"
              disabled={!canEditPlot}
            />
          </label>
          <select
            value={activeViewMode}
            onChange={(e) => handleSetViewMode(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded bg-white"
            disabled={!canEditPlot || !!lockedViewMode}
          >
            {VIEW_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>{mode.label}</option>
            ))}
          </select>
          <select
            value={normalized.labelDisplayMode || 'item'}
            onChange={(e) => updateLayout({ ...normalized, labelDisplayMode: e.target.value })}
            className="px-2 py-1 border border-gray-300 rounded bg-white"
            disabled={!canEditPlot}
          >
            {LABEL_DISPLAY_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>{mode.label}</option>
            ))}
          </select>
          <select
            value={normalized.overlayMode || 'both'}
            onChange={(e) => updateLayout({ ...normalized, overlayMode: normalizeOverlayMode(e.target.value) })}
            className="px-2 py-1 border border-gray-300 rounded bg-white"
            disabled={!canEditPlot}
          >
            {OVERLAY_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>{mode.label}</option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1 px-2 py-1 border border-gray-300 rounded bg-white">
            <input
              type="checkbox"
              checked={!!normalized.houseLayerLocked}
              onChange={(e) => updateLayout({ ...normalized, houseLayerLocked: e.target.checked })}
              disabled={!canManageShare}
            />
            House Lock
          </label>
          <label className="inline-flex items-center gap-1 px-2 py-1 border border-gray-300 rounded bg-white">
            <input
              type="checkbox"
              checked={!!normalized.lightingProMode}
              onChange={(e) => updateLayout({ ...normalized, lightingProMode: e.target.checked })}
              disabled={!canEditPlot}
            />
            LX Pro
          </label>
          <label className="inline-flex items-center gap-1 px-2 py-1 border border-gray-300 rounded bg-white">
            <input
              type="checkbox"
              checked={!!normalized.soundProMode}
              onChange={(e) => updateLayout({ ...normalized, soundProMode: e.target.checked })}
              disabled={!canEditPlot}
            />
            SND Pro
          </label>
          <label className="inline-flex items-center gap-1 px-2 py-1 border border-gray-300 rounded bg-white">
            <input
              type="checkbox"
              checked={!!normalized.projectionProMode}
              onChange={(e) => updateLayout({ ...normalized, projectionProMode: e.target.checked })}
              disabled={!canEditPlot}
            />
            PROJ Pro
          </label>
          <button
            type="button"
            className="px-2 py-1 border border-gray-300 rounded bg-white text-xs"
            onClick={() => setShareOpen((prev) => !prev)}
          >
            Share
          </button>
          <span className="text-[11px] px-2 py-1 rounded bg-gray-100 border border-gray-200">
            {shareStatusText}
          </span>
          <span className="text-[11px] px-2 py-1 rounded bg-gray-100 border border-gray-200">
            You: {currentPermission}
          </span>
          {normalized.houseLayerLocked && !canEditHouseLayer ? (
            <span className="text-[11px] px-2 py-1 rounded bg-amber-100 text-amber-800 border border-amber-200">
              House layer locked to venue owner/admin
            </span>
          ) : null}
        </div>
      </div>

      {shareOpen && (
        <div className="mb-3 border border-gray-200 rounded-lg p-3 bg-white space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-semibold m-0">Plot Sharing & Collaboration</p>
            <div className="flex items-center gap-2">
              <select
                value={normalized.sharing.visibility || 'private'}
                onChange={(e) => patchSharing({ visibility: e.target.value })}
                className="px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                disabled={!canManageShare}
              >
                {SHARE_VISIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select
                value={normalized.sharing.publishState || 'draft'}
                onChange={(e) => markPublished(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                disabled={!canManageShare}
              >
                {PUBLISH_STATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <label className="text-xs flex items-center gap-2 border border-gray-200 rounded px-2 py-1.5">
              <input
                type="checkbox"
                checked={!!normalized.sharing.eventShare?.enabled}
                onChange={(e) => patchSharing({ eventShare: { ...normalized.sharing.eventShare, enabled: e.target.checked } })}
                disabled={!canManageShare}
              />
              Share with Event members
            </label>
            <select
              value={normalized.sharing.eventShare?.permission || 'viewer'}
              onChange={(e) => patchSharing({ eventShare: { ...normalized.sharing.eventShare, permission: e.target.value } })}
              className="px-2 py-1 border border-gray-300 rounded text-xs bg-white"
              disabled={!canManageShare}
            >
              {SHARE_PERMISSION_OPTIONS.filter((option) => option.value !== 'owner').map((option) => (
                <option key={`event-${option.value}`} value={option.value}>{option.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 m-0 self-center">{normalizedEventMembers.length} event member(s) detected</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <label className="text-xs flex items-center gap-2 border border-gray-200 rounded px-2 py-1.5">
              <input
                type="checkbox"
                checked={!!normalized.sharing.organizationShare?.enabled}
                onChange={(e) => patchSharing({ organizationShare: { ...normalized.sharing.organizationShare, enabled: e.target.checked } })}
                disabled={!canManageShare}
              />
              Share with Organization members
            </label>
            <select
              value={normalized.sharing.organizationShare?.permission || 'viewer'}
              onChange={(e) => patchSharing({ organizationShare: { ...normalized.sharing.organizationShare, permission: e.target.value } })}
              className="px-2 py-1 border border-gray-300 rounded text-xs bg-white"
              disabled={!canManageShare}
            >
              {SHARE_PERMISSION_OPTIONS.filter((option) => option.value !== 'owner').map((option) => (
                <option key={`org-${option.value}`} value={option.value}>{option.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 m-0 self-center">{normalizedOrganizationMembers.length} org member(s) detected</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <label className="text-xs flex items-center gap-2 border border-gray-200 rounded px-2 py-1.5">
              <input
                type="checkbox"
                checked={!!normalized.sharing.venueShare?.enabled}
                onChange={(e) => patchSharing({ venueShare: { ...normalized.sharing.venueShare, enabled: e.target.checked } })}
                disabled={!canManageShare}
              />
              Share with Venue members
            </label>
            <select
              value={normalized.sharing.venueShare?.permission || 'viewer'}
              onChange={(e) => patchSharing({ venueShare: { ...normalized.sharing.venueShare, permission: e.target.value } })}
              className="px-2 py-1 border border-gray-300 rounded text-xs bg-white"
              disabled={!canManageShare}
            >
              {SHARE_PERMISSION_OPTIONS.filter((option) => option.value !== 'owner').map((option) => (
                <option key={`venue-${option.value}`} value={option.value}>{option.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 m-0 self-center">{normalizedVenueMembers.length} venue member(s) detected</p>
          </div>

          <div className="border border-gray-200 rounded p-2 bg-gray-50 space-y-2">
            <p className="text-xs font-semibold m-0">Department / Role Groups</p>
            <div className="space-y-1">
              {(normalized.sharing.groups || roleGroupRows).map((group) => (
                <div key={group.key} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                  <label className="text-xs flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!group.enabled}
                      onChange={(e) => {
                        const nextGroups = (normalized.sharing.groups || []).map((row) => (
                          row.key === group.key ? { ...row, enabled: e.target.checked } : row
                        ));
                        patchSharing({ groups: nextGroups });
                      }}
                      disabled={!canManageShare}
                    />
                    {group.label}
                  </label>
                  <select
                    value={group.permission || 'viewer'}
                    onChange={(e) => {
                      const nextGroups = (normalized.sharing.groups || []).map((row) => (
                        row.key === group.key ? { ...row, permission: e.target.value } : row
                      ));
                      patchSharing({ groups: nextGroups });
                    }}
                    className="px-2 py-1 border border-gray-300 rounded text-xs bg-white md:col-span-2"
                    disabled={!canManageShare}
                  >
                    {SHARE_PERMISSION_OPTIONS.filter((option) => option.value !== 'owner').map((option) => (
                      <option key={`group-${group.key}-${option.value}`} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-gray-200 rounded p-2 bg-gray-50 space-y-2">
            <p className="text-xs font-semibold m-0">Invite Individuals</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-xs md:col-span-2"
                placeholder="name@email.com"
                disabled={!canManageShare}
              />
              <select
                value={invitePermission}
                onChange={(e) => setInvitePermission(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                disabled={!canManageShare}
              >
                {SHARE_PERMISSION_OPTIONS.map((option) => (
                  <option key={`invite-${option.value}`} value={option.value}>{option.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => {
                  addIndividualShare(inviteEmail, invitePermission);
                  setInviteEmail('');
                }}
                disabled={!canManageShare}
              >
                Invite
              </button>
            </div>
            {allKnownMembers.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {allKnownMembers.slice(0, 16).map((member) => (
                  <button
                    key={`${member.email}-${member.name}`}
                    type="button"
                    className="text-[11px] px-2 py-1 border border-gray-300 rounded bg-white"
                    onClick={() => addIndividualShare(member.email, 'viewer', member.name)}
                    disabled={!canManageShare || !member.email}
                  >
                    + {member.name || member.email}
                  </button>
                ))}
              </div>
            )}
            {(normalized.sharing.individuals || []).length > 0 && (
              <div className="space-y-1">
                {(normalized.sharing.individuals || []).map((person) => (
                  <div key={person.email} className="flex items-center justify-between gap-2 text-xs border border-gray-200 rounded px-2 py-1 bg-white">
                    <div className="truncate">
                      {person.name || person.email} · {person.email}
                    </div>
                    <div className="flex items-center gap-1">
                      <select
                        value={person.permission || 'viewer'}
                        onChange={(e) => addIndividualShare(person.email, e.target.value, person.name)}
                        className="px-1 py-0.5 border border-gray-300 rounded text-xs bg-white"
                        disabled={!canManageShare}
                      >
                        {SHARE_PERMISSION_OPTIONS.map((option) => (
                          <option key={`${person.email}-${option.value}`} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="text-red-600 border border-red-200 rounded px-1 py-0.5 bg-white"
                        onClick={() => removeIndividualShare(person.email)}
                        disabled={!canManageShare}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border border-gray-200 rounded p-2 bg-gray-50 space-y-2">
            <p className="text-xs font-semibold m-0">Shareable Links</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <select
                value={linkPermission}
                onChange={(e) => setLinkPermission(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                disabled={!canManageShare}
              >
                <option value="viewer">Viewer link</option>
                <option value="commenter">Commenter link</option>
              </select>
              <input
                type="number"
                min="0"
                value={linkDays}
                onChange={(e) => setLinkDays(Math.max(0, Number(e.target.value) || 0))}
                className="px-2 py-1 border border-gray-300 rounded text-xs"
                placeholder="Expires in days (0 = no expiry)"
                disabled={!canManageShare}
              />
              <button type="button" className="btn-secondary text-xs md:col-span-2" onClick={upsertShareLink} disabled={!canManageShare}>
                Create share link
              </button>
            </div>
            {(normalized.sharing.links || []).map((link) => (
              <div key={link.id} className="flex items-center justify-between gap-2 text-xs border border-gray-200 rounded px-2 py-1 bg-white">
                <div className="truncate">
                  {link.permission} · token: {link.token}{link.expiresAt ? ` · expires ${new Date(link.expiresAt).toLocaleDateString()}` : ' · no expiry'}
                </div>
                <button type="button" className="text-red-600 border border-red-200 rounded px-1 py-0.5 bg-white" onClick={() => removeShareLink(link.id)} disabled={!canManageShare}>
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="border border-gray-200 rounded p-2 bg-gray-50 space-y-2">
            <p className="text-xs font-semibold m-0">Publish + Version Note</p>
            <textarea
              value={publishNoteDraft || normalized.sharing.versionNotes || ''}
              onChange={(e) => setPublishNoteDraft(e.target.value)}
              rows={2}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              placeholder="Version note"
              disabled={!canManageShare}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-xs" onClick={() => markPublished('published')} disabled={!canManageShare}>
                {normalized.sharing.publishState === 'published' ? 'Publish New Version' : 'Publish now'}
              </button>
              <button type="button" className="btn-secondary text-xs" onClick={() => markPublished('draft')} disabled={!canManageShare}>
                Edit (Back to Draft)
              </button>
            </div>
            <p className="text-[11px] text-gray-500 m-0">
              You can switch to Draft anytime, keep editing, and republish as many versions as you need.
            </p>
            <p className="text-[11px] text-gray-500 m-0">
              Updated: {normalized.sharing.audit?.updatedBy || 'Unknown'}{normalized.sharing.audit?.updatedAt ? ` · ${new Date(normalized.sharing.audit.updatedAt).toLocaleString()}` : ''}
            </p>
            <p className="text-[11px] text-gray-500 m-0">
              Published: {normalized.sharing.audit?.publishedBy || 'Not published'}{normalized.sharing.audit?.publishedAt ? ` · ${new Date(normalized.sharing.audit.publishedAt).toLocaleString()}` : ''}
            </p>
          </div>

          <div className="border border-gray-200 rounded p-2 bg-gray-50 space-y-2">
            <p className="text-xs font-semibold m-0">Version History</p>
            {(normalized.sharing.versionHistory || []).length === 0 ? (
              <p className="text-[11px] text-gray-500 m-0">No versions yet. Publish or move back to draft to create snapshots.</p>
            ) : (
              <div className="space-y-1 max-h-44 overflow-auto">
                {(normalized.sharing.versionHistory || []).map((entry) => (
                  <div key={entry.id} className="border border-gray-200 rounded px-2 py-1 bg-white text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[11px] px-1.5 py-0.5 rounded ${entry.state === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {entry.state === 'published' ? 'Published' : 'Draft'}
                      </span>
                      <span className="text-gray-500">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}</span>
                    </div>
                    <p className="m-0 mt-1 text-[11px] text-gray-600">
                      {entry.authorName || entry.authorEmail || 'Owner'} · {entry.width}W × {entry.depth}D · {entry.itemCount || 0} items
                    </p>
                    {entry.note ? <p className="m-0 mt-1 text-[11px] text-gray-700">{entry.note}</p> : null}
                    <div className="mt-1">
                      <button
                        type="button"
                        className="btn-secondary text-[11px]"
                        onClick={() => restoreVersionToDraft(entry.id)}
                        disabled={!canEditPlot}
                      >
                        Restore to Draft
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border border-gray-200 rounded p-2 bg-gray-50 space-y-2">
            <p className="text-xs font-semibold m-0">Comments</p>
            {(normalized.sharing.comments || []).length === 0 ? (
              <p className="text-[11px] text-gray-500 m-0">No comments yet.</p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-auto">
                {(normalized.sharing.comments || []).slice().reverse().map((comment) => (
                  <div key={comment.id} className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
                    <p className="m-0">{comment.text}</p>
                    <p className="m-0 text-[11px] text-gray-500">
                      {comment.authorName || comment.authorEmail || 'Collaborator'} · {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
              <input
                type="text"
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-xs"
                placeholder="Add a comment or markup note"
                disabled={!canCommentPlot}
              />
              <button type="button" className="btn-secondary text-xs" onClick={addComment} disabled={!canCommentPlot}>
                Add comment
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-4">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Object Library</p>
            <div className="max-h-72 overflow-auto border border-gray-200 rounded-lg divide-y divide-gray-100 bg-white">
              {paletteGroups.map(([categoryKey, templates]) => (
                <div key={categoryKey}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 m-0 px-3 py-1 bg-gray-50 border-b border-gray-100">
                    {CATEGORY_LABELS[categoryKey] || categoryKey}
                  </p>
                  <div className="divide-y divide-gray-100">
                    {templates.map((template) => (
                      <button
                        key={template.type}
                        type="button"
                        onClick={() => addItem(template)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-[#faf8f3] border-none bg-transparent cursor-pointer"
                        disabled={!canEditPlot}
                      >
                        + {template.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
            <p className="text-xs font-semibold m-0">Room + Structural Inputs</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min="0"
                step="0.1"
                value={normalized.ceilingHeightFeet}
                onChange={(e) => updateLayout({ ...normalized, ceilingHeightFeet: toNumberOrBlank(e.target.value) })}
                className="px-2 py-1 border border-gray-300 rounded text-xs"
                placeholder="Ceiling (ft)"
                disabled={!canEditPlot}
              />
              <input
                type="number"
                min="0"
                step="0.1"
                value={normalized.gridHeightFeet}
                onChange={(e) => updateLayout({ ...normalized, gridHeightFeet: toNumberOrBlank(e.target.value) })}
                className="px-2 py-1 border border-gray-300 rounded text-xs"
                placeholder="Grid (ft)"
                disabled={!canEditPlot}
              />
              <input
                type="number"
                min="0"
                step="0.1"
                value={normalized.stageTrimHeightFeet}
                onChange={(e) => updateLayout({ ...normalized, stageTrimHeightFeet: toNumberOrBlank(e.target.value) })}
                className="px-2 py-1 border border-gray-300 rounded text-xs"
                placeholder="Trim (ft)"
                disabled={!canEditPlot}
              />
              <input
                type="number"
                min="0"
                step="1"
                value={normalized.maxOccupancy}
                onChange={(e) => updateLayout({ ...normalized, maxOccupancy: toNumberOrBlank(e.target.value) })}
                className="px-2 py-1 border border-gray-300 rounded text-xs"
                placeholder="Max occupancy"
                disabled={!canEditPlot}
              />
            </div>
            <textarea
              value={normalized.structuralColumns}
              onChange={(e) => updateLayout({ ...normalized, structuralColumns: e.target.value })}
              rows={2}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              placeholder="Columns"
              disabled={!canEditPlot}
            />
            <textarea
              value={normalized.walls}
              onChange={(e) => updateLayout({ ...normalized, walls: e.target.value })}
              rows={2}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              placeholder="Walls"
              disabled={!canEditPlot}
            />
            <textarea
              value={normalized.windows}
              onChange={(e) => updateLayout({ ...normalized, windows: e.target.value })}
              rows={2}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              placeholder="Windows"
              disabled={!canEditPlot}
            />
            <textarea
              value={normalized.fixedBars}
              onChange={(e) => updateLayout({ ...normalized, fixedBars: e.target.value })}
              rows={2}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              placeholder="Fixed bars"
              disabled={!canEditPlot}
            />
            <textarea
              value={normalized.fixedFeatures}
              onChange={(e) => updateLayout({ ...normalized, fixedFeatures: e.target.value })}
              rows={2}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              placeholder="Other fixed architectural features"
              disabled={!canEditPlot}
            />
            <select
              value={normalized.terminologyMode || 'theater'}
              onChange={(e) => updateLayout({ ...normalized, terminologyMode: e.target.value })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
              disabled={!canEditPlot}
            >
              <option value="theater">Theatre terminology</option>
              <option value="gallery">Gallery terminology</option>
              <option value="workshop">Workshop terminology</option>
              <option value="vendor">Vendor marketplace terminology</option>
              <option value="touring">Touring terminology</option>
            </select>
            <p className="text-[11px] text-gray-500 m-0">
              {(TERMINOLOGY_HINTS[normalized.terminologyMode] || TERMINOLOGY_HINTS.theater).join(' · ')}
            </p>
          </div>

          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
            <p className="text-xs font-semibold m-0">House vs Show Overlay</p>
            <p className="text-[11px] text-gray-500 m-0">
              House layer stores venue infrastructure. Show layer stores event-specific overlay objects.
            </p>
            <div className="grid grid-cols-1 gap-2">
              <select
                value={normalized.overlayMode || 'both'}
                onChange={(e) => updateLayout({ ...normalized, overlayMode: normalizeOverlayMode(e.target.value) })}
                className="px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                disabled={!canEditPlot}
              >
                {OVERLAY_MODES.map((mode) => (
                  <option key={`overlay-${mode.value}`} value={mode.value}>{mode.label}</option>
                ))}
              </select>
              <label className="text-xs flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!normalized.houseLayerLocked}
                  onChange={(e) => updateLayout({ ...normalized, houseLayerLocked: e.target.checked })}
                  disabled={!canManageShare}
                />
                Lock House layer edits to venue owners/admins
              </label>
              {selectedItems.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary text-xs" onClick={() => applyLayerToSelection('house')} disabled={!canEditPlot}>
                    Move Selection to House
                  </button>
                  <button type="button" className="btn-secondary text-xs" onClick={() => applyLayerToSelection('show')} disabled={!canEditPlot}>
                    Move Selection to Show
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
            <p className="text-xs font-semibold m-0">House Control Mapping</p>
            <input
              type="text"
              value={normalized.houseSystem?.houseLightControlLocation || ''}
              onChange={(e) => updateLayout({
                ...normalized,
                houseSystem: { ...(normalized.houseSystem || {}), houseLightControlLocation: e.target.value },
              })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              placeholder="House light control location"
              disabled={!canEditPlot}
            />
            <input
              type="text"
              value={normalized.houseSystem?.houseLightController || ''}
              onChange={(e) => updateLayout({
                ...normalized,
                houseSystem: { ...(normalized.houseSystem || {}), houseLightController: e.target.value },
              })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              placeholder="Who controls house lights (venue or production)"
              disabled={!canEditPlot}
            />
            <input
              type="text"
              value={normalized.houseSystem?.monitorWorldLocation || ''}
              onChange={(e) => updateLayout({
                ...normalized,
                houseSystem: { ...(normalized.houseSystem || {}), monitorWorldLocation: e.target.value },
              })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              placeholder="Monitor world location"
              disabled={!canEditPlot}
            />
            <input
              type="text"
              value={normalized.houseSystem?.houseConsoleLocation || ''}
              onChange={(e) => updateLayout({
                ...normalized,
                houseSystem: { ...(normalized.houseSystem || {}), houseConsoleLocation: e.target.value },
              })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              placeholder="House console location(s)"
              disabled={!canEditPlot}
            />
            <textarea
              value={normalized.houseSystem?.housePatchInfrastructure || ''}
              onChange={(e) => updateLayout({
                ...normalized,
                houseSystem: { ...(normalized.houseSystem || {}), housePatchInfrastructure: e.target.value },
              })}
              rows={2}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              placeholder="House patch points, stage boxes, DMX/network infrastructure"
              disabled={!canEditPlot}
            />
            <textarea
              value={normalized.houseSystem?.emergencyLightingCircuits || ''}
              onChange={(e) => updateLayout({
                ...normalized,
                houseSystem: { ...(normalized.houseSystem || {}), emergencyLightingCircuits: e.target.value },
              })}
              rows={2}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              placeholder="Emergency lighting circuits"
              disabled={!canEditPlot}
            />
            <textarea
              value={normalized.houseSystem?.houseLooks || ''}
              onChange={(e) => updateLayout({
                ...normalized,
                houseSystem: { ...(normalized.houseSystem || {}), houseLooks: e.target.value },
              })}
              rows={2}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              placeholder="House looks / relay presets"
              disabled={!canEditPlot}
            />
          </div>

          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
            <p className="text-xs font-semibold m-0">Safety / Egress Overlay</p>
            <label className="text-xs flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!normalized.egress.showPaths}
                onChange={(e) => updateLayout({
                  ...normalized,
                  egress: { ...normalized.egress, showPaths: e.target.checked },
                })}
                disabled={!canEditPlot}
              />
              Show egress paths
            </label>
            <label className="text-xs flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!normalized.egress.showFireLanes}
                onChange={(e) => updateLayout({
                  ...normalized,
                  egress: { ...normalized.egress, showFireLanes: e.target.checked },
                })}
                disabled={!canEditPlot}
              />
              Show fire lanes
            </label>
            <label className="text-xs flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!normalized.egress.highlightEmergencyExits}
                onChange={(e) => updateLayout({
                  ...normalized,
                  egress: { ...normalized.egress, highlightEmergencyExits: e.target.checked },
                })}
                disabled={!canEditPlot}
              />
              Highlight emergency exits
            </label>
            <label className="text-xs flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!normalized.egress.showCrowdFlowArrows}
                onChange={(e) => updateLayout({
                  ...normalized,
                  egress: { ...normalized.egress, showCrowdFlowArrows: e.target.checked },
                })}
                disabled={!canEditPlot}
              />
              Show crowd flow arrows
            </label>
            <textarea
              value={normalized.egress.notes || ''}
              onChange={(e) => updateLayout({
                ...normalized,
                egress: { ...normalized.egress, notes: e.target.value },
              })}
              rows={2}
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              placeholder="Egress notes / fire lane restrictions"
              disabled={!canEditPlot}
            />
            <p className="text-[11px] text-gray-500 m-0">
              Doors: {doorSummary.total} · Emergency exits: {doorSummary.emergency} · ADA doors: {doorSummary.ada}
            </p>
          </div>

          {selectedItems.length > 1 && (
            <div className="border border-gray-200 rounded-lg p-3 bg-white space-y-2">
              <p className="text-xs font-semibold m-0">Bulk Labels ({selectedItems.length})</p>
              <input
                type="text"
                value={bulkTemplate}
                onChange={(e) => setBulkTemplate(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                placeholder="Template e.g. Actor Mic — {#}"
                disabled={!canEditPlot}
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={bulkPrefix}
                  onChange={(e) => setBulkPrefix(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-xs"
                  placeholder="Prefix"
                  disabled={!canEditPlot}
                />
                <input
                  type="text"
                  value={bulkSuffix}
                  onChange={(e) => setBulkSuffix(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-xs"
                  placeholder="Suffix"
                  disabled={!canEditPlot}
                />
                <input
                  type="number"
                  min="1"
                  value={bulkStartNumber}
                  onChange={(e) => setBulkStartNumber(Math.max(1, Number(e.target.value) || 1))}
                  className="px-2 py-1 border border-gray-300 rounded text-xs"
                  placeholder="Start #"
                  disabled={!canEditPlot}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary text-xs" onClick={applyBulkTemplate} disabled={!canEditPlot}>
                  Apply template
                </button>
                <button type="button" className="btn-secondary text-xs" onClick={applyBulkAffixes} disabled={!canEditPlot}>
                  Apply prefix/suffix
                </button>
                <button type="button" className="btn-secondary text-xs" onClick={() => deleteItems(selectedItems.map((item) => item.id))} disabled={!canEditPlot}>
                  Delete selected
                </button>
              </div>
              <p className="text-[11px] text-gray-500 m-0">Tokens: {'{#}'}, {'{name}'}, {'{role}'}, {'{type}'}, {'{default}'}</p>
            </div>
          )}

          {singleSelectedItem && (
            <div className="border border-gray-200 rounded-lg p-3 bg-white space-y-2">
              <p className="text-xs font-semibold m-0">Selected Object</p>
              <div>
                <label className="text-xs text-gray-600 block mb-1">Object Type (system)</label>
                <input
                  type="text"
                  value={singleSelectedItem.systemType || ''}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-gray-100"
                  disabled
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">Default Label</label>
                <input
                  type="text"
                  value={singleSelectedItem.defaultLabel || ''}
                  onChange={(e) => updateItem(singleSelectedItem.id, { defaultLabel: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                  disabled={!canEditPlot}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">Custom Label</label>
                <input
                  type="text"
                  value={singleSelectedItem.customLabel || ''}
                  onChange={(e) => updateItem(singleSelectedItem.id, { customLabel: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                  disabled={!canEditPlot}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">Custom Label Visibility</label>
                <select
                  value={singleSelectedItem.customLabelVisibility || 'both'}
                  onChange={(e) => updateItem(singleSelectedItem.id, { customLabelVisibility: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                  disabled={!canEditPlot}
                >
                  {CUSTOM_LABEL_VISIBILITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">Layer</label>
                <select
                  value={singleSelectedItem.layer || 'show'}
                  onChange={(e) => updateItem(singleSelectedItem.id, { layer: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                  disabled={!canMutateItem(singleSelectedItem)}
                >
                  {ITEM_LAYER_OPTIONS.map((option) => (
                    <option key={`layer-${option.value}`} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={singleSelectedItem.assignedPerson || ''}
                  onChange={(e) => updateItem(singleSelectedItem.id, { assignedPerson: e.target.value })}
                  className="px-2 py-1 border border-gray-300 rounded text-xs"
                  placeholder="Assigned person"
                  disabled={!canEditPlot}
                />
                <input
                  type="text"
                  value={singleSelectedItem.role || ''}
                  onChange={(e) => updateItem(singleSelectedItem.id, { role: e.target.value })}
                  className="px-2 py-1 border border-gray-300 rounded text-xs"
                  placeholder="Role"
                  disabled={!canEditPlot}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={singleSelectedItem.department || ''}
                  onChange={(e) => updateItem(singleSelectedItem.id, { department: e.target.value })}
                  className="px-2 py-1 border border-gray-300 rounded text-xs"
                  placeholder="Department"
                  disabled={!canEditPlot}
                />
                <input
                  type="text"
                  value={Array.isArray(singleSelectedItem.tags) ? singleSelectedItem.tags.join(', ') : ''}
                  onChange={(e) => updateItem(singleSelectedItem.id, { tags: parseTagInput(e.target.value) })}
                  className="px-2 py-1 border border-gray-300 rounded text-xs"
                  placeholder="Tags"
                  disabled={!canEditPlot}
                />
              </div>

              {isLightingCategory(singleSelectedItem) && (
                <div className="border border-gray-200 rounded p-2 bg-gray-50 space-y-2">
                  <p className="text-xs font-semibold m-0">Lighting Metadata</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={singleSelectedItem.channel || ''}
                      onChange={(e) => updateItem(singleSelectedItem.id, { channel: e.target.value })}
                      className="px-2 py-1 border border-gray-300 rounded text-xs"
                      placeholder="Channel"
                      disabled={!canMutateItem(singleSelectedItem)}
                    />
                    <input
                      type="text"
                      value={singleSelectedItem.riggingPosition || ''}
                      onChange={(e) => updateItem(singleSelectedItem.id, { riggingPosition: e.target.value })}
                      className="px-2 py-1 border border-gray-300 rounded text-xs"
                      placeholder="Rigging position"
                      disabled={!canMutateItem(singleSelectedItem)}
                    />
                    <select
                      value={singleSelectedItem.snapZone || ''}
                      onChange={(e) => updateItem(singleSelectedItem.id, { snapZone: e.target.value })}
                      className="px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                      disabled={!canMutateItem(singleSelectedItem)}
                    >
                      <option value="">Snap zone...</option>
                      {LIGHTING_SNAP_ZONES.map((zone) => (
                        <option key={zone.value} value={zone.value}>{zone.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={snapSelectedLightingToZone}
                      disabled={!canMutateItem(singleSelectedItem) || !singleSelectedItem.snapZone}
                    >
                      Snap to Zone
                    </button>
                  </div>
                  {normalized.lightingProMode && (
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={singleSelectedItem.dimmer || ''} onChange={(e) => updateItem(singleSelectedItem.id, { dimmer: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-xs" placeholder="Dimmer" disabled={!canMutateItem(singleSelectedItem)} />
                      <input type="text" value={singleSelectedItem.circuit || ''} onChange={(e) => updateItem(singleSelectedItem.id, { circuit: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-xs" placeholder="Circuit" disabled={!canMutateItem(singleSelectedItem)} />
                      <input type="text" value={singleSelectedItem.unitNumber || ''} onChange={(e) => updateItem(singleSelectedItem.id, { unitNumber: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-xs" placeholder="Unit #" disabled={!canMutateItem(singleSelectedItem)} />
                      <input type="text" value={singleSelectedItem.universe || ''} onChange={(e) => updateItem(singleSelectedItem.id, { universe: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-xs" placeholder="Universe" disabled={!canMutateItem(singleSelectedItem)} />
                      <input type="text" value={singleSelectedItem.dmxAddress || ''} onChange={(e) => updateItem(singleSelectedItem.id, { dmxAddress: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-xs" placeholder="DMX address" disabled={!canMutateItem(singleSelectedItem)} />
                      <select value={singleSelectedItem.dmxMode || ''} onChange={(e) => updateItem(singleSelectedItem.id, { dmxMode: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-xs bg-white" disabled={!canMutateItem(singleSelectedItem)}>
                        <option value="">DMX mode...</option>
                        {DMX_MODE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                      <input type="text" value={singleSelectedItem.gel || ''} onChange={(e) => updateItem(singleSelectedItem.id, { gel: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-xs" placeholder="Gel (Lee/Rosco)" disabled={!canMutateItem(singleSelectedItem)} />
                      <input type="text" value={singleSelectedItem.gobo || ''} onChange={(e) => updateItem(singleSelectedItem.id, { gobo: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-xs" placeholder="Gobo" disabled={!canMutateItem(singleSelectedItem)} />
                      <select value={singleSelectedItem.purpose || ''} onChange={(e) => updateItem(singleSelectedItem.id, { purpose: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-xs bg-white" disabled={!canMutateItem(singleSelectedItem)}>
                        <option value="">Purpose...</option>
                        {LIGHTING_PURPOSE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                      <input type="number" min="0" step="1" value={singleSelectedItem.powerDrawWatts || ''} onChange={(e) => updateItem(singleSelectedItem.id, { powerDrawWatts: toNumberOrBlank(e.target.value) })} className="px-2 py-1 border border-gray-300 rounded text-xs" placeholder="Power draw (W)" disabled={!canMutateItem(singleSelectedItem)} />
                      <input type="text" value={singleSelectedItem.focusArea || ''} onChange={(e) => updateItem(singleSelectedItem.id, { focusArea: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-xs col-span-2" placeholder="Focus area" disabled={!canMutateItem(singleSelectedItem)} />
                      <textarea value={singleSelectedItem.focusNotes || ''} onChange={(e) => updateItem(singleSelectedItem.id, { focusNotes: e.target.value })} rows={2} className="px-2 py-1 border border-gray-300 rounded text-xs col-span-2" placeholder="Focus notes" disabled={!canMutateItem(singleSelectedItem)} />
                    </div>
                  )}
                </div>
              )}

              {isSoundCategory(singleSelectedItem) && (
                <div className="border border-gray-200 rounded p-2 bg-gray-50 space-y-2">
                  <p className="text-xs font-semibold m-0">Sound Metadata</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" value={singleSelectedItem.inputNumber || ''} onChange={(e) => updateItem(singleSelectedItem.id, { inputNumber: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-xs" placeholder="Input #" disabled={!canMutateItem(singleSelectedItem)} />
                    <input type="text" value={singleSelectedItem.sourceName || ''} onChange={(e) => updateItem(singleSelectedItem.id, { sourceName: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-xs" placeholder="Source" disabled={!canMutateItem(singleSelectedItem)} />
                    <input type="text" value={singleSelectedItem.micType || ''} onChange={(e) => updateItem(singleSelectedItem.id, { micType: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-xs" placeholder="Mic Type" disabled={!canMutateItem(singleSelectedItem)} />
                    <label className="text-xs flex items-center gap-1 border border-gray-200 rounded px-2"><input type="checkbox" checked={!!singleSelectedItem.phantom} onChange={(e) => updateItem(singleSelectedItem.id, { phantom: e.target.checked })} disabled={!canMutateItem(singleSelectedItem)} />48V Phantom</label>
                  </div>
                  {normalized.soundProMode && (
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={singleSelectedItem.insertPoint || ''} onChange={(e) => updateItem(singleSelectedItem.id, { insertPoint: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-xs" placeholder="Insert" disabled={!canMutateItem(singleSelectedItem)} />
                      <input type="text" value={singleSelectedItem.fohPatch || ''} onChange={(e) => updateItem(singleSelectedItem.id, { fohPatch: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-xs" placeholder="FOH patch" disabled={!canMutateItem(singleSelectedItem)} />
                      <input type="text" value={singleSelectedItem.monitorSend || ''} onChange={(e) => updateItem(singleSelectedItem.id, { monitorSend: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-xs" placeholder="Monitor send" disabled={!canMutateItem(singleSelectedItem)} />
                      <input type="text" value={singleSelectedItem.rfFrequency || ''} onChange={(e) => updateItem(singleSelectedItem.id, { rfFrequency: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-xs" placeholder="RF Frequency" disabled={!canMutateItem(singleSelectedItem)} />
                      <input type="text" value={singleSelectedItem.packNumber || ''} onChange={(e) => updateItem(singleSelectedItem.id, { packNumber: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-xs" placeholder="Pack #" disabled={!canMutateItem(singleSelectedItem)} />
                      <label className="text-xs flex items-center gap-1 border border-gray-200 rounded px-2"><input type="checkbox" checked={!!singleSelectedItem.spareAssigned} onChange={(e) => updateItem(singleSelectedItem.id, { spareAssigned: e.target.checked })} disabled={!canMutateItem(singleSelectedItem)} />Spare Assigned</label>
                    </div>
                  )}
                </div>
              )}

              {isVideoCategory(singleSelectedItem) && (
                <div className="border border-gray-200 rounded p-2 bg-gray-50 space-y-2">
                  <p className="text-xs font-semibold m-0">Projection / Video Metadata</p>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={singleSelectedItem.signalType || ''} onChange={(e) => updateItem(singleSelectedItem.id, { signalType: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-xs bg-white" disabled={!canMutateItem(singleSelectedItem)}>
                      <option value="">Signal type...</option>
                      {SIGNAL_TYPE_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                    <input type="text" value={singleSelectedItem.resolution || ''} onChange={(e) => updateItem(singleSelectedItem.id, { resolution: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-xs" placeholder="Resolution" disabled={!canMutateItem(singleSelectedItem)} />
                    <input type="text" value={singleSelectedItem.aspectRatio || ''} onChange={(e) => updateItem(singleSelectedItem.id, { aspectRatio: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-xs" placeholder="Aspect ratio" disabled={!canMutateItem(singleSelectedItem)} />
                    <input type="text" value={singleSelectedItem.outputMapping || ''} onChange={(e) => updateItem(singleSelectedItem.id, { outputMapping: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-xs" placeholder="Output map" disabled={!canMutateItem(singleSelectedItem)} />
                    {normalized.projectionProMode && (
                      <>
                        <input type="text" value={singleSelectedItem.throwDistance || ''} onChange={(e) => updateItem(singleSelectedItem.id, { throwDistance: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-xs" placeholder="Throw distance" disabled={!canMutateItem(singleSelectedItem)} />
                        <input type="text" value={singleSelectedItem.targetOutput || ''} onChange={(e) => updateItem(singleSelectedItem.id, { targetOutput: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-xs" placeholder="Target output" disabled={!canMutateItem(singleSelectedItem)} />
                        <textarea value={singleSelectedItem.lensNotes || ''} onChange={(e) => updateItem(singleSelectedItem.id, { lensNotes: e.target.value })} rows={2} className="px-2 py-1 border border-gray-300 rounded text-xs col-span-2" placeholder="Lens / routing notes" disabled={!canMutateItem(singleSelectedItem)} />
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="border border-gray-200 rounded p-2 bg-gray-50 space-y-2">
                <label className="text-xs flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!singleSelectedItem.powerRequired}
                    onChange={(e) => updateItem(singleSelectedItem.id, { powerRequired: e.target.checked })}
                    disabled={!canEditPlot || !!singleSelectedItem.isElectricalSource}
                  />
                  Power required
                </label>

                {(singleSelectedItem.powerRequired || singleSelectedItem.isElectricalSource || activeViewMode === 'power') && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={singleSelectedItem.wattage}
                        onChange={(e) => updateItem(singleSelectedItem.id, { wattage: toNumberOrBlank(e.target.value) })}
                        className="px-2 py-1 border border-gray-300 rounded text-xs"
                        placeholder="Wattage"
                        disabled={!canEditPlot || !!singleSelectedItem.isElectricalSource}
                      />
                      <select
                        value={singleSelectedItem.voltage || '120V'}
                        onChange={(e) => updateItem(singleSelectedItem.id, { voltage: e.target.value })}
                        className="px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                        disabled={!canEditPlot}
                      >
                        {VOLTAGE_OPTIONS.map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={singleSelectedItem.amperage}
                        onChange={(e) => updateItem(singleSelectedItem.id, { amperage: toNumberOrBlank(e.target.value) })}
                        className="px-2 py-1 border border-gray-300 rounded text-xs"
                        placeholder="Amps"
                        disabled={!canEditPlot || !!singleSelectedItem.isElectricalSource}
                      />
                    </div>
                    {!singleSelectedItem.isElectricalSource && (
                      <select
                        value={singleSelectedItem.assignedCircuitId || ''}
                        onChange={(e) => updateItem(singleSelectedItem.id, { assignedCircuitId: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                        disabled={!canEditPlot}
                      >
                        <option value="">Assign circuit...</option>
                        {circuitSummary.map((circuit) => (
                          <option key={circuit.id} value={circuit.id}>
                            {circuit.label} ({circuit.voltage}, {circuit.capacity}A cap)
                          </option>
                        ))}
                      </select>
                    )}
                    {singleSelectedItem.isElectricalSource && (
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={singleSelectedItem.sourceVoltage || '120V'}
                          onChange={(e) => updateItem(singleSelectedItem.id, { sourceVoltage: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                          disabled={!canEditPlot}
                        >
                          {VOLTAGE_OPTIONS.map((value) => (
                            <option key={value} value={value}>{value}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={singleSelectedItem.sourceAmperage}
                          onChange={(e) => updateItem(singleSelectedItem.id, { sourceAmperage: toNumberOrBlank(e.target.value) })}
                          className="px-2 py-1 border border-gray-300 rounded text-xs"
                          placeholder="Circuit capacity (A)"
                          disabled={!canEditPlot}
                        />
                      </div>
                    )}
                    {selectedItemCircuitMeta && (
                      <p className="text-[11px] text-gray-600 m-0">
                        Circuit remaining: {(selectedItemCircuitMeta.remaining || 0).toFixed(2)}A
                      </p>
                    )}
                  </>
                )}
              </div>

              {singleSelectedItem.isDoor && (
                <div className="border border-gray-200 rounded p-2 bg-gray-50 space-y-2">
                  <p className="text-xs font-semibold m-0">Door / Egress Properties</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={singleSelectedItem.doorWidthFeet}
                      onChange={(e) => updateItem(singleSelectedItem.id, { doorWidthFeet: toNumberOrBlank(e.target.value) })}
                      className="px-2 py-1 border border-gray-300 rounded text-xs"
                      placeholder="Door width (ft)"
                      disabled={!canEditPlot}
                    />
                    <select
                      value={singleSelectedItem.swingDirection || 'in'}
                      onChange={(e) => updateItem(singleSelectedItem.id, { swingDirection: e.target.value })}
                      className="px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                      disabled={!canEditPlot}
                    >
                      {DOOR_SWING_OPTIONS.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>
                  <select
                    value={singleSelectedItem.entryType || 'public'}
                    onChange={(e) => updateItem(singleSelectedItem.id, { entryType: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                    disabled={!canEditPlot}
                  >
                    {ENTRY_TYPE_OPTIONS.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-1"><input type="checkbox" checked={!!singleSelectedItem.isDoubleDoor} onChange={(e) => updateItem(singleSelectedItem.id, { isDoubleDoor: e.target.checked })} disabled={!canEditPlot} />Double door</label>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={!!singleSelectedItem.isRollUpDoor} onChange={(e) => updateItem(singleSelectedItem.id, { isRollUpDoor: e.target.checked })} disabled={!canEditPlot} />Roll-up</label>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={!!singleSelectedItem.isEmergencyExit} onChange={(e) => updateItem(singleSelectedItem.id, { isEmergencyExit: e.target.checked })} disabled={!canEditPlot} />Emergency exit</label>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={!!singleSelectedItem.isADA} onChange={(e) => updateItem(singleSelectedItem.id, { isADA: e.target.checked })} disabled={!canEditPlot} />ADA</label>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-gray-600 block mb-1">Notes</label>
                <textarea
                  value={singleSelectedItem.notes || ''}
                  onChange={(e) => updateItem(singleSelectedItem.id, { notes: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs resize-y"
                  rows={3}
                  disabled={!canEditPlot}
                />
              </div>
            </div>
          )}

          {!singleSelectedItem && selectedItems.length === 0 && (
            <div className="border border-gray-200 rounded-lg p-3 bg-white space-y-2">
              <p className="text-xs font-semibold m-0">Label + Export Controls</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!normalized.exportOptions.includeSystemTypes}
                    onChange={(e) => updateLayout({
                      ...normalized,
                      exportOptions: { ...normalized.exportOptions, includeSystemTypes: e.target.checked },
                    })}
                    disabled={!canEditPlot}
                  />
                  Include system types
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!normalized.exportOptions.includeDefaultLabels}
                    onChange={(e) => updateLayout({
                      ...normalized,
                      exportOptions: { ...normalized.exportOptions, includeDefaultLabels: e.target.checked },
                    })}
                    disabled={!canEditPlot}
                  />
                  Include default labels
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!normalized.exportOptions.includeCustomLabels}
                    onChange={(e) => updateLayout({
                      ...normalized,
                      exportOptions: { ...normalized.exportOptions, includeCustomLabels: e.target.checked },
                    })}
                    disabled={!canEditPlot}
                  />
                  Include custom labels
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!normalized.exportOptions.includeBoth}
                    onChange={(e) => updateLayout({
                      ...normalized,
                      exportOptions: { ...normalized.exportOptions, includeBoth: e.target.checked },
                    })}
                    disabled={!canEditPlot}
                  />
                  Include system + custom on one line
                </label>
              </div>
              <button type="button" className="btn-secondary text-xs" onClick={resetAllCustomLabels} disabled={!canEditPlot}>
                Reset all custom labels
              </button>
            </div>
          )}

          <div className="border border-gray-200 rounded-lg p-3 bg-white space-y-2">
            <p className="text-xs font-semibold m-0">Power Summary</p>
            <p className="text-[11px] text-gray-600 m-0">
              Main Service · Total Capacity: {powerSummaryByDepartment.totalCapacity.toFixed(2)}A · Assigned Load: {powerSummaryByDepartment.totalAssigned.toFixed(2)}A · Remaining Headroom: {powerSummaryByDepartment.remainingHeadroom.toFixed(2)}A
            </p>
            <p className="text-[11px] text-gray-600 m-0">
              Lighting: {powerSummaryByDepartment.lighting.toFixed(2)}A · Audio: {powerSummaryByDepartment.audio.toFixed(2)}A · Vendor: {powerSummaryByDepartment.vendor.toFixed(2)}A · Ops: {powerSummaryByDepartment.operations.toFixed(2)}A
            </p>
            {powerSummaryByDepartment.overloadedCircuitCount > 0 && (
              <p className="text-[11px] text-red-600 m-0">
                Warning: {powerSummaryByDepartment.overloadedCircuitCount} overloaded circuit(s).
              </p>
            )}
            {unassignedPowerLoads.length > 0 && (
              <p className="text-[11px] text-amber-700 m-0">
                {unassignedPowerLoads.length} powered item(s) are not assigned to a circuit.
              </p>
            )}
            {circuitSummary.slice(0, 6).map((row) => (
              <p key={row.id} className={`text-[11px] m-0 ${row.overloaded ? 'text-red-600' : 'text-gray-600'}`}>
                {row.label}: {row.assignedLoad.toFixed(2)}A / {row.capacity.toFixed(2)}A ({row.remaining.toFixed(2)}A remaining)
              </p>
            ))}
          </div>

          <div className="border border-gray-200 rounded-lg p-3 bg-white space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold m-0">AI Fixture + Equipment Intake</p>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => equipmentInputRef.current?.click()}
                disabled={equipmentExtracting}
              >
                {equipmentExtracting ? 'Reading…' : 'Upload Equipment Photo'}
              </button>
            </div>
            <input
              ref={equipmentInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handleEquipmentUpload(e.target.files || []);
                e.target.value = '';
              }}
            />
            {equipmentStatus ? <p className="text-[11px] text-gray-600 m-0">{equipmentStatus}</p> : null}
            {equipmentCandidate && (
              <div className="border border-gray-200 rounded p-2 bg-gray-50 space-y-1">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={equipmentCandidate.manufacturer || ''}
                    onChange={(e) => setEquipmentCandidate((prev) => ({ ...(prev || {}), manufacturer: e.target.value }))}
                    className="px-2 py-1 border border-gray-300 rounded text-xs"
                    placeholder="Manufacturer"
                  />
                  <input
                    type="text"
                    value={equipmentCandidate.model || ''}
                    onChange={(e) => setEquipmentCandidate((prev) => ({ ...(prev || {}), model: e.target.value }))}
                    className="px-2 py-1 border border-gray-300 rounded text-xs"
                    placeholder="Model"
                  />
                  <input
                    type="text"
                    value={equipmentCandidate.systemType || ''}
                    onChange={(e) => setEquipmentCandidate((prev) => ({ ...(prev || {}), systemType: e.target.value }))}
                    className="px-2 py-1 border border-gray-300 rounded text-xs"
                    placeholder="System type"
                  />
                  <input
                    type="text"
                    value={equipmentCandidate.category || ''}
                    onChange={(e) => setEquipmentCandidate((prev) => ({ ...(prev || {}), category: e.target.value }))}
                    className="px-2 py-1 border border-gray-300 rounded text-xs"
                    placeholder="Category"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" className="btn-primary text-xs" onClick={saveEquipmentCandidate} disabled={!canEditPlot}>
                    Save to Equipment Library
                  </button>
                  <button type="button" className="btn-secondary text-xs" onClick={() => addEquipmentLibraryEntryToPlot(equipmentCandidate)} disabled={!canEditPlot}>
                    Add to Plot
                  </button>
                </div>
              </div>
            )}
            {(normalized.equipmentLibrary || []).length > 0 && (
              <div className="max-h-36 overflow-auto space-y-1">
                {(normalized.equipmentLibrary || []).slice(0, 24).map((entry) => (
                  <div key={entry.id} className="border border-gray-200 rounded px-2 py-1 text-[11px] bg-gray-50 flex items-center justify-between gap-2">
                    <div className="truncate">
                      {entry.systemType || 'Equipment'} · {entry.manufacturer || 'Unknown'} {entry.model || ''}
                    </div>
                    <button type="button" className="btn-secondary text-[10px]" onClick={() => addEquipmentLibraryEntryToPlot(entry)} disabled={!canEditPlot}>
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-auto">
          <div
            ref={boardRef}
            role="button"
            tabIndex={0}
            onClick={() => {
              setSelectedIds([]);
              setInlineEditingId('');
            }}
            className="relative border border-gray-300 rounded bg-white"
            style={{
              width: boardWidthPx,
              height: boardDepthPx,
              backgroundImage: 'linear-gradient(to right, #eee 1px, transparent 1px), linear-gradient(to bottom, #eee 1px, transparent 1px)',
              backgroundSize: `${CELL}px ${CELL}px`,
            }}
          >
            {activeViewMode === 'safety' && normalized.egress.showFireLanes && (
              <div className="absolute top-0 left-0 right-0 h-6 bg-red-50 border-b border-red-200 text-[10px] text-red-600 px-2 py-1 z-10 pointer-events-none">
                Fire lane overlay active
              </div>
            )}
            {activeViewMode === 'safety' && normalized.egress.showPaths && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: 'repeating-linear-gradient(45deg, rgba(34,197,94,0.12), rgba(34,197,94,0.12) 8px, transparent 8px, transparent 16px)',
                }}
              />
            )}
            {activeViewMode === 'safety' && normalized.egress.showCrowdFlowArrows && (
              <div className="absolute bottom-1 right-1 text-[10px] text-gray-600 bg-white/85 px-1 py-0.5 rounded pointer-events-none">
                Crowd flow ➜➜➜
              </div>
            )}
            {activeViewMode === 'surveillance' && (
              <div className="absolute top-1 right-1 text-[10px] text-purple-700 bg-white/90 px-1.5 py-0.5 rounded pointer-events-none border border-purple-200">
                Surveillance overlay active
              </div>
            )}
            {activeViewMode === 'access_control' && (
              <div className="absolute top-1 right-1 text-[10px] text-orange-700 bg-white/90 px-1.5 py-0.5 rounded pointer-events-none border border-orange-200">
                Access control overlay active
              </div>
            )}
            {activeViewMode === 'weather_risk' && (
              <div className="absolute top-1 right-1 text-[10px] text-sky-700 bg-white/90 px-1.5 py-0.5 rounded pointer-events-none border border-sky-200">
                Weather risk overlay active
              </div>
            )}
            {activeViewMode === 'lighting_focus' && (
              <div className="absolute top-1 right-1 text-[10px] text-amber-700 bg-white/90 px-1.5 py-0.5 rounded pointer-events-none border border-amber-200">
                Lighting focus view active
              </div>
            )}
            {activeViewMode === 'projection_video' && (
              <div className="absolute top-1 right-1 text-[10px] text-fuchsia-700 bg-white/90 px-1.5 py-0.5 rounded pointer-events-none border border-fuchsia-200">
                Projection / video view active
              </div>
            )}
            {normalized.overlayMode !== 'both' && (
              <div className="absolute bottom-1 right-1 text-[10px] text-gray-700 bg-white/90 px-1.5 py-0.5 rounded pointer-events-none border border-gray-200">
                Overlay filter: {normalized.overlayMode === 'house' ? 'House Only' : 'Show Only'}
              </div>
            )}

            {visibleItems.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              const warning = activeViewMode === 'power' && item.powerRequired && inferAmps(item) > 0 && !item.assignedCircuitId;
              const displayLabel = buildDisplayLabel(item, normalized.labelDisplayMode || 'item');
              const emergencyHighlight = !!normalized.egress.highlightEmergencyExits;
              const colorClass = colorClassForItem(item, activeViewMode, isSelected, emergencyHighlight);
              const canMoveItem = canMutateItem(item);
              const showFocusHint = activeViewMode === 'lighting_focus' && isLightingCategory(item) && !!item.focusArea;
              const layerTag = item.layer === 'house' ? 'H' : 'S';

              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleSelect(event, item.id);
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    setInlineEditingId(item.id);
                    setSelectedIds([item.id]);
                  }}
                  onPointerDown={(event) => {
                    if (!canMoveItem) return;
                    handlePointerDown(event, item);
                  }}
                  className={`absolute text-[10px] font-semibold border rounded shadow-sm select-none ${canMoveItem ? 'cursor-move' : 'cursor-not-allowed opacity-90'} ${colorClass}`}
                  style={{
                    left: item.x * CELL,
                    top: item.y * CELL,
                    width: (item.w || 1) * CELL,
                    height: (item.h || 1) * CELL,
                    transform: `rotate(${item.rotation || 0}deg)`,
                    transformOrigin: 'center center',
                    padding: 2,
                    overflow: 'hidden',
                  }}
                  title={`${item.systemType || item.type}${item.customLabel ? ` · ${item.customLabel}` : ''}${item.layer === 'house' ? ' · House Layer' : ' · Show Layer'}`}
                >
                  <div className="truncate">
                    {warning ? '⚠ ' : ''}
                    <span className="inline-block mr-1 text-[9px] opacity-70">{layerTag}</span>
                    {displayLabel}
                  </div>
                  {showFocusHint ? (
                    <div className="text-[9px] truncate text-amber-700 mt-0.5">
                      Focus: {item.focusArea}
                    </div>
                  ) : null}
                  {inlineEditingId === item.id && editable && (
                    <input
                      autoFocus
                      type="text"
                      value={item.customLabel || ''}
                      onChange={(e) => updateItem(item.id, { customLabel: e.target.value })}
                      onBlur={() => setInlineEditingId('')}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute left-0 right-0 bottom-0 mx-1 mb-1 px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white"
                      placeholder="Custom label"
                    />
                  )}
                  {editable && isSelected && (
                    <div className="absolute right-0 top-0 flex gap-1 p-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateItems(
                            selectedIds.length > 1 ? selectedIds : [item.id],
                            (row) => ({ ...row, rotation: ((row.rotation || 0) + 90) % 360 })
                          );
                        }}
                        className="text-[9px] px-1 py-0.5 bg-white border border-gray-300 rounded cursor-pointer"
                        disabled={!canMoveItem}
                      >
                        ↻
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteItems(selectedIds.length > 1 && isSelected ? selectedIds : [item.id]);
                        }}
                        className="text-[9px] px-1 py-0.5 bg-white border border-red-300 text-red-600 rounded cursor-pointer"
                        disabled={!canMoveItem}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2 mb-0">
            Drag to position. `H` = house layer, `S` = show layer. Double-click any object to quick-edit custom label. Multi-select with Ctrl/Cmd/Shift for bulk labeling.
          </p>
        </div>
      </div>
    </div>
  );
}
