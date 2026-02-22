# The IMC Machine — Web Portal Project

## Overview
Client portal web app for Good Creative Media's venue clients.
AI-powered press releases, social posts, graphics, and distribution.

## Architecture
- **Frontend:** React app hosted on Vercel or Pressable subdomain (app.goodcreativemedia.com)
- **Backend:** Serverless API (Vercel functions or Cloudflare Workers)
- **AI Engine:** OpenAI GPT for copy, Vertex AI/DALL-E for graphics
- **Storage:** Google Drive (auto-created folder trees per client/venue/show)
- **Distribution:** Eventbrite, Meta Graph, X API, LinkedIn, Gmail, Mailchimp/SendGrid

## WordPress Integration
- Main site: goodcreativemedia.com (Pressable/WP Cloud, Beaver Builder Pro)
- WP REST API app password configured (user ID 2)
- "Launch Portal" button on main site links to app subdomain

## API Status
| Service | Status | Notes |
|---------|--------|-------|
| Google Drive API | ✅ Enabled | GCP project: techarts-theater |
| Google Docs API | ✅ Enabled | via Drive |
| Gmail API | ✅ Enabled | GCP project |
| Vertex AI (Imagen) | ✅ Enabled | GCP project |
| Gemini API | ✅ Enabled | GCP project |
| YouTube Data v3 | ✅ Enabled | GCP project |
| Google Sheets | ✅ Enabled | GCP project |
| OpenAI API | ⏳ Need key | GPT + DALL-E |
| Eventbrite API | ⏳ Need key | Event creation |
| Meta Graph API | ⏳ Need setup | FB/IG posting |
| X/Twitter API | ⏳ Need setup | Tweet posting |
| LinkedIn API | ⏳ Need setup | Company page posting |
| Mailchimp | ⏳ Need key | Email distribution |

## Google Cloud
- Project: TechArts Theater (techarts-theater, #407658919128)
- Org: goodcreativemedia.com
- OAuth Client ID (iOS): 407658919128-dov9hbe5utuuvoi03qcj9eg055f5rvhe.apps.googleusercontent.com
- Service account: TBD (need for server-side Drive/Gmail access)

## Timeline
- Wed 2/18: Scaffold portal, configure APIs
- Thu 2/19: Event creation + Run of Show builder
- Fri 2/20: AI content engine + Drive folder automation
- Sat 2/21: Distribution pipeline (social + media)
- Sun 2/22: Polish + test with venue partners

## Credentials
- WP: Application Password configured for REST API
- Pressable: Access available
- All API keys stored in environment variables, NOT in code
