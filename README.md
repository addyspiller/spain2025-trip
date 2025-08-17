# Spain Trip Planner

A collaborative trip planning application for Spain with real-time synchronization.

## Security Setup (IMPORTANT)

### API Keys Configuration

**NEVER commit API keys to version control!** This project uses a `secrets.js` file to store sensitive configuration.

1. Copy the template file:
   ```bash
   cp secrets.example.js secrets.js
   ```

2. Edit `secrets.js` and add your actual API keys:
   - Firebase configuration (from Firebase Console)
   - Google Maps API key (from Google Cloud Console)

3. The `secrets.js` file is automatically ignored by git via `.gitignore`

### Required API Keys

1. **Firebase Configuration**:
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Realtime Database
   - Copy configuration from Project Settings

2. **Google Maps API Key**:
   - Create a project at https://console.cloud.google.com
   - Enable Google Maps JavaScript API and Places API
   - Create an API key with appropriate restrictions

### Deployment

For production deployment:
1. Use environment variables or build-time variable substitution
2. Never include `secrets.js` in production builds
3. Use domain restrictions on your Google Maps API key
4. Configure Firebase security rules

## Development

1. Install dependencies (if any): `npm install`
2. Set up your `secrets.js` file (see above)
3. Serve locally: `python -m http.server 8000` or use any local server

## Security Notes

- `secrets.js` contains sensitive API keys and is gitignored
- Use `secrets.example.js` as a template for new setups
- Regularly rotate API keys if they become exposed
- Monitor your Google Cloud and Firebase usage for unexpected activity

## Features

- Real-time collaborative trip planning
- Google Places integration for discovering attractions
- Hotel booking assistance
- Activity logging with location tracking
- Cross-device synchronization