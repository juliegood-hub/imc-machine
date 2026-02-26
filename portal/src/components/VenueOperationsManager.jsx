import { useEffect, useMemo, useState } from 'react';
import { useVenue } from '../context/VenueContext';
import { DEFAULT_SUPPLIER_SUGGESTIONS, SUPPLIER_TYPE_OPTIONS } from '../services/supplier-po';

const CONNECTION_STATUS_OPTIONS = ['connected', 'error', 'not_connected'];
const INVENTORY_STATUS_OPTIONS = ['active', 'maintenance_due', 'out_of_service', 'retired'];
const MAINTENANCE_STATUS_OPTIONS = ['scheduled', 'in_progress', 'completed', 'cancelled'];
const SUPPLIER_FILTER_OPTIONS = ['all', ...SUPPLIER_TYPE_OPTIONS.map((option) => option.value)];

function toDateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return local.toISOString().slice(0, 16);
}

function toIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toJulieVenueOpsStatus(message) {
  const raw = String(message || '').trim();
  if (!raw) return '';
  if (/failed|could not/i.test(raw)) return `I hit a snag: ${raw}`;
  if (/is required|require/i.test(raw)) return `One more detail and we are set: ${raw}`;
  if (/select |choose /i.test(raw)) return raw.replace(/^select /i, 'Choose ');
  return raw;
}

function isMissingSchemaEntityError(error) {
  const message = String(error?.message || error || '');
  return /could not find the table .* in the schema cache/i.test(message)
    || /relation .+ does not exist/i.test(message)
    || /column .+ does not exist/i.test(message);
}

function blankInventoryItem() {
  return {
    itemName: '',
    category: '',
    quantity: 1,
    unit: 'ea',
    location: '',
    status: 'active',
    nextServiceDueAt: '',
    preferredSupplierId: '',
    supplierSku: '',
    supplierItemUrl: '',
  };
}

function blankSupplierDraft() {
  return {
    supplierName: '',
    supplierType: 'local_store',
    googlePlaceId: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
    phone: '',
    email: '',
    websiteUrl: '',
    orderingUrl: '',
    accountNumber: '',
    notes: '',
    isActive: true,
  };
}

function blankSupplierContact() {
  return {
    venueSupplierId: '',
    name: '',
    title: '',
    phone: '',
    email: '',
    notes: '',
    isPrimary: false,
  };
}

function blankInventorySupplierLink() {
  return {
    inventoryItemId: '',
    supplierId: '',
    supplierSku: '',
    supplierItemUrl: '',
    preferred: false,
    lastPricePaid: '',
    notes: '',
  };
}

function blankMaintenanceContact() {
  return {
    name: '',
    role: '',
    company: '',
    phone: '',
    email: '',
    isPrimary: false,
  };
}

function blankMaintenanceTask() {
  return {
    title: '',
    description: '',
    status: 'scheduled',
    priority: 'normal',
    scheduledFor: '',
    assignedContactId: '',
    inventoryItemId: '',
  };
}

