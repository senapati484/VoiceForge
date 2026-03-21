# OAuth Setup Guide

## Google OAuth Configuration

To fix the "Access blocked: This app's request is invalid" error, you need to configure Google OAuth correctly:

### 1. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth client ID**
5. Configure the OAuth consent screen (External or Internal)
6. For Application type, select **Web application**
7. Add the following **Authorized redirect URIs**:
   - For local development: `http://localhost:3000/api/auth/callback/google`
   - For production: `https://yourdomain.com/api/auth/callback/google`

### 2. Environment Variables

Add these to your `.env.local` file:

```
GOOGLE_CLIENT_ID=your_client_id_from_google_console
GOOGLE_CLIENT_SECRET=your_client_secret_from_google_console
```

### 3. Common Errors

#### "Access blocked: This app's request is invalid"
- **Cause**: The redirect_uri in the request doesn't match the authorized redirect URIs in Google Cloud Console
- **Fix**: Ensure the exact URL `http://localhost:3000/api/auth/callback/google` is added to Authorized redirect URIs

#### "Access blocked: Authorization error"
- **Cause**: The OAuth consent screen is not published and your email is not added as a test user
- **Fix**: Either publish the app OR add your email as a test user in the OAuth consent screen settings

#### "Error 400: redirect_uri_mismatch"
- **Cause**: The callback URL configured doesn't match what NextAuth is sending
- **Fix**: Check that the exact URL including protocol (http/https) and port matches

### 4. Testing Google OAuth Locally

1. Make sure you have `http://localhost:3000/api/auth/callback/google` in your Authorized redirect URIs
2. Use `http://` not `https://` for local development
3. Add your test email to the test users list if the app is in testing mode

## Session Configuration

Sessions are now configured to last **30 days** so users stay logged in for the whole day until they explicitly logout.

If you need to adjust this, modify `voiceforge-web/lib/auth.ts`:

```typescript
session: {
  maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
  updateAge: 24 * 60 * 60    // Update session every 24 hours
}
```
