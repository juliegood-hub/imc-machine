import { useMemo, useState } from 'react';
import { useVenue } from '../context/VenueContext';
import { useAuth } from '../context/AuthContext';
import { isArtistRole } from '../constants/clientTypes';
import StagePlotEditor from './StagePlotEditor';
import {
  SHOW_TYPE_OPTIONS,
  SHOW_TEMPLATE_OPTIONS,
  buildShowConfigurationDefaults,
} from '../constants/productionLibrary';

function numberOrNull(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toLineList(raw = '') {
  return String(raw || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function parseNamedRows(raw = '', fieldNames = []) {
  return toLineList(raw).map((line) => {
    const parts = line.split('|').map(part => part.trim());
    const row = {};
    fieldNames.forEach((name, idx) => {
      row[name] = parts[idx] || '';
    });
    return row;
  });
}

function stringifyNamedRows(rows = [], fieldNames = []) {
  return (rows || []).map((row) => (
    fieldNames.map(name => String(row?.[name] || '')).join(' | ')
  )).join('\n');
}

function parseEquipmentRows(raw = '') {
  return toLineList(raw).map((line) => {
    const [label = '', quantity = '1', provider = 'tbd', notes = ''] = line.split('|').map(part => part.trim());
    return {
      label,
      quantity: Number.isFinite(Number(quantity)) ? Number(quantity) : 1,
      provider: provider || 'tbd',
      notes: notes || '',
    };
  });
}

function stringifyEquipmentRows(rows = []) {
  return (rows || []).map(row => (
    [
      row.label || '',
      row.quantity ?? 1,
      row.provider || 'tbd',
      row.notes || '',
    ].join(' | ')
  )).join('\n');
}

function blankForm() {
  return {
    name: '',
    show_type: 'band',
    template_key: '',
    participant_profile_id: '',
    member_count: '',
    summary: '',
    plot_summary: '',
    input_list_text: '',
    patch_list_text: '',
    monitor_plan_text: '',
    equipment_text: '',
    backline_text: '',
    lighting_plan_text: '',
    video_plan_text: '',
    power_plan_text: '',
    stage_management_text: '',
    stage_plot_layout: { width: 24, depth: 16, items: [] },
  };
}

function answersForShowType(showType, memberCount) {
  const count = Number(memberCount) || 0;
  if (showType === 'theater') return { castSize: count || 8, wirelessCount: 8 };
  if (showType === 'speakers') return { speakerCount: count || 2, panelCount: count || 2 };
  if (showType === 'orchestra_choir') return { choirSize: count || 24, memberCount: count || 24 };
  if (showType === 'dj_electronic') return { memberCount: count || 1 };
  if (showType === 'hybrid') return { memberCount: count || 6, hybridBase: 'band' };
  return { memberCount: count || 4 };
}

export default function ShowConfigurationManager() {
  const {
    showConfigurations,
    participantProfiles,
    saveShowConfiguration,
    editShowConfiguration,
    removeShowConfiguration,
    saveStagePlotDocumentData,
  } = useVenue();
  const { user } = useAuth();

  const canEdit = user?.isAdmin || isArtistRole(user?.clientType || '');

  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState('');
  const [status, setStatus] = useState('');
  const [exporting, setExporting] = useState(false);

  const sortedConfigs = useMemo(() => (
    [...(showConfigurations || [])].sort((a, b) => (
      new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
    ))
  ), [showConfigurations]);

  const availableTemplates = SHOW_TEMPLATE_OPTIONS[form.show_type] || [];

  const resetForm = () => {
    setForm(blankForm());
    setEditingId('');
  };

  const loadConfig = (config) => {
    setEditingId(config.id);
    setForm({
      name: config.name || '',
      show_type: config.show_type || 'band',
      template_key: config.template_key || '',
      participant_profile_id: config.participant_profile_id || '',
      member_count: config.member_count || '',
      summary: config.summary || '',
      plot_summary: config.plot_summary || '',
      input_list_text: stringifyNamedRows(config.input_list || [], ['label', 'source', 'quantity', 'notes']),
      patch_list_text: stringifyNamedRows(config.patch_list || [], ['channel', 'source', 'destination', 'notes']),
      monitor_plan_text: stringifyNamedRows(config.monitor_plan || [], ['name', 'channels', 'type', 'notes']),
      equipment_text: stringifyEquipmentRows(config.equipment || []),
      backline_text: stringifyEquipmentRows(config.backline || []),
      lighting_plan_text: stringifyEquipmentRows(config.lighting_plan || []),
      video_plan_text: stringifyEquipmentRows(config.video_plan || []),
      power_plan_text: stringifyNamedRows(config.power_plan || [], ['label', 'location', 'voltage', 'provider', 'notes']),
      stage_management_text: stringifyEquipmentRows(config.stage_management || []),
      stage_plot_layout: config.stage_plot_layout || { width: 24, depth: 16, items: [] },
    });
  };

  const applyTemplateDefaults = () => {
    const defaults = buildShowConfigurationDefaults({
      showType: form.show_type,
      templateKey: form.template_key || '',
      answers: answersForShowType(form.show_type, form.member_count),
    });

    setForm(prev => ({
      ...prev,
      member_count: defaults.memberCount || prev.member_count,
      summary: defaults.summary || prev.summary,
      plot_summary: defaults.plotSummary || prev.plot_summary,
      input_list_text: stringifyNamedRows(defaults.inputList || [], ['label', 'source', 'quantity', 'notes']),
      patch_list_text: stringifyNamedRows(defaults.patchList || [], ['channel', 'source', 'destination', 'notes']),
      monitor_plan_text: stringifyNamedRows(defaults.monitorPlan || [], ['name', 'channels', 'type', 'notes']),
      equipment_text: stringifyEquipmentRows(defaults.equipment || []),
      backline_text: stringifyEquipmentRows(defaults.backline || []),
      lighting_plan_text: stringifyEquipmentRows(defaults.lightingPlan || []),
      video_plan_text: stringifyEquipmentRows(defaults.videoPlan || []),
      power_plan_text: stringifyNamedRows(defaults.powerPlan || [], ['label', 'location', 'voltage', 'provider', 'notes']),
      stage_management_text: stringifyEquipmentRows(defaults.stageManagement || []),
      stage_plot_layout: defaults.stagePlotLayout || prev.stage_plot_layout,
    }));
    setStatus('Template defaults applied. Edit any line items as needed.');
  };

  const buildPayload = () => ({
    name: String(form.name || '').trim(),
    show_type: form.show_type || 'band',
    template_key: form.template_key || '',
    participant_profile_id: form.participant_profile_id || null,
    member_count: numberOrNull(form.member_count),
    summary: form.summary || '',
    plot_summary: form.plot_summary || '',
    input_list: parseNamedRows(form.input_list_text, ['label', 'source', 'quantity', 'notes']),
    patch_list: parseNamedRows(form.patch_list_text, ['channel', 'source', 'destination', 'notes']),
    monitor_plan: parseNamedRows(form.monitor_plan_text, ['name', 'channels', 'type', 'notes']),
    equipment: parseEquipmentRows(form.equipment_text),
    backline: parseEquipmentRows(form.backline_text),
    lighting_plan: parseEquipmentRows(form.lighting_plan_text),
    video_plan: parseEquipmentRows(form.video_plan_text),
    power_plan: parseNamedRows(form.power_plan_text, ['label', 'location', 'voltage', 'provider', 'notes']),
    stage_management: parseEquipmentRows(form.stage_management_text),
    stage_plot_layout: form.stage_plot_layout || { width: 24, depth: 16, items: [] },
    updated_at: new Date().toISOString(),
  });

  const handleSave = async () => {
    if (!canEdit) return;
    const payload = buildPayload();
    if (!payload.name) {
      setStatus('Add a show configuration name and I can save it.');
      return;
    }
    try {
      if (editingId) {
        await editShowConfiguration(editingId, payload);
        setStatus(`Updated "${payload.name}".`);
      } else {
        const created = await saveShowConfiguration(payload);
        setEditingId(created?.id || '');
        setStatus(`Created "${payload.name}".`);
      }
    } catch (err) {
      setStatus(`I hit a snag saving that show config: ${err.message}`);
    }
  };

  const handleDelete = async (configId) => {
    if (!canEdit) return;
    try {
      await removeShowConfiguration(configId);
      if (editingId === configId) resetForm();
      setStatus('Show configuration deleted.');
    } catch (err) {
      setStatus(`I hit a snag deleting that show config: ${err.message}`);
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    setStatus('');
    const payload = buildPayload();
    try {
      const res = await fetch('/api/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export-stage-plot-pdf',
          showConfiguration: {
            id: editingId || null,
            ...payload,
          },
          options: {
            includeShareToken: true,
          },
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Export failed');

      const stageDoc = await saveStagePlotDocumentData({
        id: data.documentId || null,
        show_configuration_id: editingId || null,
        title: `${payload.name || 'Stage Plot'} - Production Packet`,
        content: {
          showConfiguration: payload,
          exportedAt: data.generatedAt,
        },
        pdf_base64: data.pdfBase64 || null,
        pdf_filename: data.fileName || null,
        share_token: data.shareToken || null,
      });

      if (data.downloadUrl) {
        const anchor = document.createElement('a');
        anchor.href = data.downloadUrl;
        anchor.download = data.fileName || 'stage-plot.pdf';
        anchor.click();
      }

      setStatus(`Perfect. PDF exported${stageDoc?.id ? ' and attached to stage documents' : ''}.`);
    } catch (err) {
      setStatus(`I hit a snag exporting that PDF: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="text-lg mb-1">Stage Plot & Tech</h3>
        <p className="text-sm text-gray-500 m-0">
          Build reusable show configurations with touring-grade input/patch/monitor/power requirements.
        </p>
      </div>

      {!canEdit && (
        <div className="card bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-800 m-0">
            Read-only: artist managers, booking agents, or admins can edit show configurations.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-4">
        <div className="card">
          <h4 className="text-base mb-3">Saved Configurations ({sortedConfigs.length})</h4>
          <div className="space-y-2 max-h-[680px] overflow-auto pr-1">
            {sortedConfigs.length === 0 && (
              <p className="text-sm text-gray-500">No show configurations yet. Save one and I will keep it ready for reuse.</p>
            )}
            {sortedConfigs.map(config => (
              <div key={config.id} className="border border-gray-200 rounded-lg p-3">
                <p className="text-sm font-semibold m-0">{config.name || 'Untitled Config'}</p>
                <p className="text-xs text-gray-500 m-0 mt-1">
                  {config.show_type || 'show'}{config.template_key ? ` · ${config.template_key}` : ''}
                  {config.member_count ? ` · ${config.member_count} ppl` : ''}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <button type="button" onClick={() => loadConfig(config)} className="text-xs px-2 py-1 border border-gray-300 rounded bg-white">
                    Edit
                  </button>
                  {canEdit && (
                    <button type="button" onClick={() => handleDelete(config.id)} className="text-xs px-2 py-1 border border-red-300 text-red-700 rounded bg-white">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Configuration Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="4-Piece Rock Setup"
                  disabled={!canEdit}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Attach to Act (optional)</label>
                <select
                  value={form.participant_profile_id}
                  onChange={e => setForm(prev => ({ ...prev, participant_profile_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                  disabled={!canEdit}
                >
                  <option value="">No specific act</option>
                  {(participantProfiles || []).map(profile => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}{profile.role ? ` · ${profile.role}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Show Type</label>
                <select
                  value={form.show_type}
                  onChange={e => setForm(prev => ({ ...prev, show_type: e.target.value, template_key: '' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                  disabled={!canEdit}
                >
                  {SHOW_TYPE_OPTIONS.map(type => (
                    <option key={type.key} value={type.key}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Template</label>
                <select
                  value={form.template_key}
                  onChange={e => setForm(prev => ({ ...prev, template_key: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                  disabled={!canEdit}
                >
                  <option value="">Select template...</option>
                  {availableTemplates.map(template => (
                    <option key={template.key} value={template.key}>{template.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Member/Cast Count</label>
                <input
                  type="number"
                  min="0"
                  value={form.member_count}
                  onChange={e => setForm(prev => ({ ...prev, member_count: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  disabled={!canEdit}
                />
              </div>
              <div className="flex items-end">
                <button type="button" onClick={applyTemplateDefaults} className="btn-secondary text-sm w-full" disabled={!canEdit}>
                  Apply Template Defaults
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Summary</label>
                <textarea
                  value={form.summary}
                  onChange={e => setForm(prev => ({ ...prev, summary: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-y"
                  placeholder="High-level show requirements"
                  disabled={!canEdit}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Plot Summary (text fallback)</label>
                <textarea
                  value={form.plot_summary}
                  onChange={e => setForm(prev => ({ ...prev, plot_summary: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-y"
                  placeholder="Concise fallback for venues not using drag/drop plots"
                  disabled={!canEdit}
                />
              </div>
            </div>
          </div>

          <StagePlotEditor
            layout={form.stage_plot_layout}
            onChange={(next) => setForm(prev => ({ ...prev, stage_plot_layout: next }))}
            editable={canEdit}
            title="Stage Plot Layout"
          />

          <div className="card space-y-3">
            <h4 className="text-base mb-0">Technical Lists</h4>
            <p className="text-xs text-gray-500 m-0">
              Use one item per line. Pipes are optional separators in this format:
              `label | qty/provider/etc | notes`.
            </p>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Input List (`label | source | qty | notes`)</label>
                <textarea value={form.input_list_text} onChange={e => setForm(prev => ({ ...prev, input_list_text: e.target.value }))} rows={6} className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono resize-y" disabled={!canEdit} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Patch List (`channel | source | destination | notes`)</label>
                <textarea value={form.patch_list_text} onChange={e => setForm(prev => ({ ...prev, patch_list_text: e.target.value }))} rows={6} className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono resize-y" disabled={!canEdit} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Monitor Plan (`name | channels | type | notes`)</label>
                <textarea value={form.monitor_plan_text} onChange={e => setForm(prev => ({ ...prev, monitor_plan_text: e.target.value }))} rows={5} className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono resize-y" disabled={!canEdit} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Power Plan (`label | location | voltage | provider | notes`)</label>
                <textarea value={form.power_plan_text} onChange={e => setForm(prev => ({ ...prev, power_plan_text: e.target.value }))} rows={5} className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono resize-y" disabled={!canEdit} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Equipment (`label | qty | provider | notes`)</label>
                <textarea value={form.equipment_text} onChange={e => setForm(prev => ({ ...prev, equipment_text: e.target.value }))} rows={5} className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono resize-y" disabled={!canEdit} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Backline (`label | qty | provider | notes`)</label>
                <textarea value={form.backline_text} onChange={e => setForm(prev => ({ ...prev, backline_text: e.target.value }))} rows={5} className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono resize-y" disabled={!canEdit} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Lighting (`label | qty | provider | notes`)</label>
                <textarea value={form.lighting_plan_text} onChange={e => setForm(prev => ({ ...prev, lighting_plan_text: e.target.value }))} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono resize-y" disabled={!canEdit} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Video (`label | qty | provider | notes`)</label>
                <textarea value={form.video_plan_text} onChange={e => setForm(prev => ({ ...prev, video_plan_text: e.target.value }))} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono resize-y" disabled={!canEdit} />
              </div>
              <div className="xl:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Stage Management (`label | qty | provider | notes`)</label>
                <textarea value={form.stage_management_text} onChange={e => setForm(prev => ({ ...prev, stage_management_text: e.target.value }))} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono resize-y" disabled={!canEdit} />
              </div>
            </div>
          </div>

          {status && <p className="text-sm text-gray-600 m-0">{status}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleSave} className="btn-primary text-sm" disabled={!canEdit}>
              {editingId ? 'Update Configuration' : 'Save Configuration'}
            </button>
            <button type="button" onClick={handleExportPdf} className="btn-secondary text-sm" disabled={exporting}>
              {exporting ? 'Exporting PDF...' : 'Export PDF Packet'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="btn-outline text-sm" disabled={!canEdit}>
                New Configuration
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
