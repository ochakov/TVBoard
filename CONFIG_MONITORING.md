# Firebase Config Monitoring

This document explains the automatic configuration monitoring system that checks for remote config changes every minute and reloads the page when changes are detected.

## 🔄 How It Works

### Automatic Monitoring
- **Check Interval**: Every 60 seconds (1 minute)
- **Only for Firebase Configs**: Monitoring only activates when using Firebase-hosted configurations
- **Hash-Based Detection**: Uses SHA-like hashing to detect configuration changes
- **Automatic Reload**: Page reloads automatically when changes are detected

### Configuration Hash
The system calculates a hash of the entire configuration including:
- Main bulletin board configuration (`bulletinConfig`)
- Translations (`translations`) 
- Size configuration (`sizeConfig`)

When any of these change remotely, the hash changes and triggers a page reload.

## 🎯 Features

### 1. **Smart Detection**
- Compares configuration hashes to detect actual changes
- Ignores identical configurations to prevent unnecessary reloads
- Handles network errors gracefully without disrupting the application

### 2. **User Feedback**
- Shows a notification when page reloads due to config changes
- Notification appears in Hebrew: "תצורה עודכנה" (Configuration Updated)
- Auto-dismisses after 5 seconds

### 3. **Resource Management**
- Automatically starts monitoring when using Firebase configs
- Stops monitoring when using local configs
- Cleans up timers on page unload to prevent memory leaks

## 🛠️ Implementation Details

### ConfigService Enhancements
```javascript
// New properties added to ConfigService
this.configCheckInterval = null;        // Timer for periodic checks
this.lastConfigHash = null;             // Current config hash
this.isUsingFirebaseConfig = false;     // Whether using Firebase config
```

### Key Methods
- `_startConfigMonitoring()` - Starts the 1-minute check interval
- `_checkForConfigChanges()` - Fetches remote config and compares hashes
- `_calculateConfigHash()` - Generates hash from configuration data
- `wasReloadedForConfigChange()` - Checks if page was reloaded due to config change

### BulletinBoard Integration
- `checkConfigChangeReload()` - Shows notification if reloaded due to config change
- `showConfigChangeNotification()` - Displays the update notification
- `setupPageUnloadCleanup()` - Cleans up resources on page unload

## 🧪 Testing

### Test Page
Use `test-config-monitoring.html` to test the monitoring system:

1. **Status Monitoring**: View real-time status of Firebase connection, config source, and monitoring state
2. **Manual Testing**: Trigger manual config checks
3. **Simulation**: Simulate config changes to test the detection system
4. **Activity Logs**: View detailed logs of all monitoring activities

### Test URL
```
https://tvboard-b17d8.web.app/test-config-monitoring.html
```

## 📋 Usage Scenarios

### 1. **Remote Configuration Updates**
- Admin updates configuration via Firebase console or admin interface
- All connected displays automatically reload within 1 minute
- Users see a brief notification about the update

### 2. **Content Management**
- Update RSS feeds, video URLs, or display components
- Changes propagate to all displays automatically
- No manual intervention required

### 3. **Emergency Updates**
- Quickly push urgent configuration changes
- All displays update within 60 seconds
- Immediate visual feedback confirms the update

## ⚙️ Configuration

### Enable/Disable Monitoring
Monitoring is automatically enabled/disabled based on:
- **Enabled**: When using Firebase configurations
- **Disabled**: When using local configurations or Firebase is unavailable

### Customizing Check Interval
To change the check interval, modify the interval in `_startConfigMonitoring()`:
```javascript
// Check every 30 seconds instead of 60
this.configCheckInterval = setInterval(() => {
    this._checkForConfigChanges();
}, 30000);
```

### Notification Customization
Modify the notification in `showConfigChangeNotification()`:
```javascript
notification.innerHTML = `
    <div class="d-flex align-items-center">
        <i class="fas fa-sync-alt text-info me-2"></i>
        <div>
            <strong>Custom Title</strong><br>
            <small>Custom message</small>
        </div>
        <button type="button" class="btn-close ms-auto" data-bs-dismiss="alert"></button>
    </div>
`;
```

## 🔍 Monitoring and Debugging

### Console Logs
The system provides detailed console logging:
```
✅ Remote config unchanged
🔄 Remote config has changed! Reloading page...
Config hash updated: 1234567890
Starting config monitoring - checking every minute for changes
```

### Browser Developer Tools
1. Open F12 Developer Tools
2. Go to Console tab
3. Look for `[ConfigService]` and `[ConfigTest]` log entries
4. Monitor network requests to Firebase

### Status Indicators
- **Green**: Active and working
- **Red**: Inactive or error
- **Yellow**: Warning or transitional state

## 🚨 Troubleshooting

### Common Issues

1. **Monitoring Not Starting**
   - Check if using Firebase configuration (not local)
   - Verify Firebase connection is active
   - Look for initialization errors in console

2. **Changes Not Detected**
   - Verify configuration actually changed in Firebase
   - Check network connectivity
   - Look for hash calculation errors

3. **Excessive Reloads**
   - Check for configuration instability
   - Verify hash calculation consistency
   - Look for network-related issues

### Error Handling
The system gracefully handles:
- Network connectivity issues
- Firebase service interruptions
- Invalid configuration data
- Hash calculation errors

## 📊 Performance Impact

### Resource Usage
- **Memory**: Minimal - single timer and hash storage
- **Network**: One Firebase read request per minute
- **CPU**: Negligible - simple hash calculation

### Optimization
- Only runs when using Firebase configs
- Efficient hash-based change detection
- Automatic cleanup prevents memory leaks
- Graceful error handling prevents crashes

## 🔐 Security Considerations

### Data Privacy
- Only configuration data is accessed
- No sensitive user data involved
- Standard Firebase security rules apply

### Access Control
- Uses existing Firebase authentication
- Respects Firebase database security rules
- No additional permissions required

This monitoring system ensures that all displays stay synchronized with the latest configuration changes while maintaining optimal performance and user experience.
