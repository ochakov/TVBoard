# Digital Bulletin Board

A modern, responsive digital bulletin board web application built with vanilla JavaScript and Bootstrap. This serverless single-page application can be served as a static site over HTTPS and runs on any modern browser.

## Features

- **Top Bar Display**: Shows current date, time, and weather information
- **Component System**: Three types of components that can be configured:
  - **Image Components**: Display images with auto-refresh capability
  - **RSS Feed Components**: Show news feeds from RSS sources
  - **Video Components**: Play MP4 videos with rotation support
- **Responsive Layout**: Bootstrap-based grid system that adapts to different screen sizes
- **Configuration-Driven**: Easy to customize through the `config.js` file
- **Auto-Refresh**: Components can be set to refresh automatically at specified intervals

## Quick Start

1. **Open the application**: Simply open `index.html` in a modern web browser
2. **Configure components**: Edit `config.js` to customize the layout and content
3. **Set up weather**: Add your OpenWeather API key in `config.js` for weather functionality

## Configuration

The application is configured through the `config.js` file. Here's what you can customize:

### Application Settings
```javascript
app: {
    title: 'לוח מודעות דיגיטלי', // Application title
    showTitle: true // Whether to show the title in the navbar
}
```

**Title Examples:**
- Hebrew: `'לוח מודעות דיגיטלי'`
- English: `'Digital Bulletin Board'`
- Company specific: `'ABC Company - Digital Board'`
- Hide title: Set `showTitle: false`

### Layout Settings
```javascript
layout: {
    columns: 3, // Number of columns in the grid
    autoRefresh: 30000, // Auto-refresh interval (30 seconds)
    weatherUpdateInterval: 600000 // Weather update interval (10 minutes)
}
```

### Weather Settings
```javascript
weather: {
    enabled: true,
    apiKey: 'YOUR_OPENWEATHER_API_KEY', // Get from openweathermap.org
    city: 'New York',
    units: 'metric', // metric, imperial, or kelvin
    useAppLanguage: true // Use the selected app language for weather descriptions
}
```

### Component Configuration
Each component can be configured with:
- **id**: Unique identifier
- **type**: 'image', 'rss', or 'video'
- **title**: Display title
- **size**: 'small', 'medium', or 'large'
- **config**: Type-specific configuration

#### Image Components
```javascript
{
    id: 'image-1',
    type: 'image',
    title: 'Company Logo',
    size: 'large',
    config: {
        imageUrl: 'https://example.com/image.jpg',
        altText: 'Company Logo',
        refreshInterval: 0 // 0 = no auto-refresh
    }
}
```

#### RSS Components
```javascript
{
    id: 'rss-1',
    type: 'rss',
    title: 'Latest News',
    size: 'medium',
    config: {
        feedUrl: 'https://feeds.bbci.co.uk/news/rss.xml',
        maxItems: 5,
        refreshInterval: 300000, // 5 minutes
        showImages: false
    }
}
```

#### Video Components
```javascript
{
    id: 'video-1',
    type: 'video',
    title: 'Promotional Video',
    size: 'large',
    config: {
        videoUrls: [
            'https://example.com/video1.mp4',
            'https://example.com/video2.mp4'
        ],
        autoplay: true,
        loop: true,
        muted: true,
        refreshInterval: 0
    }
}
```

## Weather Setup

To enable weather functionality:

1. Sign up for a free API key at [OpenWeatherMap](https://openweathermap.org/api)
2. Replace `'YOUR_OPENWEATHER_API_KEY'` in `config.js` with your actual API key
3. Optionally change the city and units as needed

### Weather Language Support

The weather descriptions will automatically be displayed in the selected app language. Supported languages include:

- **Hebrew** (he) - עברית
- **English** (en)
- **Arabic** (ar) - العربية
- **Spanish** (es) - Español
- **French** (fr) - Français
- **German** (de) - Deutsch
- **Italian** (it) - Italiano
- **Portuguese** (pt) - Português
- **Russian** (ru) - Русский
- **Chinese** (zh) - 中文
- **Japanese** (ja) - 日本語
- **Korean** (ko) - 한국어

Set `useAppLanguage: true` in the weather configuration to enable automatic language detection.

## RSS Feed Setup

The application uses the RSS2JSON API service to parse RSS feeds. No additional setup is required - just provide valid RSS feed URLs in your component configurations.

## Browser Compatibility

This application works on all modern browsers including:
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## File Structure

```
├── index.html          # Main HTML file
├── styles.css          # Custom CSS styles
├── config.js           # Configuration file
├── app.js             # Main JavaScript application
└── README.md          # This file
```

## Deployment

Since this is a static web application, it can be deployed to any static hosting service:

- **GitHub Pages**: Upload files to a GitHub repository and enable Pages
- **Netlify**: Drag and drop the files or connect a Git repository
- **Vercel**: Deploy directly from a Git repository
- **AWS S3**: Upload files to an S3 bucket with static website hosting enabled
- **Any web server**: Simply upload the files to your web server

## Customization

### Styling
Modify `styles.css` to change the appearance. The application uses Bootstrap 5 classes and custom CSS variables.

### Adding New Component Types
To add new component types:

1. Add the component type to the `createComponent()` method in `app.js`
2. Create a corresponding `load[Type]Component()` method
3. Add the component type to the configuration

### Responsive Design
The application uses Bootstrap's responsive grid system. Component sizes are defined in the `SIZE_CONFIG` object in `config.js`.

## Troubleshooting

### Weather Not Showing
- Check that your OpenWeather API key is correct
- Verify the city name is spelled correctly
- Ensure your API key has the necessary permissions

### RSS Feeds Not Loading
- Verify the RSS feed URL is accessible
- Check browser console for CORS errors
- Some RSS feeds may not work due to CORS restrictions

### Videos Not Playing
- Ensure video URLs are accessible
- Check that the video format is supported by the browser
- Verify that autoplay policies are met (videos should be muted for autoplay)

## License

This project is open source and available under the MIT License.
