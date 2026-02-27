import {
  PRODUCTION_PHASE_META,
  TAYLOR_FOUR_ZONE_META,
  WORKFLOW_SECTIONS,
  getWorkflowTrackMeta,
} from '../constants/workflowSections';

function getTaylorZoneMeta(zoneKey) {
  return TAYLOR_FOUR_ZONE_META.find((zone) => zone.key === zoneKey) || null;
}

function getProductionPhaseMeta(phaseKey) {
  return PRODUCTION_PHASE_META.find((phase) => phase.key === phaseKey) || PRODUCTION_PHASE_META[0];
}

function normalizeSections(sections = []) {
  if (Array.isArray(sections) && sections.length > 0) return sections;
  return WORKFLOW_SECTIONS;
}

export default function TaylorZoneReferenceStrip({
  sections = [],
  title = 'Section-to-Zone Reference',
  description = 'Every section is color-mapped to Andrew Taylor\'s four-zone framework.',
  className = '',
}) {
  const normalized = normalizeSections(sections);

  return (
    <div className={`rounded border border-[#0d1b2a1a] bg-white ${className}`}>
      <div className="px-3 py-2 border-b border-gray-100">
        <p className="m-0 text-xs font-semibold text-[#0d1b2a]">🗺️ {title}</p>
        <p className="m-0 text-[11px] text-gray-500">{description}</p>
      </div>
      <div className="divide-y divide-gray-100">
        {normalized.map((section, index) => {
          const trackMeta = getWorkflowTrackMeta(section.track);
          const phaseMeta = getProductionPhaseMeta(section.productionPhase);
          const sectionNumber = section.number || index + 1;
          const zones = (section.taylorZones || [])
            .map((zoneKey) => getTaylorZoneMeta(zoneKey))
            .filter(Boolean);
          return (
            <div key={`zone-ref-${section.id || index}`} className="px-3 py-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="m-0 text-sm font-semibold truncate">Section {sectionNumber}: {section.title}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className={`text-[11px] px-2 py-0.5 rounded ${trackMeta.badgeClass}`}>
                    {trackMeta.icon} {trackMeta.label}
                  </span>
                  <span className={`text-[11px] px-2 py-0.5 rounded ${phaseMeta.badgeClass}`}>
                    {phaseMeta.icon} {phaseMeta.label}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {zones.map((zone) => (
                  <span key={`zone-ref-${section.id || index}-${zone.key}`} className={`text-[11px] px-2 py-0.5 rounded ${zone.badgeClass}`}>
                    {zone.icon} {zone.label}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
