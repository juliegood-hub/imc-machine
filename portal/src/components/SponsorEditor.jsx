import { useState } from 'react';

const EMPTY_SPONSOR = {
  name: '', logo_url: '', tagline: '', contact_name: '', 
  contact_email: '', contact_phone: '', website: '', tier: 'supporter'
};

const TIERS = [
  { key: 'presenting', label: '⭐ Presenting Sponsor' },
  { key: 'title', label: '🏆 Title Sponsor' },
  { key: 'gold', label: '🥇 Gold Sponsor' },
  { key: 'silver', label: '🥈 Silver Sponsor' },
  { key: 'supporter', label: '🤝 Supporter' },
  { key: 'media', label: '📰 Media Partner' },
  { key: 'in_kind', label: '🎁 In-Kind Sponsor' },
];

export default function SponsorEditor({ sponsors = [], onChange }) {
  const [expanded, setExpanded] = useState(null);

  const addSponsor = () => {
    const updated = [...sponsors, { ...EMPTY_SPONSOR }];
    onChange(updated);
    setExpanded(updated.length - 1);
  };

  const updateSponsor = (index, field, value) => {
    const updated = sponsors.map((s, i) => i === index ? { ...s, [field]: value } : s);
    onChange(updated);
  };

  const removeSponsor = (index) => {
    onChange(sponsors.filter((_, i) => i !== index));
    setExpanded(null);
  };

  const tierInfo = (tier) => TIERS.find(t => t.key === tier) || TIERS[4];

  return (
    <div className="space-y-3">
      {sponsors.map((sponsor, i) => (
        <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setExpanded(expanded === i ? null : i)}
            className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 border-none cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              {sponsor.logo_url ? (
                <img src={sponsor.logo_url} alt="" className="w-8 h-8 rounded object-contain border border-gray-200 bg-white" />
              ) : (
                <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center text-gray-400 text-xs">🏢</div>
              )}
              <div>
                <span className="text-sm font-semibold text-gray-800">{sponsor.name || 'New sponsor draft'}</span>
                <span className="text-xs text-gray-500 ml-2">{tierInfo(sponsor.tier).label}</span>
              </div>
            </div>
            <span className="text-gray-400 text-sm">{expanded === i ? '▲' : '▼'}</span>
          </button>

          {expanded === i && (
            <div className="p-4 space-y-3 border-t border-gray-100">
              <p className="text-xs text-gray-400">* Fill the required fields and I can carry this through every channel.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Sponsor Name <span className="text-red-500">*</span></label>
                  <input type="text" value={sponsor.name} onChange={e => updateSponsor(i, 'name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="SA Arts Commission" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Sponsorship Tier</label>
                  <select value={sponsor.tier} onChange={e => updateSponsor(i, 'tier', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                    {TIERS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Logo URL (high-res)</label>
                  <div className="flex gap-2 items-start">
                    {sponsor.logo_url && <img src={sponsor.logo_url} alt="" className="w-16 h-10 rounded object-contain border border-gray-200 bg-white" />}
                    <input type="url" value={sponsor.logo_url} onChange={e => updateSponsor(i, 'logo_url', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="https://..." />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tagline / Required Attribution Line</label>
                  <input type="text" value={sponsor.tagline} onChange={e => updateSponsor(i, 'tagline', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Proudly supported by..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Website</label>
                  <input type="url" value={sponsor.website} onChange={e => updateSponsor(i, 'website', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contact Name</label>
                  <input type="text" value={sponsor.contact_name} onChange={e => updateSponsor(i, 'contact_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contact Email</label>
                  <input type="email" value={sponsor.contact_email} onChange={e => updateSponsor(i, 'contact_email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contact Phone</label>
                  <input type="tel" value={sponsor.contact_phone} onChange={e => updateSponsor(i, 'contact_phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button type="button" onClick={() => removeSponsor(i)}
                  className="text-xs text-red-500 hover:text-red-700 bg-transparent border-none cursor-pointer">
                  🗑️ Remove sponsor
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addSponsor}
        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-[#c8a45e] hover:text-[#c8a45e] bg-transparent cursor-pointer transition-colors"
      >
        + Add Another Sponsor
      </button>
    </div>
  );
}
