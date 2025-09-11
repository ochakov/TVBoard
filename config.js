// Configuration file for Digital Bulletin Board
// This file defines the layout and components to display

const BULLETIN_CONFIG = {
    // Application configuration
    app: {
        title: 'העצמאות 32 אשדוד', // Application title
        showTitle: true, // Whether to show the title in the navbar
        background: {
            enabled: true,
            imageUrl: 'files/background.png',
            overlay: 'rgba(0, 0, 0, 0.5)', // Dark overlay for better text readability
            position: 'center',
            size: 'cover', // Force exact viewport sizing
            repeat: 'no-repeat'
        }
    },
    
    // Language configuration
    language: {
        selected: 'he', // 'en' for English, 'he' for Hebrew
        rtl: true, // Right-to-left layout for Hebrew
        dateFormat: 'he-IL', // Locale for date formatting
        timeFormat: 'he-IL' // Locale for time formatting
    },
    
    // Layout configuration
    layout: {
        columns: 3, // Number of columns in the grid
        autoRefresh: 30000, // Auto-refresh interval in milliseconds (30 seconds)
        weatherUpdateInterval: 600000 // Weather update interval in milliseconds (10 minutes)
    },
    
    // Weather configuration
    weather: {
        enabled: true,
        apiKey: '41480eb8bcf34cc5bd37f97011adeece', // Replace with your OpenWeather API key
        city: 'Ashdod', // Default city
        units: 'metric', // metric, imperial, or kelvin
        useAppLanguage: true // Use the selected app language for weather descriptions
    },
    
    // Components configuration
    components: [
        {
            id: 'no-smoking',
            type: 'text',
            title: 'אסור לעשן',
            size: 'small',
            config: {
                text: '🚭\n\nחל איסור עישון בכל שטחי הבניין',
                fontSize: '3.5rem',
                fontWeight: '600',
                color: '#e74c3c',
                refreshInterval: 0
            }
        },
        {
            id: 'maariv-news',
            type: 'rss',
            title: 'חדשות',
            size: 'medium',
            config: {
                feedUrl: 'https://www.maariv.co.il/Rss/RssFeedsMivzakiChadashot',
                maxItems: 5,
                refreshInterval: 300000, // 5 minutes
                showImages: false
            }
        },
        {
            id: 'image-camera',
            type: 'image',
            title: 'אזהרה',
            size: 'small',
            config: {
                imageUrl: 'files/camera_enhanced.png',
                altText: 'Camera Warning',
                refreshInterval: 0
            }
        },
        {
            id: 'rss-messages',
            type: 'rss',
            title: 'הודעות',
            size: 'small',
            config: {
                feedUrl: 'firebase://messages', // Use Firebase messages instead of local JSON
                maxItems: 5,
                refreshInterval: 300000, // 5 minutes
                showImages: false
            }
        },
        {
            id: 'video-music',
            type: 'video',
            title: 'מוזיקת רקע',
            size: 'small',
            config: {
                videoUrls: [
                    'https://devisrael.z39.web.core.windows.net/files/mp4/CalmHeb1.mp4',
                    'https://devisrael.z39.web.core.windows.net/files/mp4/Shlomo1.mp4',
                    'https://devisrael.z39.web.core.windows.net/files/mp4/Arik1.mp4',
                    'https://devisrael.z39.web.core.windows.net/files/mp4/Golan1.mp4',
                    'https://devisrael.z39.web.core.windows.net/files/mp4/LoveHeb1.mp4',
                    'https://devisrael.z39.web.core.windows.net/files/mp4/LoveHeb2.mp4'
                ],
                autoplay: true,
                loop: true,
                muted: false,
                refreshInterval: 0,
                randomizeStart: true, // Randomize initial video and starting position
                minVideoLength: 30 // Only randomize position for videos longer than this (seconds)
            }
        }
    ]
};

// Language translations
const TRANSLATIONS = {
    en: {
        loading: 'Loading...',
        failedToLoad: 'Failed to load',
        noData: 'No data available',
        weatherError: 'Weather unavailable',
        rssError: 'RSS feed unavailable',
        videoError: 'Video unavailable',
        imageError: 'Image unavailable',
        timeoutError: 'Loading timeout',
        networkError: 'Network error'
    },
    he: {
        loading: 'טוען...',
        failedToLoad: 'נכשל בטעינה',
        noData: 'אין נתונים זמינים',
        weatherError: 'מזג אוויר לא זמין',
        rssError: 'עדכוני RSS לא זמינים',
        videoError: 'וידאו לא זמין',
        imageError: 'תמונה לא זמינה',
        timeoutError: 'זמן טעינה פג',
        networkError: 'שגיאת רשת'
    }
};

// Size configurations for responsive grid
const SIZE_CONFIG = {
    small: { cols: 4, height: '400px' }, // 3 boxes per row (4+4+4=12)
    medium: { cols: 8, height: '400px' }, // 1-2 boxes per row, fills width better
    large: { cols: 12, height: '600px' } // 1 box per row (12/12 = 1)
};
