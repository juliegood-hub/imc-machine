# Google Drive Integration Setup

## 1. Run the Database Migration

Open [Supabase SQL Editor](https://supabase.com/dashboard/project/qavrufepvcihklypxbvm/sql) and run the contents of `schema-drive.sql`.

## 2. Create a Google Service Account

1. Go to [GCP Console → IAM → Service Accounts](https://console.cloud.google.com/iam-admin/service-accounts?project=techarts-theater)
2. Click **Create Service Account**
3. Name it `imc-machine-drive` (or similar)
4. Skip granting roles (Drive API doesn't need project-level roles)
5. Click **Done**
6. Click on the new service account → **Keys** tab → **Add Key** → **Create New Key** → **JSON**
7. Download the JSON key file

## 3. Add the Key to Vercel

1. Go to your Vercel project settings → **Environment Variables**
2. Add a new variable:
   - **Name**: `GOOGLE_SERVICE_ACCOUNT_KEY`
   - **Value**: Paste the **entire contents** of the JSON key file (the whole `{...}` object)
   - **Environments**: Production, Preview, Development

## 4. How It Works

- **Settings page**: Users click "Set Up Google Drive" → creates their client folder tree
- **Event creation**: Automatically creates an event subfolder with content directories
- **Content generation**: Generated press releases, social posts, and images auto-save to Drive
- All folders are shared with the user AND with `juliegood@goodcreativemedia.com`

## Folder Structure

```
IMC Machine/                          ← shared root (created once)
  └── {Client Name}/                  ← per-client folder
      ├── Brand Assets/
      │   ├── Logos/
      │   └── Headshots/
      └── {Event Title} - {YYYY-MM-DD}/  ← per-event folder
          ├── Press Releases/
          ├── Social Posts/
          ├── Images/
          ├── Email Campaigns/
          └── Calendar Listings/
```
