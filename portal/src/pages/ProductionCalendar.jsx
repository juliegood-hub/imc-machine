import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useVenue } from '../context/VenueContext';
import { parseLocalDate } from '../lib/dateUtils';

function formatDateLabel(dateValue) {
  const date = parseLocalDate(dateValue);
  if (Number.isNaN(date.getTime())) return 'Unknown Date';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(value) {
  if (!value) return 'TBD';
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return String(value);
}

export default function ProductionCalendar() {
  const { events, venueProfiles, performanceZones } = useVenue();
  const [venueFilter, setVenueFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');

  const venueOptions = useMemo(() => {
    const fromProfiles = (venueProfiles || [])
      .map(profile => ({ id: profile.id, name: profile.name || '' }))
      .filter(profile => profile.name);
    const fromEvents = Array.from(new Set((events || []).map(event => String(event.venue || '').trim()).filter(Boolean)))
      .map((name) => ({ id: `name:${name}`, name }));
    const combined = [...fromProfiles, ...fromEvents];
    const unique = new Map();
    combined.forEach((venue) => {
      const key = venue.id || venue.name;
      if (!unique.has(key)) unique.set(key, venue);
    });
    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [events, venueProfiles]);

  const zoneOptions = useMemo(() => (
    [...(performanceZones || [])]
      .filter(zone => !venueFilter || zone.venue_profile_id === venueFilter || !zone.venue_profile_id)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  ), [performanceZones, venueFilter]);

  const filteredEvents = useMemo(() => {
    let next = [...(events || [])];

    if (venueFilter) {
      const venueName = venueOptions.find(opt => opt.id === venueFilter)?.name || '';
      next = next.filter((event) => (
        event.venueProfileId === venueFilter
        || (venueName && String(event.venue || '').trim().toLowerCase() === venueName.trim().toLowerCase())
      ));
    }

    if (zoneFilter) {
      next = next.filter(event => event.performanceZoneId === zoneFilter);
    }

    next.sort((a, b) => {
      const aTime = new Date(a.bookingStartAt || `${a.date || ''}T${a.time || '00:00'}`).getTime();
      const bTime = new Date(b.bookingStartAt || `${b.date || ''}T${b.time || '00:00'}`).getTime();
      return aTime - bTime;
    });

    return next;
  }, [events, venueFilter, venueOptions, zoneFilter]);

  const groupedEvents = useMemo(() => {
    const groups = new Map();
    filteredEvents.forEach((event) => {
      const key = event.date || 'unknown';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(event);
    });
    return Array.from(groups.entries()).map(([date, rows]) => ({ date, rows }));
  }, [filteredEvents]);

  const selectedZone = zoneOptions.find(zone => zone.id === zoneFilter);

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <h1 className="text-3xl mb-2">Production Calendar</h1>
      <p className="text-gray-500 mb-6">
        {zoneFilter
          ? `Zone calendar: ${selectedZone?.name || 'Selected zone'}`
          : 'Venue calendar: all zones'}
      </p>

      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Venue</label>
            <select
              value={venueFilter}
              onChange={(e) => {
                setVenueFilter(e.target.value);
                setZoneFilter('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white"
            >
              <option value="">All venues</option>
              {venueOptions.map(venue => (
                <option key={venue.id} value={venue.id}>{venue.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Performance Zone</label>
            <select
              value={zoneFilter}
              onChange={e => setZoneFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white"
            >
              <option value="">All zones</option>
              {zoneOptions.map(zone => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}{zone.zone_type ? ` · ${zone.zone_type}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {groupedEvents.length === 0 ? (
        <div className="card text-center text-gray-500 py-8">
          No bookings match this venue/zone filter.
        </div>
      ) : (
        <div className="space-y-5">
          {groupedEvents.map(group => (
            <div key={group.date} className="card">
              <h3 className="text-base mb-3">{formatDateLabel(group.date)}</h3>
              <div className="space-y-2">
                {group.rows.map(event => (
                  <div key={event.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-semibold text-sm m-0">{event.title || 'Untitled Event'}</p>
                        <p className="text-xs text-gray-500 m-0 mt-1">
                          {event.venue || 'Venue TBD'}
                          {event.performanceZoneName ? ` · ${event.performanceZoneName}` : ''}
                        </p>
                      </div>
                      <div className="text-xs text-right">
                        <div>{formatTime(event.bookingStartAt || `${event.date}T${event.time || '00:00'}`)}</div>
                        <div className="text-gray-500">to {formatTime(event.bookingEndAt)}</div>
                      </div>
                    </div>
                    {event.showContacts?.length > 0 && (
                      <p className="text-xs text-gray-600 mt-2 mb-0">
                        Contacts: {event.showContacts.slice(0, 3).map(contact => (
                          `${contact.name || 'TBD'} (${contact.role || contact.title || 'role'})`
                        )).join(' · ')}
                        {event.showContacts.length > 3 ? ' …' : ''}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <Link to={`/events/${event.id}?opsTab=staffing`} className="px-2 py-1 rounded border border-gray-300 text-gray-700 no-underline">
                        Staffing
                      </Link>
                      <Link to={`/events/${event.id}?opsTab=purchasing`} className="px-2 py-1 rounded border border-gray-300 text-gray-700 no-underline">
                        Purchasing
                      </Link>
                      <Link to={`/events/${event.id}?opsTab=production`} className="px-2 py-1 rounded border border-gray-300 text-gray-700 no-underline">
                        Production
                      </Link>
                      <Link to={`/events/${event.id}?opsTab=concessions`} className="px-2 py-1 rounded border border-gray-300 text-gray-700 no-underline">
                        Concessions
                      </Link>
                      <Link to={`/events/${event.id}?opsTab=merch`} className="px-2 py-1 rounded border border-gray-300 text-gray-700 no-underline">
                        Merch
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
