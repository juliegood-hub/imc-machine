import { parseLocalDate } from '../lib/dateUtils';
import { useState, useEffect } from 'react';
import { useVenue } from '../context/VenueContext';
import { useSearchParams } from 'react-router-dom';

export default function RunOfShow() {
  const { events, crew, updateEvent } = useVenue();
  const [searchParams] = useSearchParams();
  const preselectedEventId = searchParams.get('eventId');
  
  const [selectedEventId, setSelectedEventId] = useState(preselectedEventId || '');
  const [schedulingMode, setSchedulingMode] = useState('clock'); // 'clock' or 'duration'
  const [rows, setRows] = useState([
    { id: '1', time: '18:00', duration: '', item: 'Doors Open', crewMember: '', notes: '' },
    { id: '2', time: '18:30', duration: '', item: 'Sound Check', crewMember: '', notes: '' },
    { id: '3', time: '19:00', duration: '5 min', item: 'Welcome / Intro', crewMember: '', notes: '' },
    { id: '4', time: '19:05', duration: '', item: 'Main Performance', crewMember: '', notes: '' },
  ]);
  
  // Open mic queue
  const [openMicQueue, setOpenMicQueue] = useState([
    { id: '1', name: 'Sarah Johnson', song: 'Original Acoustic', notes: 'Needs mic stand', done: false },
    { id: '2', name: 'Mike Chen', song: 'Guitar Cover', notes: '', done: false },
  ]);
  
  const [saving, setSaving] = useState(false);
  const [printView, setPrintView] = useState(false);

  const selectedEvent = events.find(e => e.id === selectedEventId);

  // Load existing run of show data when event is selected
  useEffect(() => {
    if (selectedEvent?.run_of_show) {
      const runOfShow = selectedEvent.run_of_show;
      if (runOfShow.cues) setRows(runOfShow.cues);
      if (runOfShow.openMicQueue) setOpenMicQueue(runOfShow.openMicQueue);
      if (runOfShow.schedulingMode) setSchedulingMode(runOfShow.schedulingMode);
    }
  }, [selectedEvent]);

  const addRow = () => {
    setRows([...rows, { 
      id: Date.now().toString(), 
      time: '', 
      duration: '', 
      item: '', 
      crewMember: '', 
      notes: '' 
    }]);
  };

  const removeRow = (id) => {
    if (rows.length <= 1) return;
    setRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id, field, value) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const moveRow = (index, direction) => {
    const newRows = [...rows];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newRows.length) return;
    [newRows[index], newRows[targetIndex]] = [newRows[targetIndex], newRows[index]];
    setRows(newRows);
  };

  // Open Mic Queue functions
  const addOpenMicPerformer = () => {
    const name = prompt('Performer name:');
    if (!name) return;
    
    const song = prompt('Song/performance:');
    setOpenMicQueue(prev => [...prev, {
      id: Date.now().toString(),
      name,
      song: song || '',
      notes: '',
      done: false
    }]);
  };

  const updateOpenMicPerformer = (id, field, value) => {
    setOpenMicQueue(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const moveOpenMicPerformer = (index, direction) => {
    const newQueue = [...openMicQueue];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newQueue.length) return;
    [newQueue[index], newQueue[targetIndex]] = [newQueue[targetIndex], newQueue[index]];
    setOpenMicQueue(newQueue);
  };

  const removeOpenMicPerformer = (id) => {
    setOpenMicQueue(prev => prev.filter(p => p.id !== id));
  };

  const saveToSupabase = async () => {
    if (!selectedEvent) return;

    setSaving(true);
    try {
      const runOfShowData = {
        cues: rows,
        openMicQueue,
        schedulingMode,
        lastUpdated: new Date().toISOString()
      };

      await updateEvent(selectedEvent.id, { 
        run_of_show: runOfShowData 
      });

      alert('Run of Show saved successfully!');
    } catch (err) {
      console.error('Failed to save:', err);
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (printView) {
    return (
      <div className="print:block p-4 max-w-4xl mx-auto bg-white text-black">
        <div className="mb-6 border-b pb-4">
          <h1 className="text-2xl font-bold">{selectedEvent?.title || 'Event'} - Run of Show</h1>
          <p className="text-gray-600">
            {selectedEvent && parseLocalDate(selectedEvent.date).toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric', 
              year: 'numeric' 
            })}
          </p>
          <p className="text-sm text-gray-500">
            Generated: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
          </p>
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Event Timeline</h2>
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-2 text-left">Time</th>
                <th className="border border-gray-300 p-2 text-left">Duration</th>
                <th className="border border-gray-300 p-2 text-left">Item</th>
                <th className="border border-gray-300 p-2 text-left">Crew</th>
                <th className="border border-gray-300 p-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td className="border border-gray-300 p-2">{row.time}</td>
                  <td className="border border-gray-300 p-2">{row.duration}</td>
                  <td className="border border-gray-300 p-2">{row.item}</td>
                  <td className="border border-gray-300 p-2">{row.crewMember}</td>
                  <td className="border border-gray-300 p-2">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {openMicQueue.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Open Mic Queue</h2>
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2 text-left">#</th>
                  <th className="border border-gray-300 p-2 text-left">Performer</th>
                  <th className="border border-gray-300 p-2 text-left">Song/Performance</th>
                  <th className="border border-gray-300 p-2 text-left">Notes</th>
                  <th className="border border-gray-300 p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {openMicQueue.map((performer, index) => (
                  <tr key={performer.id} className={performer.done ? 'opacity-50' : ''}>
                    <td className="border border-gray-300 p-2">{index + 1}</td>
                    <td className="border border-gray-300 p-2">{performer.name}</td>
                    <td className="border border-gray-300 p-2">{performer.song}</td>
                    <td className="border border-gray-300 p-2">{performer.notes}</td>
                    <td className="border border-gray-300 p-2">{performer.done ? 'Done' : 'Waiting'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-8 pt-4 border-t text-center">
          <button 
            onClick={() => setPrintView(false)}
            className="px-4 py-2 bg-gray-600 text-white rounded no-print"
          >
            ← Back to Edit
          </button>
          <button 
            onClick={handlePrint}
            className="ml-3 px-4 py-2 bg-blue-600 text-white rounded no-print"
          >
            🖨️ Print
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <h1 className="text-3xl mb-2">📋 Run of Show</h1>
      <p className="text-gray-500 mb-6">Build your event timeline and manage open mic queue.</p>

      {/* Event Selection */}
      <div className="card mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Event</label>
        <div className="flex gap-3 items-center flex-wrap">
          <select 
            value={selectedEventId} 
            onChange={e => setSelectedEventId(e.target.value)}
            className="flex-1 min-w-64 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] bg-white"
          >
            <option value="">Choose an event...</option>
            {events.map(e => (
              <option key={e.id} value={e.id}>
                {e.title} · {parseLocalDate(e.date).toLocaleDateString()}
              </option>
            ))}
          </select>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setSchedulingMode(schedulingMode === 'clock' ? 'duration' : 'clock')}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                schedulingMode === 'clock' 
                  ? 'bg-[#c8a45e] text-white border-[#c8a45e]' 
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#c8a45e]'
              }`}
            >
              {schedulingMode === 'clock' ? '🕐 Clock Time' : '⏱️ Duration'}
            </button>
          </div>
        </div>
      </div>

      {selectedEvent && (
        <>
          {/* Timeline */}
          <div className="card mb-6 overflow-x-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg m-0">Event Timeline</h3>
              <div className="flex gap-2">
                <button onClick={addRow} className="btn-primary text-sm">+ Add Cue</button>
                <button 
                  onClick={saveToSupabase} 
                  disabled={saving}
                  className="btn-secondary text-sm disabled:opacity-50"
                >
                  {saving ? '💾 Saving...' : '💾 Save'}
                </button>
                <button 
                  onClick={() => setPrintView(true)} 
                  className="btn-secondary text-sm"
                >
                  🖨️ Print View
                </button>
              </div>
            </div>

            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-medium text-gray-500 w-8">Order</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500 w-24">
                    {schedulingMode === 'clock' ? 'Time' : 'Start'}
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500 w-20">Duration</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500">Cue Item</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500 w-36">Crew Member</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-500">Notes</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-1 px-2">
                      <div className="flex flex-col">
                        <button 
                          onClick={() => moveRow(i, -1)} 
                          disabled={i === 0}
                          className="text-xs text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer disabled:opacity-30 p-0"
                        >
                          ▲
                        </button>
                        <span className="text-xs text-gray-500 text-center">{i + 1}</span>
                        <button 
                          onClick={() => moveRow(i, 1)} 
                          disabled={i === rows.length - 1}
                          className="text-xs text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer disabled:opacity-30 p-0"
                        >
                          ▼
                        </button>
                      </div>
                    </td>
                    <td className="py-1 px-2">
                      {schedulingMode === 'clock' ? (
                        <input 
                          type="time" 
                          value={row.time} 
                          onChange={e => updateRow(row.id, 'time', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]" 
                        />
                      ) : (
                        <input 
                          type="text" 
                          value={row.time} 
                          onChange={e => updateRow(row.id, 'time', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]" 
                          placeholder="After cue X"
                        />
                      )}
                    </td>
                    <td className="py-1 px-2">
                      <input 
                        type="text" 
                        value={row.duration} 
                        onChange={e => updateRow(row.id, 'duration', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]" 
                        placeholder="15 min" 
                      />
                    </td>
                    <td className="py-1 px-2">
                      <input 
                        type="text" 
                        value={row.item} 
                        onChange={e => updateRow(row.id, 'item', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]" 
                        placeholder="Cue item..." 
                      />
                    </td>
                    <td className="py-1 px-2">
                      <select 
                        value={row.crewMember} 
                        onChange={e => updateRow(row.id, 'crewMember', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e] bg-white"
                      >
                        <option value="">Assign...</option>
                        {crew.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 px-2">
                      <input 
                        type="text" 
                        value={row.notes} 
                        onChange={e => updateRow(row.id, 'notes', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]" 
                        placeholder="Notes..." 
                      />
                    </td>
                    <td className="py-1 px-2">
                      <button 
                        onClick={() => removeRow(row.id)}
                        className="text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer text-sm p-0"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Open Mic Queue */}
          <div className="card overflow-x-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg m-0">🎤 Open Mic Queue</h3>
              <div className="flex gap-2">
                <button onClick={addOpenMicPerformer} className="btn-primary text-sm">+ Add Performer</button>
              </div>
            </div>

            {openMicQueue.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-4xl mb-3">🎤</p>
                <p>No performers in queue yet. Add someone to get started!</p>
              </div>
            ) : (
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-medium text-gray-500 w-8">Order</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Performer</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Song/Performance</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Notes</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500 w-20">Status</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {openMicQueue.map((performer, i) => (
                    <tr 
                      key={performer.id} 
                      className={`border-b border-gray-100 hover:bg-gray-50 ${
                        performer.done ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="py-1 px-2">
                        <div className="flex flex-col">
                          <button 
                            onClick={() => moveOpenMicPerformer(i, -1)} 
                            disabled={i === 0}
                            className="text-xs text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer disabled:opacity-30 p-0"
                          >
                            ▲
                          </button>
                          <span className="text-xs text-gray-500 text-center">{i + 1}</span>
                          <button 
                            onClick={() => moveOpenMicPerformer(i, 1)} 
                            disabled={i === openMicQueue.length - 1}
                            className="text-xs text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer disabled:opacity-30 p-0"
                          >
                            ▼
                          </button>
                        </div>
                      </td>
                      <td className="py-1 px-2">
                        <input 
                          type="text" 
                          value={performer.name} 
                          onChange={e => updateOpenMicPerformer(performer.id, 'name', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]" 
                        />
                      </td>
                      <td className="py-1 px-2">
                        <input 
                          type="text" 
                          value={performer.song} 
                          onChange={e => updateOpenMicPerformer(performer.id, 'song', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]" 
                          placeholder="Song title or performance type"
                        />
                      </td>
                      <td className="py-1 px-2">
                        <input 
                          type="text" 
                          value={performer.notes} 
                          onChange={e => updateOpenMicPerformer(performer.id, 'notes', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#c8a45e]" 
                          placeholder="Equipment needs, etc."
                        />
                      </td>
                      <td className="py-1 px-2">
                        <button
                          onClick={() => updateOpenMicPerformer(performer.id, 'done', !performer.done)}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            performer.done 
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {performer.done ? '✓ Done' : 'Waiting'}
                        </button>
                      </td>
                      <td className="py-1 px-2">
                        <button 
                          onClick={() => removeOpenMicPerformer(performer.id)}
                          className="text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer text-sm p-0"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}