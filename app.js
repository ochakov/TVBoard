// Digital Bulletin Board Application
class BulletinBoard {
    constructor() {
        this.config = null;
        this.components = new Map();
        this.weatherData = null;
        this.translations = null;
        this.sizeConfig = null;
        this.currentLanguage = 'he'; // Default language
        this.configService = window.configService;
        this.isInitialized = false;

        // Scheduler properties
        this.originalComponents = new Map(); // Store original configs to revert
        this.activeScheduleIds = new Set();
        this.sunTimes = { sunrise: null, sunset: null };
        this.schedulerInterval = null;

        this.init();
    }

    async init() {
        try {
            // Check if page was reloaded due to config change
            this.checkConfigChangeReload();

            // Load configuration first
            await this.loadConfiguration();

            // Initialize the application
            this.setupLanguage();
            this.updateDateTime();
            this.setupDateTimeInterval();
            this.setupWeather();
            this.loadComponents();
            this.setupAutoRefresh();
            this.setupResizeListener();
            this.registerServiceWorker();
            this.setupFullscreen();
            this.setupConfigChangeListener();
            this.setupPageUnloadCleanup();
            this.setupScheduler();

            this.isInitialized = true;
            console.log('BulletinBoard initialized successfully');
        } catch (error) {
            console.error('Failed to initialize BulletinBoard:', error);
            this.showError('Failed to load configuration. Please check your setup.');
        }
    }

    async loadConfiguration() {
        console.log('Loading configuration...');
        await this.configService.loadConfig();

        this.config = this.configService.getConfig();
        this.translations = this.configService.getTranslations();
        this.sizeConfig = this.configService.getSizeConfig();
        this.currentLanguage = this.config.language.selected;

        console.log('Configuration loaded:', {
            source: this.configService.isUsingFirebase() ? 'Firebase' : 'Local',
            language: this.currentLanguage,
            components: this.config.components.length
        });
    }

    setupConfigChangeListener() {
        // Listen for configuration changes from Firebase
        this.configService.addChangeListener((type, data) => {
            console.log(`Configuration changed: ${type}`);

            switch (type) {
                case 'config':
                    this.config = data;
                    this.currentLanguage = data.language.selected;
                    this.reloadApplication();
                    break;
                case 'translations':
                    this.translations = data;
                    this.updateLanguageElements();
                    break;
                case 'sizeConfig':
                    this.sizeConfig = data;
                    this.reloadComponents();
                    break;
            }
        });
    }

    // Check if page was reloaded due to config change and show notification
    checkConfigChangeReload() {
        if (this.configService.wasReloadedForConfigChange()) {
            console.log('🔄 Page was reloaded due to remote config change');

            // Show a temporary notification
            this.showConfigChangeNotification();
        }
    }

