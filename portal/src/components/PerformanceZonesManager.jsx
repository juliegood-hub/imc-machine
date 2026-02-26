import { useMemo, useState } from 'react';
import { useVenue } from '../context/VenueContext';
import { useAuth } from '../context/AuthContext';
import { isVenueRole } from '../constants/clientTypes';

const ZONE_TYPES = [
  'theater',
  'club_stage',
  'rooftop',
  'outdoor_patio',
  'black_box',
  'studio',
  'conference_room',
  'auditorium',
];

function contactsToText(contacts = []) {
  return (contacts || []).map(c => [
    c.role || '',
    c.name || '',
    c.phone || '',
    c.email || '',
  ].join('|')).join('\n');
}

function contactsFromText(raw = '') {
  return String(raw || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [role = '', name = '', phone = '', email = ''] = line.split('|').map(part => part.trim());
      return { role, name, phone, email };
    });
}

function equipmentFromText(raw = '') {
  return String(raw || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

export default function PerformanceZonesManager() {
  const {
    performanceZones,
    savePerformanceZone,
    editPerformanceZone,
    removePerformanceZone,
    venueProfiles,
  } = useVenue();
  const { user } = useAuth();
  const canEdit = user?.isAdmin || isVenueRole(user?.clientType || '');

  const [form, setForm] = useState({
    name: '',
    zone_type: 'club_stage',
    venue_profile_id: '',
    width_ft: '',
    depth_ft: '',
    ceiling_height_ft: '',
    capacity: '',
    fixed_equipment_text: '',
    power_summary: '',
    restrictions: '',
    load_in_notes: '',
    contacts_text: '',
  });
  const [editingId, setEditingId] = useState('');
  const [status, setStatus] = useState('');

  const sortedZones = useMemo(() => (
    [...(performanceZones || [])].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  ), [performanceZones]);

  const resetForm = () => {
    setForm({
      name: '',
      zone_type: 'club_stage',
      venue_profile_id: '',
      width_ft: '',
      depth_ft: '',
      ceiling_height_ft: '',
      capacity: '',
      fixed_equipment_text: '',
      power_summary: '',
      restrictions: '',
      load_in_notes: '',
      contacts_text: '',
    });
    setEditingId('');
  };

  const handleSave = async () => {
    if (!canEdit) return;
    const name = String(form.name || '').trim();
    if (!name) {
      setStatus('Add a zone name and I can save it.');
      return;
    }
    const payload = {
      name,
      zone_type: form.zone_type || 'club_stage',
      venue_profile_id: form.venue_profile_id || null,
      width_ft: form.width_ft ? Number(form.width_ft) : null,
      depth_ft: form.depth_ft ? Number(form.depth_ft) : null,
      ceiling_height_ft: form.ceiling_height_ft ? Number(form.ceiling_height_ft) : null,
      capacity: form.capacity ? Number(form.capacity) : null,
      fixed_equipment: equipmentFromText(form.fixed_equipment_text),
      power_spec: { summary: form.power_summary || '' },
      restrictions: form.restrictions || '',
      load_in_notes: form.load_in_notes || '',
      default_contacts: contactsFromText(form.contacts_text),
    };
    try {
      if (editingId) {
        await editPerformanceZone(editingId, payload);
        setStatus(`Updated zone "${name}".`);
      } else {
        await savePerformanceZone(payload);
        setStatus(`Created zone "${name}".`);
      }
      resetForm();
    } catch (err) {
      setStatus(`I hit a snag saving that zone: ${err.message}`);
    }
  };

  const loadZone = (zone) => {
    setEditingId(zone.id);
    setForm({
      name: zone.name || '',
      zone_type: zone.zone_type || 'club_stage',
      venue_profile_id: zone.venue_profile_id || '',
      width_ft: zone.width_ft || '',
      depth_ft: zone.depth_ft || '',
      ceiling_height_ft: zone.ceiling_height_ft || '',
      capacity: zone.capacity || '',
      fixed_equipment_text: (zone.fixed_equipment || []).join(', '),
      power_summary: zone.power_spec?.summary || '',
      restrictions: zone.restrictions || '',
      load_in_notes: zone.load_in_notes || '',
      contacts_text: contactsToText(zone.default_contacts || []),
    });
  };

  const handleDelete = async (zoneId) => {
    if (!canEdit) return;
    try {
      await removePerformanceZone(zoneId);
      if (editingId === zoneId) resetForm();
      setStatus('Zone archived.');
    } catch (err) {
      setStatus(`I hit a snag archiving that zone: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="text-lg mb-1">Performance Zones</h3>
        <p className="text-sm text-gray-500 m-0">
          Create sub-stages/rooms with their own dimensions, fixed gear, power notes, restrictions, and contacts.
        </p>
      </div>

      {!canEdit && (
        <div className="card bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-800 m-0">Read-only: venue admins or booking agents can edit zone specs.</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
        <div className="card">
          <h4 className="text-base mb-3">Saved Zones ({sortedZones.length})</h4>
          {sortedZones.length === 0 ? (
            <p className="text-sm text-gray-500 m-0">No zones yet. Add your first stage or room on the right.</p>
          ) : (
            <div className="space-y-2">
              {sortedZones.map(zone => (
                <div key={zone.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm m-0">{zone.name}</p>
                      <p className="text-xs text-gray-500 m-0 mt-0.5">
                        {zone.zone_type || 'zone'}
                        {(zone.width_ft && zone.depth_ft) ? ` · ${zone.width_ft}ft x ${zone.depth_ft}ft` : ''}
                        {zone.capacity ? ` · Cap ${zone.capacity}` : ''}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => loadZone(zone)} className="text-xs px-2 py-1 border border-gray-300 rounded bg-white">Edit</button>
                        <button type="button" onClick={() => handleDelete(zone.id)} className="text-xs px-2 py-1 border border-red-300 text-red-700 rounded bg-white">Archive</button>
                      </div>
                    )}
                  </div>
                  {zone.fixed_equipment?.length > 0 && (
                    <p className="text-xs text-gray-600 mt-2 mb-0">
                      <span className="font-semibold">Fixed gear:</span> {zone.fixed_equipment.join(', ')}
                    </p>
                  )}
                  {zone.restrictions && (
                    <p className="text-xs text-gray-600 mt-1 mb-0">
                      <span className="font-semibold">Restrictions:</span> {zone.restrictions}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h4 className="text-base mb-3">{editingId ? 'Edit Zone' : 'Add Zone'}</h4>
          <div className="space-y-2">
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Zone name (Rooftop Stage)"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              disabled={!canEdit}
            />
            <select
              value={form.zone_type}
              onChange={e => setForm(prev => ({ ...prev, zone_type: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white"
              disabled={!canEdit}
            >
              {ZONE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
            <select
              value={form.venue_profile_id}
              onChange={e => setForm(prev => ({ ...prev, venue_profile_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white"
              disabled={!canEdit}
            >
              <option value="">Link to saved venue profile (optional)</option>
              {(venueProfiles || []).map(profile => (
                <option key={profile.id} value={profile.id}>{profile.name}</option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" placeholder="Width ft" value={form.width_ft} onChange={e => setForm(prev => ({ ...prev, width_ft: e.target.value }))} className="px-3 py-2 border border-gray-300 rounded text-sm" disabled={!canEdit} />
              <input type="number" placeholder="Depth ft" value={form.depth_ft} onChange={e => setForm(prev => ({ ...prev, depth_ft: e.target.value }))} className="px-3 py-2 border border-gray-300 rounded text-sm" disabled={!canEdit} />
              <input type="number" placeholder="Height ft" value={form.ceiling_height_ft} onChange={e => setForm(prev => ({ ...prev, ceiling_height_ft: e.target.value }))} className="px-3 py-2 border border-gray-300 rounded text-sm" disabled={!canEdit} />
            </div>
            <input type="number" placeholder="Capacity" value={form.capacity} onChange={e => setForm(prev => ({ ...prev, capacity: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded text-sm" disabled={!canEdit} />
            <textarea value={form.fixed_equipment_text} onChange={e => setForm(prev => ({ ...prev, fixed_equipment_text: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-y" rows={2} placeholder="Fixed equipment, comma separated" disabled={!canEdit} />
            <textarea value={form.power_summary} onChange={e => setForm(prev => ({ ...prev, power_summary: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-y" rows={2} placeholder="Power notes (circuits, outlets, distro)" disabled={!canEdit} />
            <textarea value={form.restrictions} onChange={e => setForm(prev => ({ ...prev, restrictions: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-y" rows={2} placeholder="Restrictions (curfew, SPL cap, access limits)" disabled={!canEdit} />
            <textarea value={form.load_in_notes} onChange={e => setForm(prev => ({ ...prev, load_in_notes: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-y" rows={2} placeholder="Load-in/load-out notes" disabled={!canEdit} />
            <textarea value={form.contacts_text} onChange={e => setForm(prev => ({ ...prev, contacts_text: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-y" rows={3} placeholder="Default contacts (role|name|phone|email per line)" disabled={!canEdit} />
          </div>
          {status && <p className="text-xs text-gray-600 mt-2 mb-0">{status}</p>}
          <div className="flex items-center gap-2 mt-3">
            <button type="button" onClick={handleSave} className="btn-primary text-sm" disabled={!canEdit}>
              {editingId ? 'Update Zone' : 'Save Zone'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="btn-outline text-sm" disabled={!canEdit}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
