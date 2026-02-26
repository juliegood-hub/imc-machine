import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Pricing() {
  const { user } = useAuth();
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);

  const applyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    if (code === 'FREEFEB' || code === 'FREE-FEB' || code === 'FREEFEB2026' || code === 'FREEFORFEBRUARY') {
      setPromoApplied(true);
      setPromoError('');
    } else {
      setPromoApplied(false);
      setPromoError('Invalid promo code. Check your invite for the current code.');
    }
  };

  const handleGetStarted = () => {
    if (!agreed) {
      setShowAgreement(true);
      alert('Read and accept the AI Content Agreement, then I can continue.');
      return;
    }
    if (promoApplied) {
      alert('🎉 Free for February activated! Create your first event and we\'ll handle the rest. No charge until March.');
      return;
    }
    alert('Stripe checkout coming soon. Use promo code FREEFEB for free access through February!');
    // TODO: Stripe checkout session
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
          $25 Per Event. That's It.
        </h1>
        <p className="text-gray-500 max-w-lg mx-auto">
          No subscriptions. No tiers. No surprises. You pay when you have an event to promote, and we handle the rest.
        </p>
      </div>

      {/* Single Price Card */}
      <div className="card mb-8 ring-2 ring-[#c8a45e]">
        <div className="text-center mb-6">
          {promoApplied ? (
            <div>
              <span className="text-5xl font-bold text-green-600">$0</span>
              <span className="text-xl text-gray-400 line-through ml-3">$25</span>
              <p className="text-green-600 font-semibold mt-2">Free for February. No card required.</p>
            </div>
          ) : (
            <div>
              <span className="text-5xl font-bold text-[#0d1b2a]">$25</span>
              <span className="text-xl text-gray-400 ml-1">per event</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 mb-6">
          {[
            'AI-generated press release (AP style)',
            'Social posts for Facebook, Instagram, LinkedIn',
            'Event calendar listings (Do210, SA Current, Evvnt)',
            'Email campaign to your audience',
            'Image formatting for all 22+ platform sizes',
            'Bilingual press release (English + Spanish)',
            'Campaign tracker with status for every channel',
            'Media library for your photos and assets',
            'Sponsor logos and attribution in all materials',
            'Google Drive archive of everything generated',
            'Event page with shareable press kit',
            'Your real photos, properly formatted. No AI manipulation.',
          ].map((f, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
              <span className="text-sm text-gray-600">{f}</span>
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-400 mb-4">
            One event = one complete marketing campaign across every channel. Pay per event. Scale as you go.
          </p>
        </div>
      </div>

      {/* Promo Code */}
      <div className="card mb-8">
        <h3 className="text-sm font-semibold mb-2">🎟️ Have a promo code?</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={promoCode}
            onChange={e => setPromoCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyPromo()}
            placeholder="Enter code"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm uppercase"
          />
          <button onClick={applyPromo}
            className="px-4 py-2 bg-[#c8a45e] text-[#0d1b2a] rounded-lg font-semibold text-sm border-none cursor-pointer">
            Apply
          </button>
        </div>
        {promoApplied && (
          <div className="mt-2 text-sm text-green-600 font-semibold">
            ✅ Free for February! Full access to every feature, no card required.
          </div>
        )}
        {promoError && <p className="mt-2 text-sm text-red-500">{promoError}</p>}
      </div>

      {/* AI Content Agreement */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">📋 AI Content Agreement</h3>
          <button onClick={() => setShowAgreement(!showAgreement)}
            className="text-xs text-[#c8a45e] bg-transparent border-none cursor-pointer">
            {showAgreement ? 'Collapse' : 'Read Full Agreement'}
          </button>
        </div>

        {showAgreement && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm text-gray-700 space-y-3 max-h-64 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <p className="font-semibold text-gray-900">AI-GENERATED CONTENT DISCLOSURE AND AGREEMENT</p>
            <p className="text-xs text-gray-500">Good Creative Media · San Antonio, TX · Effective February 2026</p>

            <p><strong>1. AI-Assisted Content Generation.</strong> The IMC Machine by Good Creative Media ("Platform") uses artificial intelligence services provided by third parties, including but not limited to OpenAI (ChatGPT / GPT-4o / DALL-E), Anthropic (Claude), and Google (Gemini / Imagen), to generate marketing content on your behalf. This includes, but is not limited to, press releases, social media posts, email campaigns, event calendar listings, image generation, image formatting, bilingual translations, and research summaries.</p>

            <p><strong>2. AI Can Make Mistakes.</strong> You acknowledge and understand that AI-generated content may contain errors, inaccuracies, outdated information, or content that does not fully reflect your intent, brand, or factual circumstances. All AI-generated content is provided as a draft for your review. You are responsible for reviewing, editing, and approving all content before it is distributed on your behalf.</p>

            <p><strong>3. Human Review Recommended.</strong> Good Creative Media strongly recommends that you review all AI-generated content before distribution. The Platform provides editing tools and preview functionality for this purpose. Content distributed without your review is distributed at your own risk.</p>

            <p><strong>4. Content Removal.</strong> In the event that AI-generated content distributed through the Platform contains material errors, offensive content, or content that negatively impacts your brand, Good Creative Media will make commercially reasonable efforts to remove or correct such content in a timely manner upon your written or electronic request. Removal timelines depend on the third-party platform (Facebook, LinkedIn, Eventbrite, email providers, etc.) and are subject to those platforms' respective policies and processing times.</p>

            <p><strong>5. No Guarantee of Accuracy.</strong> Good Creative Media does not guarantee the accuracy, completeness, or suitability of any AI-generated content. The Platform is a tool to assist your marketing efforts, not a substitute for professional editorial judgment.</p>

            <p><strong>6. Intellectual Property.</strong> Content generated through the Platform using your event details, venue information, and brand assets is created for your use. You retain ownership of your original materials (photos, logos, brand assets). AI-generated text and images are provided under the terms of the respective AI providers (OpenAI, Anthropic, Google) and are licensed to you for commercial use in connection with your events.</p>

            <p><strong>7. Image Generation and Real Photos.</strong> When you upload your own photographs for formatting and resizing, the Platform does not alter the content of your images. It adds padding (black or white space) to fit platform-specific dimensions. When AI image generation is used (via DALL-E or Gemini Imagen), those images are AI-created and should be identified as such where required by applicable law or platform policy.</p>

            <p><strong>8. Third-Party Services.</strong> The Platform integrates with third-party services including but not limited to Facebook/Meta, Instagram, LinkedIn, YouTube, Eventbrite, Google Drive, Resend (email), and Supabase (data storage). Your use of those services through the Platform is also subject to their respective terms of service and privacy policies.</p>

            <p><strong>9. Data Privacy.</strong> Good Creative Media stores your account information, event details, and generated content in secure cloud infrastructure. We do not sell your data. Your information is used solely to provide the services described herein.</p>

            <p><strong>10. Limitation of Liability.</strong> To the maximum extent permitted by law, Good Creative Media, its owner Julie Good, and its affiliates shall not be liable for any indirect, incidental, consequential, or punitive damages arising from the use of AI-generated content distributed through the Platform, including but not limited to reputational harm, lost revenue, or third-party claims.</p>

            <p><strong>11. Indemnification.</strong> You agree to indemnify and hold harmless Good Creative Media and Julie Good from any claims, damages, or expenses arising from content you approved for distribution through the Platform.</p>

            <p><strong>12. Modifications.</strong> Good Creative Media reserves the right to update this agreement as AI technology and applicable regulations evolve. You will be notified of material changes via the email address associated with your account.</p>

            <p><strong>13. Governing Law.</strong> This agreement is governed by the laws of the State of Texas. Any disputes shall be resolved in Bexar County, Texas.</p>
          </div>
        )}

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            className="mt-1 w-4 h-4 flex-shrink-0"
          />
          <span className="text-sm text-gray-700">
            I have read and understand the AI Content Agreement. I acknowledge that content generated through the IMC Machine is AI-assisted, may contain errors, and that I am responsible for reviewing content before distribution. I understand that Good Creative Media will remove problematic content in a timely manner upon request.
          </span>
        </label>
      </div>

      {/* CTA */}
      <div className="text-center mb-8">
        <button
          onClick={handleGetStarted}
          disabled={!agreed}
          className={`px-8 py-3 rounded-lg font-semibold text-lg border-none cursor-pointer transition-colors ${
            agreed
              ? 'bg-[#c8a45e] text-[#0d1b2a] hover:bg-[#b8943e]'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {promoApplied ? '🎉 Start Free for February' : '🚀 Get Started — $25/Event'}
        </button>
        {!agreed && <p className="text-xs text-gray-400 mt-2">Accept the AI Content Agreement above, then we are ready.</p>}
      </div>

      {/* FAQ */}
      <div className="space-y-4">
        <h2 className="text-xl text-center" style={{ fontFamily: "'Playfair Display', serif" }}>Questions?</h2>
        <div className="card">
          <h4 className="text-sm font-semibold">What does $25 per event include?</h4>
          <p className="text-sm text-gray-500 mt-1">Everything. Press release, social posts for every platform, email campaign, calendar listings, image formatting for 22+ sizes, bilingual Spanish press, campaign tracking, and Google Drive archive. One price, complete campaign.</p>
        </div>
        <div className="card">
          <h4 className="text-sm font-semibold">What if AI makes a mistake in my content?</h4>
          <p className="text-sm text-gray-500 mt-1">You always get to review and edit before anything goes out. If something slips through, contact us and we'll remove or correct it as fast as the platform allows. That's our commitment.</p>
        </div>
        <div className="card">
          <h4 className="text-sm font-semibold">Do I need my own social media accounts?</h4>
          <p className="text-sm text-gray-500 mt-1">Yes. The IMC Machine posts to your accounts on your behalf. You stay in control of your brand, always.</p>
        </div>
        <div className="card">
          <h4 className="text-sm font-semibold">Can I upload my own photos instead of using AI images?</h4>
          <p className="text-sm text-gray-500 mt-1">Absolutely. That's actually what we recommend. Upload your real venue photos, band headshots, event flyers. We'll format them to every platform size with clean padding. No AI manipulation of your photos, ever.</p>
        </div>
        <div className="card">
          <h4 className="text-sm font-semibold">Who built this?</h4>
          <p className="text-sm text-gray-500 mt-1">Julie Good, Good Creative Media, San Antonio TX. Built by a promoter, for promoters, artists, venues, and everyone who makes live events happen.</p>
        </div>
      </div>

      <div className="text-center mt-8">
        <p className="text-xs text-gray-400">
          Payments processed securely by Stripe. Questions? Email juliegood@goodcreativemedia.com
        </p>
      </div>
    </div>
  );
}