export default function VenueOperationsManager() {
  const {
    venue,
    venueProfiles,
    saveVenueProfile,
    getTicketingProviders,
    listVenueTicketingConnections,
    saveVenueTicketingConnection,
    removeVenueTicketingConnection,
    listVenueInventory,
    saveVenueInventoryItem,
    searchSupplierSuggestions,
    getSupplierPlaceDetails,
    listVenueSuppliers,
    saveVenueSupplier,
    removeVenueSupplier,
    listSupplierContacts,
    saveSupplierContact,
    removeSupplierContact,
    listInventorySupplierLinks,
    saveInventorySupplierLink,
    removeInventorySupplierLink,
    listVenueMaintenance,
    saveVenueMaintenanceContact,
    saveVenueMaintenanceTask,
  } = useVenue();

  const [selectedVenueProfileId, setSelectedVenueProfileId] = useState('');
  const [providers, setProviders] = useState([]);
  const [connections, setConnections] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierContacts, setSupplierContacts] = useState([]);
  const [inventorySupplierLinks, setInventorySupplierLinks] = useState([]);
  const [maintenanceContacts, setMaintenanceContacts] = useState([]);
  const [maintenanceTasks, setMaintenanceTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  const [supplierSuggestingIndex, setSupplierSuggestingIndex] = useState(null);

  const [connectionForm, setConnectionForm] = useState({
    providerId: '',
    accountId: '',
    apiKey: '',
    connectionStatus: 'connected',
    isDefault: false,
    manualMode: false,
  });

  const [inventoryDrafts, setInventoryDrafts] = useState([blankInventoryItem()]);
  const [supplierDrafts, setSupplierDrafts] = useState([blankSupplierDraft()]);
  const [supplierContactDrafts, setSupplierContactDrafts] = useState([blankSupplierContact()]);
  const [inventorySupplierLinkDrafts, setInventorySupplierLinkDrafts] = useState([blankInventorySupplierLink()]);
  const [contactDrafts, setContactDrafts] = useState([blankMaintenanceContact()]);
  const [taskDrafts, setTaskDrafts] = useState([blankMaintenanceTask()]);

  useEffect(() => {
    if (!selectedVenueProfileId && venueProfiles?.length) {
      setSelectedVenueProfileId(venueProfiles[0].id);
    }
  }, [selectedVenueProfileId, venueProfiles]);

  const providerById = useMemo(() => {
    const map = new Map();
    (providers || []).forEach((provider) => map.set(provider.id, provider));
    return map;
  }, [providers]);

  const selectedConnectionProvider = providerById.get(connectionForm.providerId);

  const supplierById = useMemo(() => {
    const map = new Map();
    (suppliers || []).forEach((supplier) => map.set(supplier.id, supplier));
    return map;
  }, [suppliers]);

  const supplierLinksByInventory = useMemo(() => {
    const map = new Map();
    (inventorySupplierLinks || []).forEach((link) => {
      const list = map.get(link.inventory_item_id) || [];
      list.push(link);
      map.set(link.inventory_item_id, list);
    });
    return map;
  }, [inventorySupplierLinks]);

  const filteredSuppliers = useMemo(() => (
    supplierFilter === 'all'
      ? suppliers
      : suppliers.filter((supplier) => supplier.supplier_type === supplierFilter)
  ), [supplierFilter, suppliers]);

  const loadData = async (venueProfileId) => {
    if (!venueProfileId) return;
    setLoading(true);
    setStatus('');
    try {
      const loadIssues = [];
      const safeLoad = async (label, task, fallback) => {
        try {
          return await task();
        } catch (err) {
          loadIssues.push({ label, err });
          return fallback;
        }
      };

      const [providerList, connected, inv, supplierRows, supplierContactRows, supplierLinks, maintenance] = await Promise.all([
        safeLoad('ticketing providers', () => getTicketingProviders(), []),
        safeLoad('ticketing connections', () => listVenueTicketingConnections(venueProfileId), []),
        safeLoad('inventory', () => listVenueInventory(venueProfileId), []),
        safeLoad('suppliers', () => listVenueSuppliers(venueProfileId), []),
        safeLoad('supplier contacts', () => listSupplierContacts({ venueProfileId }), []),
        safeLoad('inventory supplier links', () => listInventorySupplierLinks({ venueProfileId }), []),
        safeLoad('maintenance', () => listVenueMaintenance(venueProfileId), { contacts: [], tasks: [] }),
      ]);
      setProviders(providerList || []);
      setConnections(connected || []);
      setInventory(inv || []);
      setSuppliers(supplierRows || []);
      setSupplierContacts(supplierContactRows || []);
      setInventorySupplierLinks(supplierLinks || []);
      setMaintenanceContacts(maintenance.contacts || []);
      setMaintenanceTasks(maintenance.tasks || []);
      if (!connectionForm.providerId && providerList?.length) {
        setConnectionForm(prev => ({ ...prev, providerId: providerList[0].id }));
      }
      if (loadIssues.length) {
        const missingOnly = loadIssues.every((issue) => isMissingSchemaEntityError(issue.err));
        if (missingOnly) {
          setStatus('Some venue operations modules are not active yet because database tables are missing. Run the latest Supabase schema and refresh.');
        } else {
          setStatus(`Loaded what I could, but ${loadIssues.length} module${loadIssues.length === 1 ? '' : 's'} need attention.`);
        }
      }
    } catch (err) {
      setStatus(`Failed to load operations data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedVenueProfileId) {
      loadData(selectedVenueProfileId);
    }
  }, [selectedVenueProfileId]);

  const ensureVenueProfile = async () => {
    if (selectedVenueProfileId) return selectedVenueProfileId;
    const created = await saveVenueProfile({
      name: venue.businessName || venue.name || 'My Venue',
      street_number: venue.streetNumber || '',
      street_name: venue.streetName || '',
      suite: venue.suiteNumber || '',
      city: venue.city || 'San Antonio',
      state: venue.state || 'TX',
      postal_code: venue.zipCode || venue.zip || '',
      phone: venue.workPhone || venue.phone || '',
      website: venue.website || '',
    });
    setSelectedVenueProfileId(created.id);
    return created.id;
  };

  const handleSaveConnection = async () => {
    try {
      const venueProfileId = await ensureVenueProfile();
      if (!connectionForm.providerId) {
        setStatus('Select a ticketing provider first.');
        return;
      }
      setStatus('Saving ticketing connection...');
      await saveVenueTicketingConnection(venueProfileId, {
        ticketingProviderId: connectionForm.providerId,
        accountId: connectionForm.accountId,
        apiKey: connectionForm.apiKey,
        connectionStatus: connectionForm.connectionStatus,
        isDefault: connectionForm.isDefault,
        manualMode: connectionForm.manualMode,
      });
      await loadData(venueProfileId);
      setConnectionForm(prev => ({
        ...prev,
        accountId: '',
        apiKey: '',
        isDefault: false,
      }));
      setStatus('Ticketing connection saved.');
    } catch (err) {
      setStatus(`Ticketing save failed: ${err.message}`);
    }
  };

  const handleRemoveConnection = async (connectionId) => {
    if (!connectionId) return;
    try {
      setStatus('Removing connection...');
      await removeVenueTicketingConnection(connectionId);
      await loadData(selectedVenueProfileId);
      setStatus('Connection removed.');
    } catch (err) {
      setStatus(`Could not remove connection: ${err.message}`);
    }
  };

  const handleSaveInventoryDraft = async (index) => {
    const draft = inventoryDrafts[index];
    if (!draft?.itemName?.trim()) {
      setStatus('Inventory item name is required.');
      return;
    }
    try {
      const venueProfileId = await ensureVenueProfile();
      setStatus('Saving inventory item...');
      const savedItem = await saveVenueInventoryItem(venueProfileId, {
        itemName: draft.itemName,
        category: draft.category,
        quantity: draft.quantity,
        unit: draft.unit,
        location: draft.location,
        status: draft.status,
        nextServiceDueAt: toIsoOrNull(draft.nextServiceDueAt),
      });
      if (savedItem?.id && draft.preferredSupplierId) {
        await saveInventorySupplierLink({
          inventoryItemId: savedItem.id,
          supplierId: draft.preferredSupplierId,
          supplierSku: draft.supplierSku || '',
          supplierItemUrl: draft.supplierItemUrl || '',
          preferred: true,
        });
      }
      await loadData(venueProfileId);
      setInventoryDrafts(prev => prev.map((row, i) => (i === index ? blankInventoryItem() : row)));
      setStatus('Inventory item saved.');
    } catch (err) {
      setStatus(`Inventory save failed: ${err.message}`);
    }
  };

  const handleSupplierNameInput = async (index, value) => {
    setSupplierDrafts(prev => prev.map((row, i) => (i === index ? { ...row, supplierName: value } : row)));
    if (!value || value.trim().length < 2) {
      setSupplierSuggestions([]);
      setSupplierSuggestingIndex(null);
      return;
    }
    try {
      setSupplierSuggestingIndex(index);
      const results = await searchSupplierSuggestions(value, { venueProfileId: selectedVenueProfileId });
      setSupplierSuggestions(results || []);
    } catch (err) {
      setStatus(`Supplier search failed: ${err.message}`);
    }
  };

  const applySupplierSuggestion = async (index, suggestion) => {
    if (!suggestion) return;
    try {
      let details = null;
      if (suggestion.placeId) {
        details = await getSupplierPlaceDetails(suggestion.placeId);
      }
      const merged = {
        ...blankSupplierDraft(),
        ...(details || {}),
        supplierName: details?.supplierName || suggestion.mainText || suggestion.label || '',
        googlePlaceId: details?.googlePlaceId || suggestion.placeId || '',
        supplierType: details?.supplierType || suggestion.supplierType || 'local_store',
      };
      setSupplierDrafts(prev => prev.map((row, i) => (i === index ? { ...row, ...merged } : row)));
      setSupplierSuggestions([]);
      setSupplierSuggestingIndex(null);
    } catch (err) {
      setStatus(`Could not load supplier details: ${err.message}`);
    }
  };

  const handleSaveSupplierDraft = async (index) => {
    const draft = supplierDrafts[index];
    if (!draft?.supplierName?.trim()) {
      setStatus('Supplier name is required.');
      return;
    }
    if (draft.supplierType === 'online_store' && !(draft.websiteUrl || draft.orderingUrl)) {
      setStatus('Online suppliers require website URL or ordering URL.');
      return;
    }
    try {
      const venueProfileId = await ensureVenueProfile();
      setStatus('Saving supplier...');
      await saveVenueSupplier(venueProfileId, draft);
      await loadData(venueProfileId);
      setSupplierDrafts(prev => prev.map((row, i) => (i === index ? blankSupplierDraft() : row)));
      setStatus('Supplier saved.');
    } catch (err) {
      setStatus(`Supplier save failed: ${err.message}`);
    }
  };

  const handleRemoveSupplier = async (supplierId) => {
    if (!supplierId) return;
    try {
      setStatus('Removing supplier...');
      await removeVenueSupplier(supplierId);
      await loadData(selectedVenueProfileId);
      setStatus('Supplier removed.');
    } catch (err) {
      setStatus(`Supplier remove failed: ${err.message}`);
    }
  };

  const handleAddSuggestedSupplier = async (suggestion) => {
    try {
      const venueProfileId = await ensureVenueProfile();
      setStatus('Adding suggested supplier...');
      await saveVenueSupplier(venueProfileId, {
        supplierName: suggestion.name,
        supplierType: suggestion.supplierType,
        websiteUrl: suggestion.websiteUrl,
        orderingUrl: suggestion.orderingUrl,
        notes: suggestion.notes || '',
      });
      await loadData(venueProfileId);
      setStatus('Suggested supplier added.');
    } catch (err) {
      setStatus(`Could not add suggested supplier: ${err.message}`);
    }
  };

  const handleSaveSupplierContactDraft = async (index) => {
    const draft = supplierContactDrafts[index];
    if (!draft?.venueSupplierId) {
      setStatus('Choose a supplier for the contact.');
      return;
    }
    if (!draft?.name?.trim()) {
      setStatus('Supplier contact name is required.');
      return;
    }
    try {
      setStatus('Saving supplier contact...');
      await saveSupplierContact(draft.venueSupplierId, draft);
      await loadData(selectedVenueProfileId);
      setSupplierContactDrafts(prev => prev.map((row, i) => (i === index ? blankSupplierContact() : row)));
      setStatus('Supplier contact saved.');
    } catch (err) {
      setStatus(`Supplier contact save failed: ${err.message}`);
    }
  };

  const handleRemoveSupplierContact = async (contactId) => {
    if (!contactId) return;
    try {
      setStatus('Removing supplier contact...');
      await removeSupplierContact(contactId);
      await loadData(selectedVenueProfileId);
      setStatus('Supplier contact removed.');
    } catch (err) {
      setStatus(`Could not remove supplier contact: ${err.message}`);
    }
  };

  const handleSaveInventorySupplierLinkDraft = async (index) => {
    const draft = inventorySupplierLinkDrafts[index];
    if (!draft.inventoryItemId || !draft.supplierId) {
      setStatus('Choose both inventory item and supplier.');
      return;
    }
    try {
      setStatus('Saving inventory supplier link...');
      await saveInventorySupplierLink(draft);
      await loadData(selectedVenueProfileId);
      setInventorySupplierLinkDrafts(prev => prev.map((row, i) => (i === index ? blankInventorySupplierLink() : row)));
      setStatus('Inventory supplier link saved.');
    } catch (err) {
      setStatus(`Could not save supplier link: ${err.message}`);
    }
  };

  const handleRemoveInventorySupplierLink = async (linkId) => {
    if (!linkId) return;
    try {
      setStatus('Removing inventory supplier link...');
      await removeInventorySupplierLink(linkId);
      await loadData(selectedVenueProfileId);
      setStatus('Supplier link removed.');
    } catch (err) {
      setStatus(`Could not remove supplier link: ${err.message}`);
    }
  };

  const handleCopyText = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setStatus('Copied to clipboard.');
    } catch {
      setStatus('Clipboard access not available in this browser.');
    }
  };

  const handleSaveContactDraft = async (index) => {
    const draft = contactDrafts[index];
    if (!draft?.name?.trim()) {
      setStatus('Maintenance contact name is required.');
      return;
    }
    try {
      const venueProfileId = await ensureVenueProfile();
      setStatus('Saving maintenance contact...');
      await saveVenueMaintenanceContact(venueProfileId, draft);
      await loadData(venueProfileId);
      setContactDrafts(prev => prev.map((row, i) => (i === index ? blankMaintenanceContact() : row)));
      setStatus('Maintenance contact saved.');
    } catch (err) {
      setStatus(`Contact save failed: ${err.message}`);
    }
  };

  const handleSaveTaskDraft = async (index) => {
    const draft = taskDrafts[index];
    if (!draft?.title?.trim()) {
      setStatus('Maintenance task title is required.');
      return;
    }
    try {
      const venueProfileId = await ensureVenueProfile();
      setStatus('Saving maintenance task...');
      await saveVenueMaintenanceTask(venueProfileId, {
        ...draft,
        scheduledFor: toIsoOrNull(draft.scheduledFor),
      });
      await loadData(venueProfileId);
      setTaskDrafts(prev => prev.map((row, i) => (i === index ? blankMaintenanceTask() : row)));
      setStatus('Maintenance task saved.');
    } catch (err) {
      setStatus(`Task save failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-5">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg m-0">Operations Control</h3>
            <p className="text-xs text-gray-500 m-0 mt-1">Ticketing connectors, inventory, and maintenance scheduling all tied to a venue profile.</p>
          </div>
          <div className="min-w-[260px]">
            <label className="block text-xs text-gray-500 mb-1">Venue Profile</label>
            <select
              value={selectedVenueProfileId}
              onChange={(e) => setSelectedVenueProfileId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm bg-white"
            >
              <option value="">Select venue profile</option>
              {(venueProfiles || []).map(profile => (
                <option key={profile.id} value={profile.id}>{profile.name}</option>
              ))}
            </select>
          </div>
        </div>
        {status && <p className="text-xs text-gray-600 mt-3 mb-0">{toJulieVenueOpsStatus(status)}</p>}
        {loading && <p className="text-xs text-gray-500 mt-2 mb-0">Refreshing...</p>}
      </div>

      <div className="card">
        <h3 className="text-lg m-0 mb-2">Ticketing Connectors</h3>
        <p className="text-xs text-gray-500 mb-3">Connect Eventbrite and Ticketmaster at the venue level and choose a default provider.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
          <select
            value={connectionForm.providerId}
            onChange={(e) => setConnectionForm(prev => ({ ...prev, providerId: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm bg-white"
          >
            <option value="">Provider</option>
            {providers.map(provider => (
              <option key={provider.id} value={provider.id}>{provider.name}</option>
            ))}
          </select>
          <input
            type="text"
            value={connectionForm.accountId}
            onChange={(e) => setConnectionForm(prev => ({ ...prev, accountId: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder={selectedConnectionProvider?.type === 'eventbrite' ? 'Eventbrite venue/account ID (optional)' : 'Provider account ID'}
          />
          <input
            type="text"
            value={connectionForm.apiKey}
            onChange={(e) => setConnectionForm(prev => ({ ...prev, apiKey: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm"
            placeholder={selectedConnectionProvider?.type === 'ticketmaster' ? 'OAuth token placeholder (future)' : 'API key / token (optional)'}
          />
          <select
            value={connectionForm.connectionStatus}
            onChange={(e) => setConnectionForm(prev => ({ ...prev, connectionStatus: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded text-sm bg-white"
          >
            {CONNECTION_STATUS_OPTIONS.map(statusValue => (
              <option key={statusValue} value={statusValue}>{statusValue}</option>
            ))}
          </select>
          <label className="text-xs flex items-center gap-2 px-3 py-2 border border-gray-200 rounded">
            <input type="checkbox" checked={connectionForm.isDefault} onChange={(e) => setConnectionForm(prev => ({ ...prev, isDefault: e.target.checked }))} />
            Default provider
          </label>
          <label className="text-xs flex items-center gap-2 px-3 py-2 border border-gray-200 rounded">
            <input type="checkbox" checked={connectionForm.manualMode} onChange={(e) => setConnectionForm(prev => ({ ...prev, manualMode: e.target.checked }))} />
            Manual mode
          </label>
        </div>
        <button type="button" className="btn-primary text-sm mb-3" onClick={handleSaveConnection}>Save Connection</button>
        {connections.length === 0 ? (
          <p className="text-xs text-gray-500 m-0">No ticketing connectors saved for this venue.</p>
        ) : (
          <div className="space-y-2">
            {connections.map(connection => (
              <div key={connection.id} className="border border-gray-200 rounded p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 font-medium">
                    {connection.ticketing_provider?.name || 'Provider'}
                    {connection.is_default ? <span className="text-xs text-[#c8a45e]"> · Default</span> : null}
                  </p>
                  <button type="button" className="text-xs px-2 py-1 border border-red-300 text-red-700 rounded bg-white" onClick={() => handleRemoveConnection(connection.id)}>
                    Remove
                  </button>
                </div>
                <p className="m-0 text-xs text-gray-500 mt-1">
                  Status: {connection.connection_status || 'not_connected'}
                  {connection.account_id ? ` · Account: ${connection.account_id}` : ''}
                  {connection.last_synced_at ? ` · Synced: ${new Date(connection.last_synced_at).toLocaleString()}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-lg m-0">Preferred Suppliers</h3>
          <div className="flex items-center gap-2">
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="px-2 py-1 border border-gray-200 rounded text-xs bg-white"
            >
              {SUPPLIER_FILTER_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value === 'all' ? 'All Types' : value}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => setSupplierDrafts(prev => [...prev, blankSupplierDraft()])}
            >
              + Add Supplier
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-3">Use Google business autocomplete for quick venue vendor setup. Online-only suppliers can skip address fields.</p>

        <div className="space-y-2 mb-3">
          {supplierDrafts.map((draft, index) => (
            <div key={`supplier-draft-${index}`} className="border border-gray-200 rounded p-2 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <div className="relative md:col-span-2">
                  <input
                    type="text"
                    value={draft.supplierName}
                    onChange={(e) => handleSupplierNameInput(index, e.target.value)}
                    className="px-2 py-1.5 border border-gray-200 rounded text-xs w-full"
                    placeholder="Supplier name (Google autocomplete)"
                  />
                  {supplierSuggestingIndex === index && supplierSuggestions.length > 0 ? (
                    <div className="absolute z-20 mt-1 w-full border border-gray-200 rounded bg-white shadow-sm max-h-44 overflow-auto">
                      {supplierSuggestions.map((suggestion) => (
                        <button
                          key={`${suggestion.placeId || suggestion.id}-${suggestion.label}`}
                          type="button"
                          className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                          onClick={() => applySupplierSuggestion(index, suggestion)}
                        >
                          <div className="font-medium text-gray-800">{suggestion.mainText || suggestion.label}</div>
                          <div className="text-gray-500">{suggestion.secondaryText || suggestion.label}</div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <select
                  value={draft.supplierType}
                  onChange={(e) => setSupplierDrafts(prev => prev.map((row, i) => (i === index ? { ...row, supplierType: e.target.value } : row)))}
                  className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white"
                >
                  {SUPPLIER_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={draft.phone}
                  onChange={(e) => setSupplierDrafts(prev => prev.map((row, i) => (i === index ? { ...row, phone: e.target.value } : row)))}
                  className="px-2 py-1.5 border border-gray-200 rounded text-xs"
                  placeholder="Phone"
                />
                <input
                  type="text"
                  value={draft.addressLine1}
                  onChange={(e) => setSupplierDrafts(prev => prev.map((row, i) => (i === index ? { ...row, addressLine1: e.target.value } : row)))}
                  className="px-2 py-1.5 border border-gray-200 rounded text-xs md:col-span-2"
                  placeholder="Address line 1"
                />
                <input
                  type="text"
                  value={draft.city}
                  onChange={(e) => setSupplierDrafts(prev => prev.map((row, i) => (i === index ? { ...row, city: e.target.value } : row)))}
                  className="px-2 py-1.5 border border-gray-200 rounded text-xs"
                  placeholder="City"
                />
                <input
                  type="text"
                  value={draft.state}
                  onChange={(e) => setSupplierDrafts(prev => prev.map((row, i) => (i === index ? { ...row, state: e.target.value } : row)))}
                  className="px-2 py-1.5 border border-gray-200 rounded text-xs"
                  placeholder="State"
                />
                <input
                  type="url"
                  value={draft.websiteUrl}
                  onChange={(e) => setSupplierDrafts(prev => prev.map((row, i) => (i === index ? { ...row, websiteUrl: e.target.value } : row)))}
                  className="px-2 py-1.5 border border-gray-200 rounded text-xs md:col-span-2"
                  placeholder="Website URL"
                />
                <input
                  type="url"
                  value={draft.orderingUrl}
                  onChange={(e) => setSupplierDrafts(prev => prev.map((row, i) => (i === index ? { ...row, orderingUrl: e.target.value } : row)))}
                  className="px-2 py-1.5 border border-gray-200 rounded text-xs"
                  placeholder="Ordering URL"
                />
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) => setSupplierDrafts(prev => prev.map((row, i) => (i === index ? { ...row, email: e.target.value } : row)))}
                  className="px-2 py-1.5 border border-gray-200 rounded text-xs"
                  placeholder="Ordering Email"
                />
              </div>
              <div className="flex justify-end">
                <button type="button" className="text-xs px-2 py-1 border border-gray-300 rounded bg-white" onClick={() => handleSaveSupplierDraft(index)}>
                  Save Supplier
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-3">
          <p className="text-xs text-gray-500 m-0 mb-1">Suggested starters</p>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_SUPPLIER_SUGGESTIONS
              .filter((suggestion) => !suppliers.some((supplier) => supplier.supplier_name?.toLowerCase() === suggestion.name.toLowerCase()))
              .map((suggestion) => (
                <button
                  key={`suggested-supplier-${suggestion.name}`}
                  type="button"
                  className="text-xs px-2 py-1 border border-gray-300 rounded bg-white"
                  onClick={() => handleAddSuggestedSupplier(suggestion)}
                >
                  + {suggestion.name}
                </button>
              ))}
          </div>
        </div>

        {filteredSuppliers.length === 0 ? (
          <p className="text-xs text-gray-500 m-0">No suppliers saved for this venue.</p>
        ) : (
          <div className="space-y-2">
            {filteredSuppliers.map((supplier) => (
              <div key={supplier.id} className="border border-gray-200 rounded p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 font-semibold">
                    {supplier.supplier_name}
                    <span className="text-gray-500"> · {supplier.supplier_type || 'local_store'}</span>
                  </p>
                  <button type="button" className="text-xs px-2 py-1 border border-red-300 text-red-700 rounded bg-white" onClick={() => handleRemoveSupplier(supplier.id)}>
                    Remove
                  </button>
                </div>
                <p className="m-0 mt-1 text-gray-600">
                  {[supplier.address_line1, supplier.city, supplier.state, supplier.postal_code].filter(Boolean).join(', ') || 'Address not provided'}
                </p>
                <p className="m-0 mt-1 text-gray-500">
                  {supplier.website_url ? <a className="text-[#c8a45e]" href={supplier.website_url} target="_blank" rel="noopener noreferrer">Website</a> : 'No website'}
                  {supplier.ordering_url ? <span> · <a className="text-[#c8a45e]" href={supplier.ordering_url} target="_blank" rel="noopener noreferrer">Order</a></span> : ''}
                  {supplier.primary_contact?.name ? <span> · Primary: {supplier.primary_contact.name}</span> : ''}
                  {Number.isFinite(Number(supplier.linked_item_count)) ? <span> · Used by {supplier.linked_item_count} inventory items</span> : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-lg m-0">Supplier Contacts</h3>
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => setSupplierContactDrafts(prev => [...prev, blankSupplierContact()])}
          >
            + Add Another Contact
          </button>
        </div>
        <div className="space-y-2 mb-3">
          {supplierContactDrafts.map((draft, index) => (
            <div key={`supplier-contact-draft-${index}`} className="grid grid-cols-1 md:grid-cols-6 gap-2 border border-gray-200 rounded p-2">
              <select
                value={draft.venueSupplierId}
                onChange={(e) => setSupplierContactDrafts(prev => prev.map((row, i) => (i === index ? { ...row, venueSupplierId: e.target.value } : row)))}
                className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white"
              >
                <option value="">Supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>{supplier.supplier_name}</option>
                ))}
              </select>
              <input type="text" value={draft.name} onChange={(e) => setSupplierContactDrafts(prev => prev.map((row, i) => (i === index ? { ...row, name: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Name" />
              <input type="text" value={draft.title} onChange={(e) => setSupplierContactDrafts(prev => prev.map((row, i) => (i === index ? { ...row, title: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Title" />
              <input type="text" value={draft.phone} onChange={(e) => setSupplierContactDrafts(prev => prev.map((row, i) => (i === index ? { ...row, phone: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Phone" />
              <input type="email" value={draft.email} onChange={(e) => setSupplierContactDrafts(prev => prev.map((row, i) => (i === index ? { ...row, email: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Email" />
              <div className="flex items-center gap-2">
                <label className="text-xs flex items-center gap-1">
                  <input type="checkbox" checked={draft.isPrimary} onChange={(e) => setSupplierContactDrafts(prev => prev.map((row, i) => (i === index ? { ...row, isPrimary: e.target.checked } : row)))} />
                  Primary
                </label>
                <button type="button" className="text-xs px-2 py-1 border border-gray-300 rounded bg-white" onClick={() => handleSaveSupplierContactDraft(index)}>Save</button>
              </div>
            </div>
          ))}
        </div>
        {supplierContacts.length === 0 ? (
          <p className="text-xs text-gray-500 m-0">No supplier contacts yet. Add one and I will keep routing clean.</p>
        ) : (
          <div className="space-y-1">
            {supplierContacts.map((contact) => (
              <div key={contact.id} className="flex items-center justify-between gap-2 text-xs text-gray-600">
                <p className="m-0">
                  • {contact.name} ({contact.title || 'Contact'}) · {supplierById.get(contact.venue_supplier_id)?.supplier_name || 'Supplier'}
                  {contact.email ? ` · ${contact.email}` : ''}
                  {contact.phone ? ` · ${contact.phone}` : ''}
                  {contact.is_primary ? ' · Primary' : ''}
                </p>
                <button type="button" className="text-xs px-2 py-1 border border-red-300 text-red-700 rounded bg-white" onClick={() => handleRemoveSupplierContact(contact.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-lg m-0">Venue Inventory</h3>
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => setInventoryDrafts(prev => [...prev, blankInventoryItem()])}
          >
            + Add Another Item
          </button>
        </div>
        <div className="space-y-2 mb-3">
          {inventoryDrafts.map((draft, index) => (
            <div key={`inventory-draft-${index}`} className="grid grid-cols-1 md:grid-cols-8 gap-2 border border-gray-200 rounded p-2">
              <input type="text" value={draft.itemName} onChange={(e) => setInventoryDrafts(prev => prev.map((row, i) => (i === index ? { ...row, itemName: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs md:col-span-2" placeholder="Item name" />
              <input type="text" value={draft.category} onChange={(e) => setInventoryDrafts(prev => prev.map((row, i) => (i === index ? { ...row, category: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Category" />
              <input type="number" min="0" value={draft.quantity} onChange={(e) => setInventoryDrafts(prev => prev.map((row, i) => (i === index ? { ...row, quantity: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Qty" />
              <input type="text" value={draft.location} onChange={(e) => setInventoryDrafts(prev => prev.map((row, i) => (i === index ? { ...row, location: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Location" />
              <select value={draft.status} onChange={(e) => setInventoryDrafts(prev => prev.map((row, i) => (i === index ? { ...row, status: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white">
                {INVENTORY_STATUS_OPTIONS.map((statusValue) => (
                  <option key={statusValue} value={statusValue}>{statusValue}</option>
                ))}
              </select>
              <select value={draft.preferredSupplierId} onChange={(e) => setInventoryDrafts(prev => prev.map((row, i) => (i === index ? { ...row, preferredSupplierId: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="">Preferred supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>{supplier.supplier_name}</option>
                ))}
              </select>
              <input type="datetime-local" value={draft.nextServiceDueAt} onChange={(e) => setInventoryDrafts(prev => prev.map((row, i) => (i === index ? { ...row, nextServiceDueAt: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" />
              <input type="text" value={draft.supplierSku} onChange={(e) => setInventoryDrafts(prev => prev.map((row, i) => (i === index ? { ...row, supplierSku: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs md:col-span-2" placeholder="SKU" />
              <input type="url" value={draft.supplierItemUrl} onChange={(e) => setInventoryDrafts(prev => prev.map((row, i) => (i === index ? { ...row, supplierItemUrl: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs md:col-span-4" placeholder="Supplier item URL" />
              <div className="flex justify-end md:col-span-2">
                <button type="button" className="text-xs px-2 py-1 border border-gray-300 rounded bg-white" onClick={() => handleSaveInventoryDraft(index)}>Save</button>
              </div>
            </div>
          ))}
        </div>
        {inventory.length === 0 ? (
          <p className="text-xs text-gray-500 m-0">No inventory items yet. Add your first item to start tracking.</p>
        ) : (
          <div className="space-y-2">
            {inventory.map((item) => {
              const links = supplierLinksByInventory.get(item.id) || [];
              return (
                <div key={item.id} className="border border-gray-200 rounded p-2 text-xs text-gray-600">
                  <p className="m-0">
                    • {item.item_name} ({item.quantity || 0} {item.unit || 'ea'}) · {item.status || 'active'}
                    {item.location ? ` · ${item.location}` : ''}
                    {item.next_service_due_at ? ` · Next service ${new Date(item.next_service_due_at).toLocaleDateString()}` : ''}
                  </p>
                  {links.length ? (
                    <div className="mt-1 space-y-1">
                      {links.map((link) => (
                        <div key={link.id} className="flex flex-wrap items-center gap-2">
                          <span>{link.preferred ? 'Preferred' : 'Alt'}: {link.supplier?.supplier_name || 'Supplier'}</span>
                          {link.supplier_sku ? <button type="button" className="text-[11px] px-2 py-0.5 border border-gray-300 rounded bg-white" onClick={() => handleCopyText(link.supplier_sku)}>Copy SKU</button> : null}
                          {link.supplier_item_url ? <a href={link.supplier_item_url} target="_blank" rel="noopener noreferrer" className="text-[#c8a45e]">Open Item URL</a> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-lg m-0">Inventory Supplier Links</h3>
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => setInventorySupplierLinkDrafts(prev => [...prev, blankInventorySupplierLink()])}
          >
            + Add Another Link
          </button>
        </div>
        <div className="space-y-2 mb-3">
          {inventorySupplierLinkDrafts.map((draft, index) => (
            <div key={`inventory-supplier-link-draft-${index}`} className="grid grid-cols-1 md:grid-cols-7 gap-2 border border-gray-200 rounded p-2">
              <select value={draft.inventoryItemId} onChange={(e) => setInventorySupplierLinkDrafts(prev => prev.map((row, i) => (i === index ? { ...row, inventoryItemId: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="">Inventory item</option>
                {inventory.map((item) => (
                  <option key={item.id} value={item.id}>{item.item_name}</option>
                ))}
              </select>
              <select value={draft.supplierId} onChange={(e) => setInventorySupplierLinkDrafts(prev => prev.map((row, i) => (i === index ? { ...row, supplierId: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="">Supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>{supplier.supplier_name}</option>
                ))}
              </select>
              <input type="text" value={draft.supplierSku} onChange={(e) => setInventorySupplierLinkDrafts(prev => prev.map((row, i) => (i === index ? { ...row, supplierSku: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="SKU" />
              <input type="url" value={draft.supplierItemUrl} onChange={(e) => setInventorySupplierLinkDrafts(prev => prev.map((row, i) => (i === index ? { ...row, supplierItemUrl: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Item URL" />
              <input type="number" min="0" step="0.01" value={draft.lastPricePaid} onChange={(e) => setInventorySupplierLinkDrafts(prev => prev.map((row, i) => (i === index ? { ...row, lastPricePaid: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Last price" />
              <label className="text-xs flex items-center gap-1 px-2 py-1.5 border border-gray-200 rounded">
                <input type="checkbox" checked={draft.preferred} onChange={(e) => setInventorySupplierLinkDrafts(prev => prev.map((row, i) => (i === index ? { ...row, preferred: e.target.checked } : row)))} />
                Preferred
              </label>
              <button type="button" className="text-xs px-2 py-1 border border-gray-300 rounded bg-white" onClick={() => handleSaveInventorySupplierLinkDraft(index)}>Save Link</button>
            </div>
          ))}
        </div>
        {inventorySupplierLinks.length === 0 ? (
          <p className="text-xs text-gray-500 m-0">No inventory supplier links yet. Add one to map sourcing.</p>
        ) : (
          <div className="space-y-1">
            {inventorySupplierLinks.map((link) => (
              <div key={link.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600 border border-gray-100 rounded p-2">
                <p className="m-0">
                  {link.inventory_item?.item_name || 'Item'} → {link.supplier?.supplier_name || 'Supplier'}
                  {link.preferred ? ' · Preferred' : ''}
                  {link.supplier_sku ? ` · SKU ${link.supplier_sku}` : ''}
                </p>
                <div className="flex items-center gap-2">
                  {link.supplier_item_url ? <a href={link.supplier_item_url} target="_blank" rel="noopener noreferrer" className="text-[#c8a45e]">Open item URL</a> : null}
                  {link.supplier_sku ? <button type="button" className="text-[11px] px-2 py-0.5 border border-gray-300 rounded bg-white" onClick={() => handleCopyText(link.supplier_sku)}>Copy SKU</button> : null}
                  <button type="button" className="text-xs px-2 py-1 border border-red-300 text-red-700 rounded bg-white" onClick={() => handleRemoveInventorySupplierLink(link.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-lg m-0">Maintenance Contacts</h3>
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => setContactDrafts(prev => [...prev, blankMaintenanceContact()])}
          >
            + Add Another Contact
          </button>
        </div>
        <div className="space-y-2 mb-3">
          {contactDrafts.map((draft, index) => (
            <div key={`contact-draft-${index}`} className="grid grid-cols-1 md:grid-cols-5 gap-2 border border-gray-200 rounded p-2">
              <input type="text" value={draft.name} onChange={(e) => setContactDrafts(prev => prev.map((row, i) => (i === index ? { ...row, name: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Name" />
              <input type="text" value={draft.role} onChange={(e) => setContactDrafts(prev => prev.map((row, i) => (i === index ? { ...row, role: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Role" />
              <input type="text" value={draft.company} onChange={(e) => setContactDrafts(prev => prev.map((row, i) => (i === index ? { ...row, company: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Company" />
              <input type="text" value={draft.phone} onChange={(e) => setContactDrafts(prev => prev.map((row, i) => (i === index ? { ...row, phone: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Phone" />
              <div className="flex gap-2">
                <input type="email" value={draft.email} onChange={(e) => setContactDrafts(prev => prev.map((row, i) => (i === index ? { ...row, email: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs w-full" placeholder="Email" />
                <button type="button" className="text-xs px-2 py-1 border border-gray-300 rounded bg-white" onClick={() => handleSaveContactDraft(index)}>Save</button>
              </div>
            </div>
          ))}
        </div>
        {maintenanceContacts.length === 0 ? (
          <p className="text-xs text-gray-500 m-0">No maintenance contacts yet. Add one so follow-up is easy.</p>
        ) : (
          <div className="space-y-1">
            {maintenanceContacts.map(contact => (
              <p key={contact.id} className="text-xs m-0 text-gray-600">
                • {contact.name} ({contact.role || 'Contact'}){contact.company ? ` · ${contact.company}` : ''}{contact.phone ? ` · ${contact.phone}` : ''}
                {contact.is_primary ? ' · Primary' : ''}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-lg m-0">Maintenance Schedule</h3>
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => setTaskDrafts(prev => [...prev, blankMaintenanceTask()])}
          >
            + Add Another Task
          </button>
        </div>
        <div className="space-y-2 mb-3">
          {taskDrafts.map((draft, index) => (
            <div key={`task-draft-${index}`} className="grid grid-cols-1 md:grid-cols-6 gap-2 border border-gray-200 rounded p-2">
              <input type="text" value={draft.title} onChange={(e) => setTaskDrafts(prev => prev.map((row, i) => (i === index ? { ...row, title: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Task title" />
              <input type="text" value={draft.description} onChange={(e) => setTaskDrafts(prev => prev.map((row, i) => (i === index ? { ...row, description: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="Description" />
              <select value={draft.status} onChange={(e) => setTaskDrafts(prev => prev.map((row, i) => (i === index ? { ...row, status: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white">
                {MAINTENANCE_STATUS_OPTIONS.map(statusValue => (
                  <option key={statusValue} value={statusValue}>{statusValue}</option>
                ))}
              </select>
              <select value={draft.assignedContactId} onChange={(e) => setTaskDrafts(prev => prev.map((row, i) => (i === index ? { ...row, assignedContactId: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="">Assign contact</option>
                {maintenanceContacts.map(contact => (
                  <option key={contact.id} value={contact.id}>{contact.name}</option>
                ))}
              </select>
              <select value={draft.inventoryItemId} onChange={(e) => setTaskDrafts(prev => prev.map((row, i) => (i === index ? { ...row, inventoryItemId: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs bg-white">
                <option value="">Inventory item</option>
                {inventory.map(item => (
                  <option key={item.id} value={item.id}>{item.item_name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input type="datetime-local" value={draft.scheduledFor} onChange={(e) => setTaskDrafts(prev => prev.map((row, i) => (i === index ? { ...row, scheduledFor: e.target.value } : row)))} className="px-2 py-1.5 border border-gray-200 rounded text-xs w-full" />
                <button type="button" className="text-xs px-2 py-1 border border-gray-300 rounded bg-white" onClick={() => handleSaveTaskDraft(index)}>Save</button>
              </div>
            </div>
          ))}
        </div>
        {maintenanceTasks.length === 0 ? (
          <p className="text-xs text-gray-500 m-0">No maintenance tasks yet. Add one and I will track due dates.</p>
        ) : (
          <div className="space-y-1">
            {maintenanceTasks.map(task => (
              <p key={task.id} className="text-xs m-0 text-gray-600">
                • {task.title} · {task.status || 'scheduled'}
                {task.scheduled_for ? ` · ${new Date(task.scheduled_for).toLocaleString()}` : ''}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
