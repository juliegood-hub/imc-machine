# ChatGPT Agent Prompt: Meta Instagram API Setup

Copy and paste this entire prompt into ChatGPT:

---

I need your help setting up Instagram API access for my Meta app. Walk me through each step one at a time. Wait for me to confirm before moving to the next step.

## What I Have
- Meta App: **IMC Machine** (App ID: 1636424580849393)
- Facebook Page: **Good Creative Media** (Page ID: 522058047815423)
- Instagram Business account: already linked to the Facebook Page in Meta Business Suite
- I already have a never-expiring Facebook Page Access Token, but it doesn't include Instagram permissions

## What I Need
1. Add the **Instagram** product to my Meta app (IMC Machine)
2. Generate a new **Page Access Token** that includes these permissions:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
3. Exchange that short-lived token for a **long-lived token** (60 days)
4. Then exchange THAT for a **never-expiring Page Access Token**

## Step-by-Step Instructions I Need

### Step 1: Add Instagram Product to App
- URL: https://developers.facebook.com/apps/1636424580849393/dashboard/
- Tell me exactly where to click to add Instagram as a product

### Step 2: Generate Token with IG Scopes
- URL: https://developers.facebook.com/tools/explorer/
- App: IMC Machine
- Token type: Page Access Token for Good Creative Media
- Add permissions: instagram_basic, instagram_content_publish
- Generate Access Token

### Step 3: Exchange for Long-Lived Token
- Give me the exact curl command using my App ID (1636424580849393) and App Secret (dcab06bbb208a75086fed04daf41002a)
- Format: `curl -s "https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=1636424580849393&client_secret=dcab06bbb208a75086fed04daf41002a&fb_exchange_token=SHORT_LIVED_TOKEN_HERE"`

### Step 4: Get Never-Expiring Page Token
- Give me the exact curl command to get the page access token from the long-lived user token
- Format: `curl -s "https://graph.facebook.com/v19.0/me/accounts?access_token=LONG_LIVED_USER_TOKEN_HERE"`
- The page token returned here is permanent (never expires)

### Step 5: Verify
- Give me a curl command to verify the new token has Instagram access:
- `curl -s "https://graph.facebook.com/v19.0/522058047815423?fields=instagram_business_account,name&access_token=NEW_TOKEN_HERE"`
- Should return an `instagram_business_account` object with an ID

### Step 6: Test IG Account
- Give me a curl to check the IG account details:
- `curl -s "https://graph.facebook.com/v19.0/IG_USER_ID?fields=username,name,followers_count,media_count&access_token=NEW_TOKEN_HERE"`

Walk me through one step at a time. After each step, I'll tell you what happened and you tell me the next step.

---

When you get the final never-expiring token, send it to me here and I'll update the app.