    // Show notification that config was updated
    showConfigChangeNotification() {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'alert alert-info alert-dismissible fade show position-fixed';
        notification.style.cssText = `
            top: 80px;
            right: 20px;
            z-index: 9999;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;

        notification.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas fa-sync-alt text-info me-2"></i>
                <div>
                    <strong>תצורה עודכנה</strong><br>
                    <small>הדף נטען מחדש עם התצורה החדשה</small>
                </div>
                <button type="button" class="btn-close ms-auto" data-bs-dismiss="alert"></button>
            </div>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    // Setup cleanup when page unloads
    setupPageUnloadCleanup() {
        window.addEventListener('beforeunload', () => {
            // Cleanup config service monitoring
            if (this.configService && typeof this.configService.destroy === 'function') {
                this.configService.destroy();
            }

            // Cleanup any retry timers
            this.cleanupAllRetryTimers();
        });

        // Also cleanup on visibility change (when tab becomes hidden)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Page is now hidden, could cleanup some resources
                console.log('Page hidden - config monitoring continues');
            } else {
                // Page is now visible again
                console.log('Page visible again');
            }
        });
    }

    reloadApplication() {
        console.log('Reloading application due to configuration change...');

        // Clear existing components
        this.components.clear();
        const gridElement = document.getElementById('bulletin-grid');
        if (gridElement) {
            gridElement.innerHTML = '';
        }

        // Reinitialize
        this.setupLanguage();
        this.setupWeather();
        this.loadComponents();
        this.setupAutoRefresh();
    }

    reloadComponents() {
        console.log('Reloading components due to size configuration change...');
        this.loadComponents();
    }

    updateLanguageElements() {
        // Update any language-dependent elements
        this.updateDateTime();
    }

    showError(message) {
        const gridElement = document.getElementById('bulletin-grid');
        if (gridElement) {
            gridElement.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-danger" role="alert">
                        <h4 class="alert-heading">Configuration Error</h4>
                        <p>${message}</p>
                        <hr>
                        <p class="mb-0">Please check the browser console for more details.</p>
                    </div>
                </div>
            `;
        }
    }

    // Language Setup
    setupLanguage() {
        // Set document language and direction
        document.documentElement.lang = this.currentLanguage;
        document.documentElement.dir = this.config.language.rtl ? 'rtl' : 'ltr';

        // Update app title from configuration
        const titleElement = document.getElementById('app-title');
        if (titleElement && this.config.app.showTitle) {
            titleElement.textContent = this.config.app.title;
            titleElement.style.display = 'block';
        } else if (titleElement) {
            titleElement.style.display = 'none';
        }

        // Update page title
        document.title = this.config.app.title;

        // Setup background image
        this.setupBackground();
    }

    // Translation helper
    getTranslation(key) {
        return this.translations[this.currentLanguage]?.[key] || this.translations['en'][key] || key;
    }

    // Service Worker Registration
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            // Register immediately - no need to wait for 'load' event since we're already in DOMContentLoaded
            navigator.serviceWorker.register('/sw.js', {
                updateViaCache: 'none' // Always check for updates
            })
                .then(registration => {
                    console.log('✅ Service Worker registered successfully:', registration);

                    // If there's a waiting service worker, activate it immediately
                    if (registration.waiting) {
                        console.log('⚠️ New service worker waiting, activating...');
                        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                    }

                    // Listen for new service worker installations
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        console.log('🔄 New service worker installing...');

                        newWorker.addEventListener('statechange', () => {
                            console.log('Service worker state changed to:', newWorker.state);

                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New service worker available, reload to activate
                                console.log('🔄 New service worker installed, reloading page...');
                                window.location.reload();
                            }
                        });
                    });

                    // Check for updates periodically
                    setInterval(() => {
                        registration.update();
                    }, 60000); // Check for SW updates every minute
                })
                .catch(registrationError => {
                    console.error('❌ Service Worker registration failed:', registrationError);
                });

            // Listen for controller change (when SW takes control)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('🔄 Service worker controller changed');

                // Check if this is the first time SW is taking control
                if (!sessionStorage.getItem('swControlled')) {
                    sessionStorage.setItem('swControlled', 'true');
                    console.log('🔄 First time under service worker control, reloading...');
                    window.location.reload();
                }
            });

            // Check if already controlled
            if (navigator.serviceWorker.controller) {
                console.log('✅ Page is already controlled by service worker');
                sessionStorage.setItem('swControlled', 'true');
            } else {
                console.log('⚠️ Page is not yet controlled by service worker');
            }
        } else {
            console.warn('⚠️ Service Workers are not supported in this browser');
        }
    }

    // Video Cache Management Functions
    async sendMessageToServiceWorker(message) {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            return new Promise((resolve, reject) => {
                const messageChannel = new MessageChannel();
                messageChannel.port1.onmessage = (event) => {
                    if (event.data.success) {
                        resolve(event.data);
                    } else {
                        reject(new Error(event.data.error || 'Service worker message failed'));
                    }
                };

                navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2]);
            });
        } else {
            throw new Error('Service worker not available');
        }
    }

    async getVideoCacheStatus() {
        try {
            const result = await this.sendMessageToServiceWorker({ type: 'GET_VIDEO_CACHE_STATUS' });
            console.log('Video cache status:', result);
            return result;
        } catch (error) {
            console.error('Failed to get video cache status:', error);
            return { success: false, error: error.message };
        }
    }

    async cleanupVideoCache() {
        try {
            const result = await this.sendMessageToServiceWorker({ type: 'CLEANUP_VIDEO_CACHE' });
            console.log('Video cache cleanup completed');
            return result;
        } catch (error) {
            console.error('Failed to cleanup video cache:', error);
            return { success: false, error: error.message };
        }
    }

    async clearVideoCache() {
        try {
            const result = await this.sendMessageToServiceWorker({ type: 'CLEAR_VIDEO_CACHE' });
            console.log('Video cache cleared');
            return result;
        } catch (error) {
            console.error('Failed to clear video cache:', error);
            return { success: false, error: error.message };
        }
    }

    // Test video caching by making a direct fetch request
    async testVideoCache() {
        try {
            const testVideoUrl = 'https://devisrael.z39.web.core.windows.net/files/mp4/CalmHeb1.mp4';
            console.log('Testing video cache with URL:', testVideoUrl);

            // Make a fetch request that should be intercepted by the service worker
            const response = await fetch(testVideoUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'video/mp4,video/*'
                }
            });

            console.log('Video fetch response:', {
                status: response.status,
                headers: Object.fromEntries(response.headers.entries()),
                url: response.url
            });

            return response.ok;
        } catch (error) {
            console.error('Video cache test failed:', error);
            return false;
        }
    }

    // Fullscreen Setup
    setupFullscreen() {
        // Request fullscreen on user interaction
        const requestFullscreen = () => {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen();
            } else if (document.documentElement.webkitRequestFullscreen) {
                document.documentElement.webkitRequestFullscreen();
            } else if (document.documentElement.msRequestFullscreen) {
                document.documentElement.msRequestFullscreen();
            }
        };

        // Add click listener to request fullscreen
        document.addEventListener('click', requestFullscreen, { once: true });

        // Add keyboard listener for F11 key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F11') {
                e.preventDefault();
                requestFullscreen();
            }
        });

        // Handle fullscreen change events
        document.addEventListener('fullscreenchange', () => {
            if (document.fullscreenElement) {
                console.log('Entered fullscreen mode');
            } else {
                console.log('Exited fullscreen mode');
            }
        });
    }

    // Background Setup
    setupBackground() {
        if (this.config.app.background && this.config.app.background.enabled) {
            const body = document.body;
            const bg = this.config.app.background;

            // Apply background image with proper sizing
            body.style.backgroundImage = `url('${bg.imageUrl}')`;
            body.style.backgroundPosition = bg.position || 'center';
            body.style.backgroundSize = bg.size || '100% 100%';
            body.style.backgroundRepeat = bg.repeat || 'no-repeat';
            body.style.backgroundAttachment = 'fixed';

            // Add overlay if specified
            if (bg.overlay) {
                // Create overlay element
                let overlay = document.getElementById('background-overlay');
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.id = 'background-overlay';
                    overlay.style.backgroundColor = bg.overlay;
                    document.body.appendChild(overlay);
                } else {
                    overlay.style.backgroundColor = bg.overlay;
                }
            }
        }
    }

    // Date and Time Functions
    updateDateTime() {
        const now = new Date();
        const dateElement = document.getElementById('current-date');
        const timeElement = document.getElementById('current-time');

        if (dateElement) {
            dateElement.textContent = now.toLocaleDateString(this.config.language.dateFormat, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        if (timeElement) {
            timeElement.textContent = now.toLocaleTimeString(this.config.language.timeFormat, {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
    }

    setupDateTimeInterval() {
        setInterval(() => {
            this.updateDateTime();
        }, 1000);
    }

    // Weather Functions
    async setupWeather() {
        if (!this.config.weather.enabled) return;

        try {
            await this.fetchWeather();
            this.setupWeatherInterval();
        } catch (error) {
            console.error('Weather setup failed:', error);
            this.displayWeatherError();
        }
    }

    async fetchWeather() {
        if (!this.config.weather.apiKey || this.config.weather.apiKey === 'YOUR_OPENWEATHER_API_KEY') {
            this.displayWeatherPlaceholder();
            return;
        }

        const apiKey = this.config.weather.apiKey;
        const city = encodeURIComponent(this.config.weather.city);
        const units = this.config.weather.units;

        // Map language codes to OpenWeatherMap supported languages
        const weatherLanguageMap = {
            'he': 'he', // Hebrew
            'en': 'en', // English
            'ar': 'ar', // Arabic
            'es': 'es', // Spanish
            'fr': 'fr', // French
            'de': 'de', // German
            'it': 'it', // Italian
            'pt': 'pt', // Portuguese
            'ru': 'ru', // Russian
            'zh': 'zh_cn', // Chinese
            'ja': 'ja', // Japanese
            'ko': 'kr' // Korean
        };

        // Use app language if configured to do so, otherwise default to English
        const weatherLang = this.config.weather.useAppLanguage ?
            (weatherLanguageMap[this.currentLanguage] || 'en') : 'en';

        const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=${units}&lang=${weatherLang}`;

        try {
            console.log(`Fetching weather for ${city} in language: ${weatherLang}`);
            const response = await fetch(url);
            if (!response.ok) throw new Error('Weather API request failed');

            const data = await response.json();
            this.weatherData = data;

            // Store sun times for scheduler
            if (data.sys) {
                this.sunTimes = {
                    sunrise: data.sys.sunrise,
                    sunset: data.sys.sunset
                };
                console.log('Sun times updated:', this.sunTimes);
            }

            console.log('Weather data received:', data.weather[0].description);
            this.displayWeather();
        } catch (error) {
            console.error('Weather fetch failed:', error);
            this.displayWeatherError();
        }
    }

    displayWeather() {
        if (!this.weatherData) return;

        const tempElement = document.getElementById('weather-temp');
        const descElement = document.getElementById('weather-desc');

        if (tempElement) {
            const temp = Math.round(this.weatherData.main.temp);
            const unit = this.config.weather.units === 'metric' ? '°C' : '°F';
            tempElement.textContent = `${temp}${unit}`;
        }

        if (descElement) {
            descElement.textContent = this.weatherData.weather[0].description;
        }
    }

    displayWeatherPlaceholder() {
        const tempElement = document.getElementById('weather-temp');
        const descElement = document.getElementById('weather-desc');

        if (tempElement) tempElement.textContent = '22°C';
        if (descElement) descElement.textContent = 'Sunny';
    }

    displayWeatherError() {
        const tempElement = document.getElementById('weather-temp');
        const descElement = document.getElementById('weather-desc');

        if (tempElement) tempElement.textContent = '--°C';
        if (descElement) descElement.textContent = 'N/A';
    }

    setupWeatherInterval() {
        setInterval(() => {
            this.fetchWeather();
        }, this.config.layout.weatherUpdateInterval);
    }

    // Component Loading Functions
    loadComponents() {
        const gridElement = document.getElementById('bulletin-grid');
        if (!gridElement) {
            console.error('Bulletin grid element not found');
            return;
        }

        gridElement.innerHTML = '';

        this.config.components.forEach(component => {
            const componentElement = this.createComponent(component);
            if (componentElement) {
                gridElement.appendChild(componentElement);
                this.components.set(component.id, {
                    element: componentElement,
                    config: component,
                    lastUpdate: Date.now()
                });

                // Load component content after DOM element is added
                setTimeout(() => {
                    this.loadComponentContent(component);
                }, 100); // Small delay to ensure DOM is ready
            }
        });
    }

    createComponent(componentConfig) {
        const sizeConfig = this.sizeConfig[componentConfig.size] || this.sizeConfig.medium;
        const colClass = `col-lg-${sizeConfig.cols} col-md-${sizeConfig.cols} col-sm-12 mb-4`;

        const wrapper = document.createElement('div');
        wrapper.className = colClass;
        wrapper.innerHTML = `
            <div class="bulletin-box" style="height: ${sizeConfig.height}">
                <div class="box-header">
                    <i class="fas ${this.getComponentIcon(componentConfig.type)} me-2"></i>
                    ${componentConfig.title}
                </div>
                <div class="box-content" id="content-${componentConfig.id}">
                    <div class="loading">
                        <div class="spinner-border" role="status">
                            <span class="visually-hidden">${this.getTranslation('loading')}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        return wrapper;
    }

    getComponentIcon(type) {
        const icons = {
            image: 'fa-image',
            rss: 'fa-rss',
            video: 'fa-play-circle',
            text: 'fa-font'
        };
        return icons[type] || 'fa-square';
    }

    async loadComponentContent(componentConfig) {
        // Try to find the content element, with retry mechanism
        let contentElement = document.getElementById(`content-${componentConfig.id}`);

        if (!contentElement) {
            console.warn(`Content element not found for component: ${componentConfig.id}, retrying...`);
            // Wait a bit and try again
            await new Promise(resolve => setTimeout(resolve, 200));
            contentElement = document.getElementById(`content-${componentConfig.id}`);
        }

        if (!contentElement) {
            console.error(`Content element still not found for component: ${componentConfig.id} after retry`);
            return;
        }

        try {
            console.log(`Loading component: ${componentConfig.id} (${componentConfig.type})`);

            // Clean up any existing retry timers for this component
            this.cleanupComponentRetryTimers(contentElement);

            switch (componentConfig.type) {
                case 'image':
                    await this.loadImageComponent(componentConfig, contentElement);
                    break;
                case 'rss':
                    await this.loadRSSComponent(componentConfig, contentElement);
                    break;
                case 'video':
                    await this.loadVideoComponent(componentConfig, contentElement);
                    break;
                case 'text':
                    await this.loadTextComponent(componentConfig, contentElement);
                    break;
                default:
                    console.error(`Unknown component type: ${componentConfig.type}`);
                    contentElement.innerHTML = `<div class="error-message">Unknown component type: ${componentConfig.type}</div>`;
            }
        } catch (error) {
            console.error(`Error loading component ${componentConfig.id}:`, error);
            if (contentElement) {
                contentElement.innerHTML = `<div class="error-message">Failed to load content<br><small>${error.message}</small></div>`;
            }
        }
    }

    // Clean up retry timers for a component
    cleanupComponentRetryTimers(element) {
        if (element.videoRetryInfo && element.videoRetryInfo.retryTimer) {
            console.log('Cleaning up video retry timer');
            clearTimeout(element.videoRetryInfo.retryTimer);
            element.videoRetryInfo.retryTimer = null;
        }
        // Cleanup slideshow interval
        if (element.slideshowInterval) {
            console.log('Cleaning up slideshow interval');
            clearInterval(element.slideshowInterval);
            element.slideshowInterval = null;
        }
    }

    // Clean up all retry timers (called on page unload)
    cleanupAllRetryTimers() {
        console.log('Cleaning up all retry timers');
        const contentElements = document.querySelectorAll('[id^="content-"]');
        contentElements.forEach(element => {
            this.cleanupComponentRetryTimers(element);
        });
    }

    async loadImageComponent(config, element) {
        // Handle slideshow if imageUrls is present and has more than one image
        if (config.config.imageUrls && config.config.imageUrls.length > 1) {
            this.loadSlideshowComponent(config, element);
            return;
        }

        // Fallback to single image
        const imageUrl = config.config.imageUrl || (config.config.imageUrls && config.config.imageUrls[0]);

        if (!imageUrl) {
            element.innerHTML = `<div class="error-message">${this.getTranslation('noData')}</div>`;
            return;
        }

        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = config.config.altText || '';
        img.className = 'img-fluid image-component';

        // Add a timeout to prevent infinite loading
        const timeout = setTimeout(() => {
            if (element.querySelector('.loading')) {
                element.innerHTML = `<div class="error-message">${this.getTranslation('timeoutError')} - ${this.getTranslation('imageError')}</div>`;
            }
        }, 10000); // 10 second timeout

        img.onload = () => {
            clearTimeout(timeout);
            element.innerHTML = '';
            element.appendChild(img);
        };

        img.onerror = (error) => {
            clearTimeout(timeout);
            console.error('Image loading failed:', imageUrl, error);
            element.innerHTML = `<div class="error-message">${this.getTranslation('imageError')}<br><small>URL: ${imageUrl}</small></div>`;
        };
    }

    loadSlideshowComponent(config, element) {
        // IMPORTANT: Clear any existing slideshow interval to prevent memory leaks
        // This can happen when schedule overrides are applied/removed
        const componentData = this.components.get(config.id);
        if (componentData && componentData.slideshowInterval) {
            console.log(`Clearing existing slideshow interval for ${config.id}`);
            clearInterval(componentData.slideshowInterval);
            componentData.slideshowInterval = null;
        }

        const imageUrls = config.config.imageUrls;
        const interval = config.config.interval || 5000; // Default 5 seconds
        const transitionDuration = config.config.transitionDuration || 1000; // Default 1 second

        console.log(`Starting slideshow for ${config.id} with interval: ${interval}ms`);

        // Create container
        const container = document.createElement('div');
        container.className = 'slideshow-container';
        element.innerHTML = '';
        element.appendChild(container);

        let currentIndex = 0;
        let slides = [];

        // Preload and create slides
        imageUrls.forEach((url, index) => {
            const img = document.createElement('img');
            img.src = url;
            img.className = `slide-image ${index === 0 ? 'active' : ''}`;
            img.style.transition = `opacity ${transitionDuration}ms ease-in-out`;
            container.appendChild(img);
            slides.push(img);
        });

        // Start slideshow
        const slideshowInterval = setInterval(() => {
            const nextIndex = (currentIndex + 1) % slides.length;

            console.log(`Slideshow ${config.id}: changing from image ${currentIndex} to ${nextIndex}`);

            // Fade out current
            slides[currentIndex].classList.remove('active');

            // Fade in next
            slides[nextIndex].classList.add('active');

            currentIndex = nextIndex;
        }, interval);

        // Store interval in component data for proper cleanup
        if (componentData) {
            componentData.slideshowInterval = slideshowInterval;
        }
    }

    async loadRSSComponent(config, element) {
        try {
            // Add timeout for RSS requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

            let data;

            // Check if this is a Firebase messages request
            if (config.config.feedUrl === 'firebase://messages' || config.config.feedUrl.startsWith('firebase://messages/')) {
                clearTimeout(timeoutId);

                // Extract config ID from URL or use current config ID
                let configId;
                if (config.config.feedUrl.startsWith('firebase://messages/')) {
                    configId = config.config.feedUrl.replace('firebase://messages/', '');
                } else {
                    configId = this.configService.getCurrentConfigId();
                }

                if (!configId) {
                    throw new Error('No configuration ID available for Firebase messages');
                }

                if (!window.messagesService || !window.messagesService.isAvailable()) {
                    throw new Error('Firebase messages service not available');
                }

                // Load messages from Firebase
                data = await window.messagesService.getMessages(configId);

            } else if (config.config.feedUrl.endsWith('.json') || config.config.feedUrl.startsWith('files/')) {
                // Direct JSON fetch for local files or JSON URLs
                const response = await fetch(config.config.feedUrl, {
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`JSON fetch failed: ${response.status} ${response.statusText}`);
                }

                data = await response.json();

                // Handle direct JSON format (assuming it has items array)
                if (data.items && Array.isArray(data.items)) {
                    // Already in the expected format
                } else if (Array.isArray(data)) {
                    // If the JSON is directly an array of items
                    data = { items: data };
                } else {
                    throw new Error('Invalid JSON format: expected items array or direct array');
                }
            } else {
                // Use RSS2JSON API for external RSS feeds
                const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(config.config.feedUrl)}`, {
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`RSS fetch failed: ${response.status} ${response.statusText}`);
                }

                data = await response.json();

                if (data.status !== 'ok') {
                    throw new Error(data.message || 'RSS parsing failed');
                }
            }

            const items = data.items.slice(0, config.config.maxItems);
            if (items.length === 0) {
                element.innerHTML = `<div class="error-message">${this.getTranslation('noData')}</div>`;
                return;
            }

            const html = items.map(item => {
                let imageHtml = '';

                // Check if showImages is enabled and item has an image
                if (config.config.showImages && item.thumbnail) {
                    imageHtml = `<img src="${this.escapeHtml(item.thumbnail)}" alt="${this.escapeHtml(item.title || '')}" class="rss-icon">`;
                }

                // Get font styling from config with defaults
                const titleFontSize = config.config.titleFontSize || '1rem';
                const titleFontWeight = config.config.titleFontWeight || '600';
                const dateFontSize = config.config.dateFontSize || '0.8rem';
                const dateFontWeight = config.config.dateFontWeight || '400';

                return `
                    <div class="rss-item">
                        ${imageHtml}
                        <div class="rss-content">
                            <div class="rss-title" style="font-size: ${titleFontSize}; font-weight: ${titleFontWeight};">${this.escapeHtml(item.title)}</div>
                            <div class="rss-date" style="font-size: ${dateFontSize}; font-weight: ${dateFontWeight};">${new Date(item.pubDate).toLocaleDateString(this.config.language.dateFormat)}</div>
                        </div>
                    </div>
                `;
            }).join('');

            element.innerHTML = `<div class="rss-feed">${html}</div>`;

        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('RSS fetch timed out');
                element.innerHTML = `<div class="error-message">${this.getTranslation('timeoutError')}</div>`;
            } else {
                console.error('RSS loading error:', error);
                element.innerHTML = `<div class="error-message">${this.getTranslation('rssError')}<br><small>${error.message}</small></div>`;
            }
        }
    }

    async loadVideoComponent(config, element) {
        // Initialize retry info if not present
        if (!element.videoRetryInfo) {
            element.videoRetryInfo = {
                retryCount: 0,
                maxRetries: 3,
                retryInterval: 5000, // 5 seconds
                retryTimer: null
            };
        }

        const videoUrls = config.config.videoUrls;
        if (!videoUrls || videoUrls.length === 0) {
            element.innerHTML = `<div class="error-message">${this.getTranslation('noData')}</div>`;
            return;
        }

        // Determine which video to play
        let currentVideoIndex = 0;

        // Handle randomization if enabled
        if (config.config.randomizeStart) {
            // Pick a random video
            currentVideoIndex = Math.floor(Math.random() * videoUrls.length);
            console.log(`Randomized start: playing video index ${currentVideoIndex} (${videoUrls[currentVideoIndex]})`);
        }

        const video = document.createElement('video');
        video.className = 'video-component';
        video.controls = true; // Always show controls for better UX

        // Set attributes based on config
        if (config.config.autoplay) {
            video.autoplay = true;
            video.muted = config.config.muted !== false; // Default to muted if autoplay is on (browser policy)
        } else {
            video.muted = config.config.muted === true;
        }

        if (config.config.loop) {
            video.loop = true;
        }

        // Set source
        video.src = videoUrls[currentVideoIndex];

        // Add error handling
        video.onerror = (e) => {
            console.error('Video playback error:', video.error);

            // Try next video if available
            if (videoUrls.length > 1) {
                console.log('Trying next video in playlist...');
                currentVideoIndex = (currentVideoIndex + 1) % videoUrls.length;
                video.src = videoUrls[currentVideoIndex];
                video.play().catch(err => console.error('Failed to play next video:', err));
            } else {
                this.handleVideoError(config, element, `Error code: ${video.error ? video.error.code : 'unknown'}`);
            }
        };

        // Handle playlist if multiple videos
        if (videoUrls.length > 1 && !config.config.loop) {
            video.onended = () => {
                currentVideoIndex = (currentVideoIndex + 1) % videoUrls.length;
                video.src = videoUrls[currentVideoIndex];
                video.play().catch(e => console.error('Playlist playback error:', e));
            };
        }

        // Handle random start position for long videos
        if (config.config.randomizeStart) {
            video.addEventListener('loadedmetadata', () => {
                const duration = video.duration;
                const minLength = config.config.minVideoLength || 30;

                if (duration > minLength) {
                    // Start somewhere between 0 and 80% of the video
                    const randomTime = Math.random() * (duration * 0.8);
                    console.log(`Randomizing position: seeking to ${Math.round(randomTime)}s (duration: ${Math.round(duration)}s)`);
                    video.currentTime = randomTime;
                }
            }, { once: true });
        }

        element.innerHTML = '';
        element.appendChild(video);

        // Reset retry count on successful load (when video starts playing)
        video.onplaying = () => {
            if (element.videoRetryInfo) {
                element.videoRetryInfo.retryCount = 0;
            }
        };
    }

    handleVideoError(config, element, errorMessage) {
        const retryInfo = element.videoRetryInfo;

        if (!retryInfo) {
            console.error('No retry info available for video component');
            return;
        }

        retryInfo.retryCount++;

        console.log(`Video error for ${config.id}: ${errorMessage} (retry ${retryInfo.retryCount}/${retryInfo.maxRetries})`);

        // Show error message with retry information
        const nextRetryTime = new Date(Date.now() + retryInfo.retryInterval);
        const timeString = nextRetryTime.toLocaleTimeString();

        element.innerHTML = `
            <div class="error-message">
                ${this.getTranslation('videoError')}<br>
                <small>
                    ${errorMessage}<br>
                    Retry ${retryInfo.retryCount}/${retryInfo.maxRetries}<br>
                    Next attempt: ${timeString}
                </small>
            </div>
        `;

        // Schedule retry if we haven't exceeded max retries
        if (retryInfo.retryCount < retryInfo.maxRetries) {
            console.log(`Scheduling video retry for ${config.id} in ${retryInfo.retryInterval / 1000} seconds`);

            retryInfo.retryTimer = setTimeout(() => {
                console.log(`Retrying video load for ${config.id}`);
                this.loadVideoComponent(config, element);
            }, retryInfo.retryInterval);
        } else {
            console.error(`Max retries (${retryInfo.maxRetries}) reached for video ${config.id}, giving up`);
            element.innerHTML = `
                <div class="error-message">
                    ${this.getTranslation('videoError')}<br>
                    <small>
                        ${errorMessage}<br>
                        Max retries reached (${retryInfo.maxRetries})
                    </small>
                </div>
            `;
        }
    }

    async loadTextComponent(config, element) {
        try {
            const textDiv = document.createElement('div');
            textDiv.className = 'text-component';

            // Handle newline characters by converting \n to <br> tags
            const textWithBreaks = config.config.text.replace(/\n/g, '<br>');
            textDiv.innerHTML = textWithBreaks;

            // Apply styling from config
            textDiv.style.color = config.config.color || '#333';
            textDiv.style.backgroundColor = config.config.backgroundColor || 'transparent';
            textDiv.style.fontWeight = config.config.fontWeight || 'normal';

            // Handle font size
            if (config.config.fontSize === 'auto') {
                textDiv.style.fontSize = '1.2rem'; // Start larger for better visibility
                textDiv.classList.add('auto-scale-text');
            } else {
                textDiv.style.fontSize = config.config.fontSize;
            }

            element.innerHTML = '';
            element.appendChild(textDiv);

            // Auto-scale the text if needed
            if (config.config.fontSize === 'auto') {
                // Multiple attempts to ensure proper scaling
                this.autoScaleText(textDiv);
                setTimeout(() => this.autoScaleText(textDiv), 200);
                setTimeout(() => this.autoScaleText(textDiv), 500);
            }

        } catch (error) {
            console.error('Text component loading error:', error);
            element.innerHTML = `<div class="error-message">${this.getTranslation('failedToLoad')}</div>`;
        }
    }

    // Auto-scale text to fit container
    autoScaleText(textElement) {
        // Use multiple attempts to ensure proper scaling
        const attemptScaling = (attempt = 0) => {
            const container = textElement.parentElement;
            if (!container) return;

            // Get actual container dimensions
            const containerRect = container.getBoundingClientRect();
            const containerWidth = containerRect.width - 30; // Account for padding
            const containerHeight = containerRect.height - 30; // Account for padding

            if (containerWidth <= 0 || containerHeight <= 0) {
                if (attempt < 5) {
                    setTimeout(() => attemptScaling(attempt + 1), 100);
                }
                return;
            }

            // Reset text element for accurate measurement
            textElement.style.fontSize = '1.2rem';

            // Force layout recalculation
            textElement.offsetHeight;

            // Get text dimensions
            const textRect = textElement.getBoundingClientRect();
            const textWidth = textRect.width;
            const textHeight = textRect.height;

            // For multi-line text, we need to consider the actual content height
            const scrollHeight = textElement.scrollHeight;
            const actualHeight = Math.max(textHeight, scrollHeight);

            if (textWidth <= 0 || textHeight <= 0) {
                if (attempt < 5) {
                    setTimeout(() => attemptScaling(attempt + 1), 100);
                }
                return;
            }

            // Calculate scale factors using actual height for multi-line text
            const scaleX = containerWidth / textWidth;
            const scaleY = containerHeight / actualHeight;
            const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down

            // Apply the scale with less conservative margin
            const finalFontSize = Math.max(0.6, scale * 0.95);
            textElement.style.fontSize = finalFontSize + 'rem';

            // Verify it fits and adjust if needed
            setTimeout(() => {
                const newTextRect = textElement.getBoundingClientRect();
                const newScrollHeight = textElement.scrollHeight;
                const newActualHeight = Math.max(newTextRect.height, newScrollHeight);

                if (newTextRect.width > containerWidth || newActualHeight > containerHeight) {
                    // Still too big, reduce further but less aggressively
                    const adjustScale = Math.min(containerWidth / newTextRect.width, containerHeight / newActualHeight);
                    const adjustedSize = Math.max(0.5, finalFontSize * adjustScale * 0.98);
                    textElement.style.fontSize = adjustedSize + 'rem';
                }
            }, 10);
        };

        // Start the scaling process
        setTimeout(() => attemptScaling(), 100);
    }

    // Utility method to escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Auto-refresh Functions
    setupAutoRefresh() {
        setInterval(() => {
            this.refreshComponents();
        }, this.config.layout.autoRefresh);
    }

    // Setup resize listener for text auto-scaling
    setupResizeListener() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.rescaleAllTextComponents();
            }, 250); // Debounce resize events
        });
    }

    // Re-scale all text components on window resize
    rescaleAllTextComponents() {
        const textComponents = document.querySelectorAll('.auto-scale-text');
        textComponents.forEach(component => {
            // Reset font size first
            component.style.fontSize = '1.2rem';
            // Then scale it
            this.autoScaleText(component);
        });
    }

    refreshComponents() {
        this.config.components.forEach(component => {
            const componentData = this.components.get(component.id);
            if (!componentData) return;

            const now = Date.now();
            const refreshInterval = component.config.refreshInterval || 0;

            if (refreshInterval > 0 && (now - componentData.lastUpdate) >= refreshInterval) {
                this.loadComponentContent(component);
                componentData.lastUpdate = now;
            }
        });
    }

    // Scheduler Implementation
    setupScheduler() {
        console.log('Setting up scheduler...');

        // Check schedules every minute
        this.schedulerInterval = setInterval(() => {
            this.checkSchedules();
        }, 60000);

        // Initial check
        setTimeout(() => this.checkSchedules(), 5000);
    }

    async checkSchedules() {
        if (!this.config.schedules || this.config.schedules.length === 0) return;

        const now = new Date();
        const currentDay = now.getDay(); // 0-6 (Sunday-Saturday)
        const currentTime = now.getHours() * 60 + now.getMinutes(); // Minutes from midnight

        this.config.schedules.forEach(schedule => {
            // Check if schedule is active for today
            if (!schedule.activeDays.includes(currentDay)) {
                this.revertSchedule(schedule.id);
                return;
            }

            // Calculate start and end times in minutes from midnight
            const startTime = this.calculateTime(schedule.start, now);
            const endTime = this.calculateTime(schedule.end, now);

            if (startTime === null || endTime === null) {
                console.warn(`Could not calculate times for schedule ${schedule.id}`);
                return;
            }

            // Check if current time is within range
            // Handle overnight schedules (e.g. 22:00 to 06:00)
            let isActive = false;
            if (startTime <= endTime) {
                isActive = currentTime >= startTime && currentTime < endTime;
            } else {
                isActive = currentTime >= startTime || currentTime < endTime;
            }

            if (isActive) {
                if (!this.activeScheduleIds.has(schedule.id)) {
                    this.applySchedule(schedule);
                }
            } else {
                if (this.activeScheduleIds.has(schedule.id)) {
                    this.revertSchedule(schedule.id);
                }
            }
        });
    }

    calculateTime(timeConfig, now) {
        if (timeConfig.type === 'fixed') {
            const [hours, minutes] = timeConfig.value.split(':').map(Number);
            return hours * 60 + minutes;
        } else if (timeConfig.type === 'sunrise' || timeConfig.type === 'sunset') {
            if (!this.sunTimes[timeConfig.type]) return null;

            // Convert sun time (unix timestamp) to minutes from midnight
            const sunDate = new Date(this.sunTimes[timeConfig.type] * 1000);
            const sunMinutes = sunDate.getHours() * 60 + sunDate.getMinutes();

            return sunMinutes + (timeConfig.offsetMinutes || 0);
        }
        return null;
    }

    applySchedule(schedule) {
        console.log(`Applying schedule: ${schedule.id}`);
        this.activeScheduleIds.add(schedule.id);

        schedule.overrides.forEach(override => {
            // Store original config if not already stored
            if (!this.originalComponents.has(override.id)) {
                const originalComponent = this.components.get(override.id);
                if (originalComponent) {
                    this.originalComponents.set(override.id, {
                        config: JSON.parse(JSON.stringify(originalComponent.config))
                    });
                }
            }

            // Apply override
            this.updateComponentConfig(override.id, override);
        });
    }

    revertSchedule(scheduleId) {
        if (!this.activeScheduleIds.has(scheduleId)) return;

        console.log(`Reverting schedule: ${scheduleId}`);
        this.activeScheduleIds.delete(scheduleId);

        // Find schedule definition
        const schedule = this.config.schedules.find(s => s.id === scheduleId);
        if (!schedule) return;

        schedule.overrides.forEach(override => {
            // Check if any other active schedule is also overriding this component
            // If so, don't revert yet (or re-apply the other schedule's override)
            // For simplicity, we'll just revert to original if no other schedule claims it
            // A more complex priority system could be added later

            const original = this.originalComponents.get(override.id);
            if (original) {
                this.updateComponentConfig(override.id, original.config);
                this.originalComponents.delete(override.id);
            }
        });
    }

    updateComponentConfig(componentId, newConfig) {
        const componentData = this.components.get(componentId);
        if (!componentData) {
            console.warn(`Component ${componentId} not found for update`);
            return;
        }

        console.log(`Updating component ${componentId} with new config`);

        // IMPORTANT: Clear any existing slideshow interval before updating
        if (componentData.slideshowInterval) {
            console.log(`Clearing slideshow interval for ${componentId} before update`);
            clearInterval(componentData.slideshowInterval);
            componentData.slideshowInterval = null;
        }

        // Update stored config
        // Merge new config into existing one to preserve ID and other props if not specified
        const updatedConfig = { ...componentData.config, ...newConfig };
        componentData.config = updatedConfig;

        // Update UI
        const wrapper = componentData.element;

        // Update header title and icon
        const header = wrapper.querySelector('.box-header');
        if (header) {
            header.innerHTML = `
                <i class="fas ${this.getComponentIcon(updatedConfig.type)} me-2"></i>
                ${updatedConfig.title}
            `;
        }

        // Reload content
        const content = wrapper.querySelector('.box-content');
        if (content) {
            content.innerHTML = `
                <div class="loading">
                    <div class="spinner-border" role="status">
                        <span class="visually-hidden">${this.getTranslation('loading')}</span>
                    </div>
                </div>
            `;
            this.loadComponentContent(updatedConfig);
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        window.bulletinBoard = new BulletinBoard();
    } catch (error) {
        console.error('Failed to initialize application:', error);
    }
});

// Clean up retry timers when page is about to unload
window.addEventListener('beforeunload', () => {
    if (window.bulletinBoard) {
        window.bulletinBoard.cleanupAllRetryTimers();
    }
});

// Also clean up on page visibility change (when tab becomes hidden)
document.addEventListener('visibilitychange', () => {
    if (document.hidden && window.bulletinBoard) {
        console.log('Page hidden, cleaning up retry timers');
        window.bulletinBoard.cleanupAllRetryTimers();
    }
});
