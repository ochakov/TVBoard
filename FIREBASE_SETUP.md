# Firebase Configuration Setup

This document explains how to set up and use Firebase Realtime Database for managing multiple configurations in the Digital Bulletin Board application.

## Overview

The application now supports multiple configurations stored in Firebase Realtime Database. Each configuration is identified by a unique ID, allowing you to manage different bulletin board setups (e.g., lobby display, office board, main hall, etc.) from a central location.

## Firebase Project Setup

### 1. Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter your project name (e.g., "bulletin-board-configs")
4. Follow the setup wizard to create your project

### 2. Enable Realtime Database

1. In your Firebase project console, go to "Realtime Database"
2. Click "Create Database"
3. Choose your location (select the one closest to your users)
4. Start in **test mode** for initial setup (you can secure it later)

### 3. Get Your Firebase Configuration

1. Go to Project Settings (gear icon) → General tab
2. Scroll down to "Your apps" section
3. Click "Add app" → Web app (</>) icon
4. Register your app with a nickname
5. Copy the Firebase configuration object

### 4. Configure the Application

1. Open `firebase-config.js` in your project
2. Replace the placeholder values with your actual Firebase configuration:

```javascript
const FIREBASE_CONFIG = {
    apiKey: "your-actual-api-key",
    authDomain: "your-project-id.firebaseapp.com",
    databaseURL: "https://your-project-id-default-rtdb.firebaseio.com/",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
};
```

## Database Structure

The Firebase Realtime Database uses the following structure:

```
configurations/
├── lobby-display/
│   ├── bulletinConfig/
│   ├── translations/
│   ├── sizeConfig/
│   └── metadata/
├── office-board/
│   ├── bulletinConfig/
│   ├── translations/
│   ├── sizeConfig/
│   └── metadata/
└── main-hall/
    ├── bulletinConfig/
    ├── translations/
    ├── sizeConfig/
    └── metadata/
```

Each configuration ID contains:
- **bulletinConfig**: Main application configuration (components, weather, etc.)
- **translations**: Language translations
- **sizeConfig**: Component size configurations
- **metadata**: Upload timestamp, description, version info

## Usage Instructions

### First Time Setup

1. **Upload Initial Configuration**:
   - Open `upload-config.html` in your browser
   - Enter a configuration ID (e.g., "lobby-display")
   - Click "Upload Configuration" to transfer your local config to Firebase

2. **Access the Application**:
   - Open `index.html` in your browser
   - You'll be prompted to enter a configuration ID
   - Enter the ID you used in step 1
   - Check "Remember this ID" to avoid future prompts

### Managing Configurations

1. **Admin Interface**:
   - Open `admin.html` to view and manage all configurations
   - View configuration details, delete configurations, or open them in the app

2. **Creating New Configurations**:
   - Use `upload-config.html` with different configuration IDs
   - Modify `config.js` locally first, then upload with a new ID

3. **Switching Configurations**:
   - Clear browser localStorage to be prompted for a new ID
   - Or use the admin interface to switch between configurations

### Real-time Updates

- Changes made to configurations in Firebase are automatically reflected in running applications
- Multiple displays can use the same configuration ID and will update simultaneously
- Use this feature for centralized content management

## Security Rules

For production use, update your Firebase Realtime Database rules:

```json
{
  "rules": {
    "configurations": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```

This allows public read access but requires authentication for writes. Adjust according to your security needs.

## Troubleshooting

### Configuration Not Loading
- Check browser console for Firebase connection errors
- Verify your Firebase configuration in `firebase-config.js`
- Ensure the configuration ID exists in your database

### Permission Denied
- Check your Firebase Realtime Database security rules
- Ensure your database is accessible (test mode for development)

### Local Fallback
- If Firebase fails to load, the application automatically falls back to local `config.js`
- This ensures the application works even without internet connectivity

## File Structure

```
├── index.html              # Main application
├── admin.html             # Configuration management interface
├── upload-config.html     # Configuration upload tool
├── firebase-config.js     # Firebase project configuration
├── config-service.js      # Configuration loading service
├── config.js             # Local fallback configuration
├── app.js                # Main application (updated for Firebase)
└── FIREBASE_SETUP.md     # This documentation
```

## Benefits

1. **Centralized Management**: Update multiple displays from one location
2. **Real-time Updates**: Changes propagate immediately to all connected displays
3. **Multiple Configurations**: Support different setups with unique IDs
4. **Fallback Support**: Works offline with local configuration
5. **Easy Deployment**: No need to update files on each display device

## Next Steps

1. Set up your Firebase project and configure the application
2. Upload your first configuration using the upload tool
3. Test the application with your Firebase configuration
4. Use the admin interface to manage multiple configurations
5. Deploy to your display devices with the same Firebase configuration
