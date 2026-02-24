import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVenue } from '../context/VenueContext';
import { useAuth } from '../context/AuthContext';
import CompletionBar from '../components/CompletionBar';
import FormAIAssist from '../components/FormAIAssist';
import { extractFromImages, extractionToVenueForm, openCamera, openFileUpload } from '../services/photo-to-form';
import { isVenueRole } from '../constants/clientTypes';

const REQUIRED_FIELDS = ['firstName', 'lastName', 'businessName', 'email', 'city', 'state'];
const VENUE_FIELDS = ['firstName', 'lastName', 'businessName', 'dbaName', 'email', 'city', 'state', 'streetNumber', 'streetName'];
const SOCIAL_FIELDS = ['website', 'facebook', 'instagram', 'twitter', 'tiktok', 'youtube', 'spotify', 'linkedin', 'yelp', 'googleBusiness'];

export default function VenueSetup() {
  const { venue, saveVenue } = useVenue();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isVenueUser = isVenueRole(user?.clientType || 'venue_owner');
  const [form, setForm] = useState({
    // Contact Info
    firstName: venue.firstName || '',
    lastName: venue.lastName || '',
    title: venue.title || '',
    workPhone: venue.workPhone || '',
    cellPhone: venue.cellPhone || '',
    email: venue.email || '',
    preferredContact: venue.preferredContact || 'email',
    
    // Business Info
    businessName: venue.businessName || venue.name || '',
    dbaName: venue.dbaName || '',
    businessType: venue.businessType || 'venue',
    taxId: venue.taxId || '',
    yearEstablished: venue.yearEstablished || '',
    
    // Address
    streetNumber: venue.streetNumber || '',
    streetName: venue.streetName || '',
    suiteNumber: venue.suiteNumber || '',
    city: venue.city || 'San Antonio',
    state: venue.state || 'TX',
    zipCode: venue.zipCode || '',
    country: venue.country || 'US',
    
    // Social & Web
    website: venue.website || '',
    facebook: venue.facebook || '',
    facebookPageId: venue.facebookPageId || '',
    instagram: venue.instagram || '',
    linkedin: venue.linkedin || '',
    twitter: venue.twitter || '',
    tiktok: venue.tiktok || '',
    spotify: venue.spotify || '',
    youtube: venue.youtube || '',
    yelp: venue.yelp || '',
    googleBusiness: venue.googleBusiness || '',
    
    // Venue-Specific
    capacity: venue.capacity || '',
    hasStage: venue.hasStage || false,
    hasSound: venue.hasSound || false,
    hasLighting: venue.hasLighting || false,
    parkingType: venue.parkingType || 'street',
    adaAccessible: venue.adaAccessible || false,
    ageRestriction: venue.ageRestriction || 'all_ages',
    liquorLicense: venue.liquorLicense || false,
    
    // Brand
    logo: venue.logo || null,
    brandPrimary: venue.brandPrimary || '#c8a45e',
    brandSecondary: venue.brandSecondary || '#0d1b2a',
  });
  const [saved, setSaved] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [expandedSections, setExpandedSections] = useState({
    contact: true,
    business: true,
    address: true,
    social: false,
    venue: false,
    brand: false,
  });

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const updateCheckbox = (field) => (e) => setForm({ ...form, [field]: e.target.checked });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handlePhotoExtract = async (files) => {
    if (!files?.length) return;
    setExtracting(true);
    setUploadedImages(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    try {
      const result = await extractFromImages(files);
      if (result.success) {
        const venueData = extractionToVenueForm(result);
        setForm(prev => {
          const updated = { ...prev };
          // Map extracted fields to granular form fields
          if (venueData.name && !prev.businessName) updated.businessName = venueData.name;
          if (venueData.address && !prev.streetName) {
            // Try to parse address into components
            const addressParts = venueData.address.split(' ');
            if (addressParts.length > 1 && /^\d+$/.test(addressParts[0])) {
              updated.streetNumber = addressParts[0];
              updated.streetName = addressParts.slice(1).join(' ');
            } else {
              updated.streetName = venueData.address;
            }
          }
          if (venueData.city && !prev.city) updated.city = venueData.city;
          if (venueData.state && !prev.state) updated.state = venueData.state;
          if (venueData.postalCode && !prev.zipCode) updated.zipCode = venueData.postalCode;
          if (venueData.phone && !prev.workPhone) updated.workPhone = venueData.phone;
          if (venueData.email && !prev.email) updated.email = venueData.email;
          if (venueData.website && !prev.website) updated.website = venueData.website;
          if (venueData.instagram && !prev.instagram) updated.instagram = venueData.instagram;
          if (venueData.facebook && !prev.facebook) updated.facebook = venueData.facebook;
          if (venueData.brandColors?.[0] && !prev.brandPrimary) updated.brandPrimary = venueData.brandColors[0];
          if (venueData.brandColors?.[1] && !prev.brandSecondary) updated.brandSecondary = venueData.brandColors[1];
          return updated;
        });
      } else {
        alert('Extraction failed: ' + result.error);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setExtracting(false);
    }
  };

  const { completed, total } = useMemo(() => {
    const t = VENUE_FIELDS.length + 1; // +1 for "at least one social"
    let c = VENUE_FIELDS.filter(f => (form[f] || '').toString().trim()).length;
    if (SOCIAL_FIELDS.some(f => (form[f] || '').trim())) c++;
    return { completed: c, total: t };
  }, [form]);

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check required fields
    const missingFields = REQUIRED_FIELDS.filter(f => !(form[f] || '').toString().trim());
    if (missingFields.length > 0) {
      alert(`Please fill in required fields: ${missingFields.join(', ')}`);
      return;
    }
    
    setSaving(true);
    try {
      await saveVenue(form);
      setSaved(true);
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      alert('Error saving venue: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const fieldInput = (label, field, type = 'text', placeholder = '', required = false) => (
    <div key={field}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input 
        type={type} 
        value={form[field] || ''} 
        onChange={update(field)} 
        placeholder={placeholder}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]" 
      />
    </div>
  );

  const selectInput = (label, field, options, required = false) => (
    <div key={field}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select 
        value={form[field] || ''} 
        onChange={update(field)}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e] bg-white"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );

  const checkboxInput = (label, field) => (
    <div key={field} className="flex items-center">
      <input 
        type="checkbox" 
        checked={form[field] || false} 
        onChange={updateCheckbox(field)}
        className="mr-3 w-4 h-4 text-[#c8a45e] border-gray-300 rounded focus:ring-[#c8a45e]"
      />
      <label className="text-sm font-medium text-gray-700">{label}</label>
    </div>
  );

  const SectionHeader = ({ title, section, count }) => (
    <button 
      type="button"
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg mb-4 transition-colors"
    >
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="flex items-center gap-2">
        {count && <span className="text-xs bg-[#c8a45e] text-white px-2 py-1 rounded-full">{count} fields</span>}
        <span className={`transform transition-transform ${expandedSections[section] ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </div>
    </button>
  );

  const applyVenuePatch = (fields) => {
    setForm(prev => ({ ...prev, ...fields }));
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <h1 className="text-3xl mb-2">Venue Setup</h1>
      <p className="text-gray-500 mb-6">Tell us about your venue to personalize your experience.</p>

      <FormAIAssist
        formType="venue"
        currentForm={form}
        onApply={applyVenuePatch}
        title="Venue AI Assistant"
        description="Speak venue details once and AI will distribute them into contact, business, address, social, and venue fields."
      />

      {/* Photo-to-Form: AI Data Extraction for Venue */}
      <div className="card mb-6 border-2 border-dashed border-[#c8a45e] bg-[#faf8f3]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg">📸 Snap & Auto-Fill Venue Info</h3>
            <p className="text-xs text-gray-500 m-0">Photo a business card, menu, storefront sign, or anything with venue details : AI fills the form</p>
          </div>
          {extracting && <span className="text-sm text-[#c8a45e] animate-pulse">🔍 Extracting...</span>}
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={async () => { try { const f = await openCamera(); handlePhotoExtract([f]); } catch {} }}
            className="btn-primary text-sm" disabled={extracting}>
            📷 Take Photo
          </button>
          <button type="button" onClick={async () => { try { const files = await openFileUpload(true); handlePhotoExtract(files); } catch {} }}
            className="btn-secondary text-sm" disabled={extracting}>
            📁 Upload Images
          </button>
        </div>
        {uploadedImages.length > 0 && (
          <div className="flex gap-2 mt-3 overflow-x-auto">
            {uploadedImages.map((url, i) => (
              <img key={i} src={url} alt={`Upload ${i+1}`} className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
            ))}
          </div>
        )}
      </div>

      <CompletionBar completed={completed} total={total} label="Venue Profile" />

      {saved && (
        <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6 font-medium">✓ Venue saved! Redirecting to dashboard...</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <p className="text-xs text-gray-400">* Required fields</p>

        {/* Contact Information */}
        <div>
          <SectionHeader title="Contact Information" section="contact" count={7} />
          {expandedSections.contact && (
            <div className="card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fieldInput("First Name", "firstName", "text", "Julie", true)}
                {fieldInput("Last Name", "lastName", "text", "Good", true)}
                <div className="md:col-span-2">
                  {fieldInput("Title/Role", "title", "text", "Owner, Booking Manager, Marketing Director")}
                </div>
                {fieldInput("Work Phone", "workPhone", "tel", "(210) 555-1234")}
                {fieldInput("Cell Phone", "cellPhone", "tel", "(210) 555-5678")}
                <div className="md:col-span-2">
                  {fieldInput("Email", "email", "email", "you@venue.com", true)}
                </div>
                <div className="md:col-span-2">
                  {selectInput("Preferred Contact Method", "preferredContact", [
                    { value: 'email', label: 'Email' },
                    { value: 'phone', label: 'Phone' },
                    { value: 'text', label: 'Text Message' }
                  ])}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Business Information */}
        <div>
          <SectionHeader title="Business Information" section="business" count={5} />
          {expandedSections.business && (
            <div className="card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  {fieldInput("Business/Organization Name", "businessName", "text", "The Rialto Theater", true)}
                </div>
                <div className="md:col-span-2">
                  {fieldInput("DBA / Display Name", "dbaName", "text", "How you want to appear publicly")}
                </div>
                <div className="md:col-span-2">
                  {selectInput("Business Type", "businessType", [
                    { value: 'venue', label: 'Venue' },
                    { value: 'bar_restaurant', label: 'Bar/Restaurant' },
                    { value: 'theater', label: 'Theater' },
                    { value: 'gallery', label: 'Gallery' },
                    { value: 'church', label: 'Church' },
                    { value: 'outdoor', label: 'Outdoor' },
                    { value: 'other', label: 'Other' }
                  ])}
                </div>
                {fieldInput("Tax ID / EIN", "taxId", "text", "Optional, for contracts")}
                {fieldInput("Year Established", "yearEstablished", "number", "2010")}
              </div>
            </div>
          )}
        </div>

        {/* Address */}
        <div>
          <SectionHeader title="Address" section="address" count={7} />
          {expandedSections.address && (
            <div className="card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fieldInput("Street Number", "streetNumber", "text", "123")}
                {fieldInput("Street Name", "streetName", "text", "Main St")}
                <div className="md:col-span-2">
                  {fieldInput("Suite/Unit/Apt Number", "suiteNumber", "text", "Suite 100")}
                </div>
                {fieldInput("City", "city", "text", "San Antonio", true)}
                <div className="grid grid-cols-2 gap-4">
                  {fieldInput("State", "state", "text", "TX", true)}
                  {fieldInput("ZIP Code", "zipCode", "text", "78205")}
                </div>
                <div className="md:col-span-2">
                  {selectInput("Country", "country", [
                    { value: 'US', label: 'United States' },
                    { value: 'CA', label: 'Canada' },
                    { value: 'MX', label: 'Mexico' }
                  ])}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Social & Web */}
        <div>
          <SectionHeader title="Social & Web" section="social" count={11} />
          {expandedSections.social && (
            <div className="card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  {fieldInput("Website", "website", "url", "https://yourvenue.com")}
                </div>
                {fieldInput("Facebook URL", "facebook", "url", "https://facebook.com/yourvenue")}
                {fieldInput("Facebook Page ID", "facebookPageId", "text", "For API integrations")}
                {fieldInput("Instagram URL / Handle", "instagram", "text", "@yourvenue or full URL")}
                {fieldInput("LinkedIn URL", "linkedin", "url", "linkedin.com/company/yourvenue")}
                {fieldInput("Twitter/X Handle", "twitter", "text", "@yourvenue")}
                {fieldInput("TikTok Handle", "tiktok", "text", "@yourvenue")}
                {fieldInput("Spotify URL", "spotify", "url", "Spotify artist/venue link")}
                {fieldInput("YouTube Channel URL", "youtube", "url", "youtube.com/yourvenue")}
                {fieldInput("Yelp URL", "yelp", "url", "yelp.com/biz/yourvenue")}
                {fieldInput("Google Business Profile URL", "googleBusiness", "url", "Google My Business link")}
              </div>
            </div>
          )}
        </div>

        {/* Online Shops & Menus */}
        <div>
          <SectionHeader title="Online Shops and Menus" section="commerce" count={7} />
          {expandedSections.commerce && (
            <div className="card">
              <p className="text-sm text-gray-500 mb-4">Where people buy from you online. Add any that apply.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fieldInput("Online Menu URL", "onlineMenu", "url", "Your menu on your site, Toast, DoorDash, etc.")}
                {fieldInput("Square Online Store", "squareStore", "url", "squareup.com/store/yourvenue")}
                {fieldInput("Shopify Store", "shopifyStore", "url", "yourshop.myshopify.com")}
                {fieldInput("Amazon Store / Storefront", "amazonStore", "url", "amazon.com/shops/yourbrand")}
                {fieldInput("Etsy Shop", "etsyStore", "url", "etsy.com/shop/yourshop")}
                {fieldInput("Merch Store", "merchStore", "url", "MerchBar, Bandcamp merch, Big Cartel, etc.")}
                {fieldInput("Other Online Store", "otherStore", "url", "Any other place you sell online")}
              </div>
            </div>
          )}
        </div>

        {/* Venue-Specific */}
        {isVenueUser && (
        <div>
          <SectionHeader title="Venue-Specific Details" section="venue" count={8} />
          {expandedSections.venue && (
            <div className="card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fieldInput("Capacity", "capacity", "number", "200")}
                <div className="md:col-span-2">
                  {selectInput("Parking", "parkingType", [
                    { value: 'street', label: 'Street Parking' },
                    { value: 'lot', label: 'Parking Lot' },
                    { value: 'valet', label: 'Valet Service' },
                    { value: 'none', label: 'No Parking' }
                  ])}
                </div>
                <div className="md:col-span-2">
                  {selectInput("Age Restriction", "ageRestriction", [
                    { value: 'all_ages', label: 'All Ages' },
                    { value: '18_plus', label: '18+' },
                    { value: '21_plus', label: '21+' }
                  ])}
                </div>
                <div className="md:col-span-2 space-y-3">
                  {checkboxInput("Has Stage", "hasStage")}
                  {checkboxInput("Has Sound System", "hasSound")}
                  {checkboxInput("Has Lighting Rig", "hasLighting")}
                  {checkboxInput("ADA Accessible", "adaAccessible")}
                  {checkboxInput("Has Liquor License", "liquorLicense")}
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Brand Colors */}
        <div>
          <SectionHeader title="Brand & Visual Identity" section="brand" count={3} />
          {expandedSections.brand && (
            <div className="card">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center text-sm text-gray-400 cursor-pointer hover:border-[#c8a45e]"
                    onClick={() => alert('File upload coming with cloud storage integration')}>
                    {form.logo ? '✓ Logo uploaded' : 'Click to upload logo (PNG, JPG)'}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={form.brandPrimary} onChange={update('brandPrimary')} className="w-10 h-10 rounded cursor-pointer border-none" />
                      <input type="text" value={form.brandPrimary} onChange={update('brandPrimary')}
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={form.brandSecondary} onChange={update('brandSecondary')} className="w-10 h-10 rounded cursor-pointer border-none" />
                      <input type="text" value={form.brandSecondary} onChange={update('brandSecondary')}
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#c8a45e]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <button type="submit" className="btn-primary text-lg px-8" disabled={saving}>
          {saving ? '⟳ Saving...' : 'Save & Continue →'}
        </button>
      </form>
    </div>
  );
}
