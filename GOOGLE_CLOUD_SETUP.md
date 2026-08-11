# Google Cloud Setup — OAuth + Gmail + Sheets

This app uses **two separate Google authorizations** from the same Google Cloud
project:

1. **App sign-in** (`openid email profile`) — lets a user sign in to the app
   with Google (NextAuth.js).
2. **Mailbox authorization** (`gmail.send gmail.readonly gmail.modify
   spreadsheets`) — lets the app send campaign email from the user's Gmail and
   read/write their Google Sheet. Tokens are stored AES-256-GCM encrypted and
   never sent to the browser.

Follow the steps below once. You only need to do this when you want real Google
login / sending — until then the app works locally with the dev-login fallback.

## 1. Create a Google Cloud project

1. Go to https://console.cloud.google.com/ and create a new project (or select
   an existing one).
2. Note the **Project ID** — you'll reference it when enabling APIs.

## 2. Enable the required APIs

Go to **APIs & Services → Library** and enable:

- **Gmail API**
- **Google Sheets API**

## 3. Configure the OAuth consent screen

Go to **APIs & Services → OAuth consent screen**:

1. Choose **External** (or Internal if you use a Google Workspace account).
2. App name, support email, developer contact → save.
3. **Scopes**: add
   - `.../auth/gmail.send` — send emails as the user
   - `.../auth/gmail.readonly` — read the user's messages for reply detection
   - `.../auth/gmail.modify` — mark messages read / apply labels
   - `.../auth/spreadsheets` — read/write Google Sheets
   - `.../auth/userinfo.email` and `.../auth/userinfo.profile` (for app sign-in)
4. **Test users**: while the app is in "Testing" mode only the accounts you
   list here can authorize. Add your own Google account(s). For production,
   move the app to **Published** and complete verification if required.

## 4. Create OAuth client credentials

Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**:

1. Application type: **Web application**.
2. Name: e.g. `outreach-platform-dev`.
3. **Authorized JavaScript origins**: `http://localhost:3000`
4. **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google` — NextAuth app sign-in
   - `http://localhost:3000/api/google/callback` — mailbox authorization
5. Create → copy the **Client ID** and **Client secret**.

> For production, repeat with your real domain and add those origins/URIs (and
> remove or keep localhost entries as needed).

## 5. Set environment variables

In your `.env`:

```dotenv
# App sign-in (NextAuth)
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"

# Mailbox authorization callback (same project)
GOOGLE_REDIRECT_URI="http://localhost:3000/api/google/callback"

NEXTAUTH_URL="http://localhost:3000"
```

Restart `npm run dev` after changing env vars.

## 6. Verify

- The sign-in page shows a **Continue with Google** button (it is hidden while
  credentials are empty).
- Under Settings → Mailboxes you can start the mailbox authorization flow and
  grant Gmail + Sheets access.

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `redirect_uri_mismatch` | The redirect URI isn't listed in the OAuth client's Authorized redirect URIs. |
| `Error 403: access_configured` / consent blocked | App is in Testing and your Google account isn't in Test users. |
| Button "Continue with Google" missing | `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` not set; restart the server. |
| `invalid_client` | Client ID/secret typo, or wrong project. |
