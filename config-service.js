// Configuration Service
// Handles loading configuration from Firebase Realtime Database with fallback to local config

class ConfigService {
    constructor() {
        this.config = null;
        this.translations = null;
        this.sizeConfig = null;
        this.isFirebaseEnabled = false;
        this.configLoadPromise = null;
        this.listeners = new Set();
        this.configId = null;

        // Check if Firebase is available
        this.isFirebaseEnabled = window.firebaseDatabase !== null && window.firebaseDatabase !== undefined;

        console.log('ConfigService initialized. Firebase enabled:', this.isFirebaseEnabled);
    }

    // Get or prompt for configuration ID
    async getConfigId() {
        if (this.configId) {
            return this.configId;
        }

        // Check if ID is stored in localStorage
        const storedId = localStorage.getItem('bulletinBoardConfigId');
        if (storedId) {
            this.configId = storedId;
            console.log('Using stored configuration ID:', this.configId);
            return this.configId;
        }

        // Prompt user for configuration ID
        return new Promise((resolve) => {
            this.showConfigIdPrompt(resolve);
        });
    }

    showConfigIdPrompt(callback) {
        // Load local config first to get language settings
        if (!this.config) {
            this._loadFromLocal();
        }

        // Use Hebrew interface (RTL)
        const isRTL = this.config?.language?.rtl || true;
        const direction = isRTL ? 'rtl' : 'ltr';

        // Create modal dialog for configuration ID input in Hebrew
        const modalHtml = `
            <div class="modal fade" id="configIdModal" tabindex="-1" aria-labelledby="configIdModalLabel" aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false" dir="${direction}">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="configIdModalLabel">
                                <i class="fas fa-cog me-2"></i>הגדרת תצורה
                            </h5>
                        </div>
                        <div class="modal-body">
                            <div class="mb-4">
                                <h6 class="mb-3">ברוכים הבאים ללוח המודעות הדיגיטלי!</h6>
                                <p class="mb-3">בחר כיצד תרצה להפעיל את האפליקציה:</p>

                                <div class="card border-success mb-3">
                                    <div class="card-body">
                                        <h6 class="card-title text-success">
                                            <i class="fas fa-cloud me-2"></i>תצורה מ-Firebase (מומלץ)
                                        </h6>
                                        <p class="card-text small mb-2">
                                            טען הגדרות מותאמות אישית מהענן. מאפשר ניהול מרחוק ועדכונים בזמן אמת.
                                        </p>
                                        <div class="mb-2">
                                            <input type="text" class="form-control form-control-sm" id="configIdInput" placeholder="הכנס מזהה תצורה (לדוגמה: lobby-display)" autocomplete="off">
                                        </div>
                                        <div class="form-check">
                                            <input class="form-check-input" type="checkbox" id="rememberConfigId" checked>
                                            <label class="form-check-label small" for="rememberConfigId">
                                                זכור בחירה זו
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div class="card border-secondary">
                                    <div class="card-body">
                                        <h6 class="card-title text-secondary">
                                            <i class="fas fa-home me-2"></i>תצורה מקומית
                                        </h6>
                                        <p class="card-text small mb-0">
                                            השתמש בהגדרות המוגדרות מראש. מתאים לבדיקות או שימוש זמני.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-secondary" id="useLocalConfigBtn">
                                <i class="fas fa-home me-2"></i>השתמש בתצורה מקומית
                            </button>
                            <button type="button" class="btn btn-success btn-lg" id="loadConfigBtn">
                                <i class="fas fa-cloud me-2"></i>התחל עם Firebase
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Initialize Bootstrap modal
        const modalElement = document.getElementById('configIdModal');
        const modal = new bootstrap.Modal(modalElement);
        const configIdInput = document.getElementById('configIdInput');
        const loadConfigBtn = document.getElementById('loadConfigBtn');
        const useLocalConfigBtn = document.getElementById('useLocalConfigBtn');
        const rememberCheckbox = document.getElementById('rememberConfigId');

        // Focus on input when modal is shown and add placeholder text
        modalElement.addEventListener('shown.bs.modal', () => {
            configIdInput.focus();
            configIdInput.placeholder = 'לדוגמה: lobby-display, office-board, main-hall';
        });

        // Handle Enter key in input - default to Firebase action
        configIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                loadConfigBtn.click();
            }
        });

        // Visual feedback when input has content
        configIdInput.addEventListener('input', () => {
            if (configIdInput.value.trim()) {
                loadConfigBtn.style.transform = 'scale(1.05)';
                loadConfigBtn.style.boxShadow = '0 4px 12px rgba(40, 167, 69, 0.3)';
            } else {
                loadConfigBtn.style.transform = 'scale(1)';
                loadConfigBtn.style.boxShadow = 'none';
            }
        });

        // Handle use local config button (primary action)
        useLocalConfigBtn.addEventListener('click', () => {
            this.configId = null; // Use local config

            // Remember this choice if checkbox is checked
            if (rememberCheckbox.checked) {
                localStorage.setItem('bulletinBoardConfigChoice', 'local');
                console.log('Local configuration choice saved');
            }

            modal.hide();
            modalElement.addEventListener('hidden.bs.modal', () => {
                modalElement.remove();
                callback(null);
            });
        });

        // Handle load configuration button (now secondary action)
        loadConfigBtn.addEventListener('click', () => {
            const configId = configIdInput.value.trim();
            if (!configId) {
                configIdInput.classList.add('is-invalid');
                return;
            }

            configIdInput.classList.remove('is-invalid');
            this.configId = configId;

            // Store ID if remember is checked
            if (rememberCheckbox.checked) {
                localStorage.setItem('bulletinBoardConfigId', configId);
                console.log('Configuration ID saved to localStorage');
            }

            modal.hide();
            modalElement.addEventListener('hidden.bs.modal', () => {
                modalElement.remove();
                callback(configId);
            });
        });

        // Show modal
        modal.show();
    }

    // Load configuration from Firebase or fallback to local
    async loadConfig() {
        if (this.configLoadPromise) {
            return this.configLoadPromise;
        }

        this.configLoadPromise = this._loadConfigInternal();
        return this.configLoadPromise;
    }

    async _loadConfigInternal() {
        // Check if there's a stored configuration ID or choice
        const storedId = localStorage.getItem('bulletinBoardConfigId');
        const hasChoiceMade = localStorage.getItem('bulletinBoardConfigChoice') !== null;

        try {
            if (this.isFirebaseEnabled && storedId) {
                // Use stored Firebase configuration
                console.log(`Found stored configuration ID: ${storedId}, attempting to load from Firebase`);
                this.configId = storedId;
                await this._loadFromFirebase(storedId);
                console.log('Configuration loaded from Firebase successfully');
                this._setupFirebaseListeners(storedId);
                return;
            } else if (hasChoiceMade) {
                // User previously chose local config
                console.log('Using local configuration (user choice)');
                this._loadFromLocal();
                return;
            } else if (this.isFirebaseEnabled) {
                // First time - show configuration choice
                const configId = await this.getConfigId();
                if (configId) {
                    console.log(`Attempting to load configuration from Firebase with ID: ${configId}`);
                    await this._loadFromFirebase(configId);
                    console.log('Configuration loaded from Firebase successfully');
                    this._setupFirebaseListeners(configId);
                    return;
                } else {
                    // User chose local config
                    localStorage.setItem('bulletinBoardConfigChoice', 'local');
                    console.log('User chose local configuration');
                }
            }
        } catch (error) {
            console.warn('Failed to load from Firebase, falling back to local config:', error);
        }

        // Use local configuration
        console.log('Loading configuration from local config.js...');
        this._loadFromLocal();
        console.log('Configuration loaded from local config.js');
    }

    async _loadFromFirebase(configId) {
        const database = window.firebaseDatabase;
        if (!database) {
            throw new Error('Firebase database not available');
        }

        // Load configuration with timeout
        const configPromise = new Promise((resolve, reject) => {
            const configRef = database.ref(`configurations/${configId}/bulletinConfig`);
            const translationsRef = database.ref(`configurations/${configId}/translations`);
            const sizeConfigRef = database.ref(`configurations/${configId}/sizeConfig`);

            let loadedCount = 0;
            const totalToLoad = 3;
            const results = {};

            const checkComplete = () => {
                if (loadedCount === totalToLoad) {
                    resolve(results);
                }
            };

            // Load bulletin config
            configRef.once('value', (snapshot) => {
                results.config = snapshot.val();
                loadedCount++;
                checkComplete();
            }, (error) => {
                reject(new Error(`Failed to load bulletin config: ${error.message}`));
            });

            // Load translations
            translationsRef.once('value', (snapshot) => {
                results.translations = snapshot.val();
                loadedCount++;
                checkComplete();
            }, (error) => {
                reject(new Error(`Failed to load translations: ${error.message}`));
            });

            // Load size config
            sizeConfigRef.once('value', (snapshot) => {
                results.sizeConfig = snapshot.val();
                loadedCount++;
                checkComplete();
            }, (error) => {
                reject(new Error(`Failed to load size config: ${error.message}`));
            });
        });

        // Add timeout
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Firebase load timeout')), 10000);
        });

        const results = await Promise.race([configPromise, timeoutPromise]);

        // Validate loaded data
        if (!results.config || !results.translations || !results.sizeConfig) {
            throw new Error('Incomplete configuration data from Firebase');
        }

        this.config = results.config;
        this.translations = results.translations;
        this.sizeConfig = results.sizeConfig;
    }

    _loadFromLocal() {
        // Use the global variables from config.js
        if (typeof BULLETIN_CONFIG === 'undefined' || 
            typeof TRANSLATIONS === 'undefined' || 
            typeof SIZE_CONFIG === 'undefined') {
            throw new Error('Local configuration not available');
        }

        this.config = BULLETIN_CONFIG;
        this.translations = TRANSLATIONS;
        this.sizeConfig = SIZE_CONFIG;
    }

    _setupFirebaseListeners(configId) {
        if (!this.isFirebaseEnabled || !configId) return;

        const database = window.firebaseDatabase;

        // Listen for configuration changes
        database.ref(`configurations/${configId}/bulletinConfig`).on('value', (snapshot) => {
            const newConfig = snapshot.val();
            if (newConfig && JSON.stringify(newConfig) !== JSON.stringify(this.config)) {
                console.log('Configuration updated from Firebase');
                this.config = newConfig;
                this._notifyListeners('config', newConfig);
            }
        });

        // Listen for translation changes
        database.ref(`configurations/${configId}/translations`).on('value', (snapshot) => {
            const newTranslations = snapshot.val();
            if (newTranslations && JSON.stringify(newTranslations) !== JSON.stringify(this.translations)) {
                console.log('Translations updated from Firebase');
                this.translations = newTranslations;
                this._notifyListeners('translations', newTranslations);
            }
        });

        // Listen for size config changes
        database.ref(`configurations/${configId}/sizeConfig`).on('value', (snapshot) => {
            const newSizeConfig = snapshot.val();
            if (newSizeConfig && JSON.stringify(newSizeConfig) !== JSON.stringify(this.sizeConfig)) {
                console.log('Size configuration updated from Firebase');
                this.sizeConfig = newSizeConfig;
                this._notifyListeners('sizeConfig', newSizeConfig);
            }
        });
    }

    // Add listener for configuration changes
    addChangeListener(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    _notifyListeners(type, data) {
        this.listeners.forEach(callback => {
            try {
                callback(type, data);
            } catch (error) {
                console.error('Error in config change listener:', error);
            }
        });
    }

    // Getters for configuration data
    getConfig() {
        return this.config;
    }

    getTranslations() {
        return this.translations;
    }

    getSizeConfig() {
        return this.sizeConfig;
    }

    isLoaded() {
        return this.config !== null && this.translations !== null && this.sizeConfig !== null;
    }

    isUsingFirebase() {
        return this.isFirebaseEnabled;
    }

    // Method to update configuration in Firebase (for admin interface)
    async updateConfig(newConfig) {
        if (!this.isFirebaseEnabled) {
            throw new Error('Firebase not available for configuration updates');
        }

        if (!this.configId) {
            throw new Error('No configuration ID available for updates');
        }

        const database = window.firebaseDatabase;
        await database.ref(`configurations/${this.configId}/bulletinConfig`).set(newConfig);
        console.log('Configuration updated in Firebase');
    }

    async updateTranslations(newTranslations) {
        if (!this.isFirebaseEnabled) {
            throw new Error('Firebase not available for translation updates');
        }

        if (!this.configId) {
            throw new Error('No configuration ID available for updates');
        }

        const database = window.firebaseDatabase;
        await database.ref(`configurations/${this.configId}/translations`).set(newTranslations);
        console.log('Translations updated in Firebase');
    }

    async updateSizeConfig(newSizeConfig) {
        if (!this.isFirebaseEnabled) {
            throw new Error('Firebase not available for size config updates');
        }

        if (!this.configId) {
            throw new Error('No configuration ID available for updates');
        }

        const database = window.firebaseDatabase;
        await database.ref(`configurations/${this.configId}/sizeConfig`).set(newSizeConfig);
        console.log('Size configuration updated in Firebase');
    }

    // Method to get current configuration ID
    getCurrentConfigId() {
        return this.configId;
    }

    // Method to clear stored configuration ID (for admin purposes)
    clearStoredConfigId() {
        localStorage.removeItem('bulletinBoardConfigId');
        this.configId = null;
        console.log('Stored configuration ID cleared');
    }

    // Method to manually show configuration setup (for admin purposes)
    async setupFirebaseConfig() {
        return new Promise((resolve) => {
            this.showConfigIdPrompt((configId) => {
                if (configId) {
                    // Reload configuration with new ID
                    this.configLoadPromise = null;
                    this.loadConfig().then(() => {
                        resolve(configId);
                    });
                } else {
                    resolve(null);
                }
            });
        });
    }
}

// Create global instance
window.configService = new ConfigService();
