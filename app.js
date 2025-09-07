// Digital Bulletin Board Application
class BulletinBoard {
    constructor() {
        this.config = BULLETIN_CONFIG;
        this.components = new Map();
        this.weatherData = null;
        this.translations = TRANSLATIONS;
        this.currentLanguage = this.config.language.selected;
        this.init();
    }

    init() {
        this.setupLanguage();
        this.updateDateTime();
        this.setupDateTimeInterval();
        this.setupWeather();
        this.loadComponents();
        this.setupAutoRefresh();
        this.setupResizeListener();
        this.registerServiceWorker();
        this.setupFullscreen();
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
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(registration => {
                        console.log('SW registered: ', registration);
                    })
                    .catch(registrationError => {
                        console.log('SW registration failed: ', registrationError);
                    });
            });
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
        const sizeConfig = SIZE_CONFIG[componentConfig.size] || SIZE_CONFIG.medium;
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

    async loadImageComponent(config, element) {
        const img = document.createElement('img');
        img.src = config.config.imageUrl;
        img.alt = config.config.altText;
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
            console.error('Image loading failed:', config.config.imageUrl, error);
            element.innerHTML = `<div class="error-message">${this.getTranslation('imageError')}<br><small>URL: ${config.config.imageUrl}</small></div>`;
        };
    }

    async loadRSSComponent(config, element) {
        try {
            // Add timeout for RSS requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
            
            let data;
            
            // Check if the URL is a JSON file (local file or direct JSON)
            if (config.config.feedUrl.endsWith('.json') || config.config.feedUrl.startsWith('files/')) {
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

            const html = items.map(item => `
                <div class="rss-item">
                    <h6>${this.escapeHtml(item.title || '')}</h6>
                    <p>${this.escapeHtml((item.description || '').replace(/<[^>]*>/g, ''))}</p>
                    <div class="rss-date">${item.pubDate ? new Date(item.pubDate).toLocaleDateString() : ''}</div>
                </div>
            `).join('');

            element.innerHTML = html;
        } catch (error) {
            console.error('RSS loading error:', error);
            if (error.name === 'AbortError') {
                element.innerHTML = `<div class="error-message">${this.getTranslation('timeoutError')} - ${this.getTranslation('rssError')}</div>`;
            } else {
                element.innerHTML = `<div class="error-message">${this.getTranslation('rssError')}<br><small>${error.message}</small></div>`;
            }
        }
    }

    async loadVideoComponent(config, element) {
        const video = document.createElement('video');
        video.controls = true;
        video.autoplay = config.config.autoplay;
        video.muted = config.config.muted;
        video.className = 'video-component';

        // Add timeout for video loading
        const timeout = setTimeout(() => {
            if (element.querySelector('.loading')) {
                element.innerHTML = `<div class="error-message">${this.getTranslation('timeoutError')} - ${this.getTranslation('videoError')}</div>`;
            }
        }, 20000); // 20 second timeout for videos

        // Set up video source rotation if multiple URLs
        if (config.config.videoUrls.length > 1) {
            let currentIndex = 0;
            video.src = config.config.videoUrls[currentIndex];
            video.loop = false; // Disable loop when cycling through multiple videos
            
            video.addEventListener('ended', () => {
                currentIndex = (currentIndex + 1) % config.config.videoUrls.length;
                video.src = config.config.videoUrls[currentIndex];
                video.load();
                if (config.config.autoplay) {
                    video.play();
                }
            });
        } else {
            video.src = config.config.videoUrls[0];
            video.loop = config.config.loop; // Only loop if there's a single video
        }

        video.onloadstart = () => {
            clearTimeout(timeout);
        };

        video.onerror = (error) => {
            clearTimeout(timeout);
            console.error('Video loading failed:', config.config.videoUrls, error);
            element.innerHTML = `<div class="error-message">${this.getTranslation('videoError')}<br><small>URL: ${config.config.videoUrls[0]}</small></div>`;
        };

        video.oncanplay = () => {
            clearTimeout(timeout);
        };

        element.innerHTML = '';
        element.appendChild(video);
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
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BulletinBoard();
});
