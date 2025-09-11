// Firebase Messages Service
// Handles CRUD operations for messages stored in Firebase Realtime Database

class MessagesService {
    constructor() {
        this.database = window.firebaseDatabase;
        this.isFirebaseEnabled = this.database !== null && this.database !== undefined;
        this.listeners = new Set();
        
        console.log('MessagesService initialized. Firebase enabled:', this.isFirebaseEnabled);
    }

    // Get the messages path for a specific configuration
    getMessagesPath(configId) {
        return `configurations/${configId}/messages`;
    }

    // Get messages for a specific configuration
    async getMessages(configId) {
        if (!this.isFirebaseEnabled) {
            throw new Error('Firebase not available');
        }

        if (!configId) {
            throw new Error('Configuration ID is required');
        }

        try {
            const snapshot = await this.database.ref(this.getMessagesPath(configId)).once('value');
            const messagesData = snapshot.val();

            if (!messagesData) {
                // Return empty structure if no messages exist
                return {
                    status: "ok",
                    feed: {
                        title: "הודעות",
                        description: "הודעות לדיירים",
                        image: ""
                    },
                    items: []
                };
            }

            // Convert Firebase object to array format expected by RSS component
            const items = messagesData.items ? Object.keys(messagesData.items).map(key => ({
                id: key,
                ...messagesData.items[key]
            })).sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)) : [];

            return {
                status: "ok",
                feed: messagesData.feed || {
                    title: "הודעות",
                    description: "הודעות לדיירים",
                    image: ""
                },
                items: items
            };
        } catch (error) {
            console.error('Failed to get messages:', error);
            throw new Error(`Failed to get messages: ${error.message}`);
        }
    }

    // Add a new message
    async addMessage(configId, message) {
        if (!this.isFirebaseEnabled) {
            throw new Error('Firebase not available');
        }

        if (!configId) {
            throw new Error('Configuration ID is required');
        }

        // Validate message
        if (!message.title || !message.description) {
            throw new Error('Message title and description are required');
        }

        try {
            const messageData = {
                title: message.title,
                description: message.description,
                pubDate: message.pubDate || new Date().toISOString().replace('T', ' ').substring(0, 19),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Generate a new key for the message
            const newMessageRef = this.database.ref(this.getMessagesPath(configId)).child('items').push();
            await newMessageRef.set(messageData);

            console.log('Message added successfully:', newMessageRef.key);
            return newMessageRef.key;
        } catch (error) {
            console.error('Failed to add message:', error);
            throw new Error(`Failed to add message: ${error.message}`);
        }
    }

    // Update an existing message
    async updateMessage(configId, messageId, updates) {
        if (!this.isFirebaseEnabled) {
            throw new Error('Firebase not available');
        }

        if (!configId || !messageId) {
            throw new Error('Configuration ID and message ID are required');
        }

        try {
            const updateData = {
                ...updates,
                updatedAt: new Date().toISOString()
            };

            await this.database.ref(this.getMessagesPath(configId)).child('items').child(messageId).update(updateData);
            console.log('Message updated successfully:', messageId);
        } catch (error) {
            console.error('Failed to update message:', error);
            throw new Error(`Failed to update message: ${error.message}`);
        }
    }

    // Delete a message
    async deleteMessage(configId, messageId) {
        if (!this.isFirebaseEnabled) {
            throw new Error('Firebase not available');
        }

        if (!configId || !messageId) {
            throw new Error('Configuration ID and message ID are required');
        }

        try {
            await this.database.ref(this.getMessagesPath(configId)).child('items').child(messageId).remove();
            console.log('Message deleted successfully:', messageId);
        } catch (error) {
            console.error('Failed to delete message:', error);
            throw new Error(`Failed to delete message: ${error.message}`);
        }
    }

    // Initialize messages structure for a configuration
    async initializeMessages(configId, feedInfo = null) {
        if (!this.isFirebaseEnabled) {
            throw new Error('Firebase not available');
        }

        if (!configId) {
            throw new Error('Configuration ID is required');
        }

        try {
            const messagesData = {
                feed: feedInfo || {
                    title: "הודעות",
                    description: "הודעות לדיירים",
                    image: ""
                },
                items: {},
                metadata: {
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };

            await this.database.ref(this.getMessagesPath(configId)).set(messagesData);
            console.log('Messages structure initialized for config:', configId);
        } catch (error) {
            console.error('Failed to initialize messages:', error);
            throw new Error(`Failed to initialize messages: ${error.message}`);
        }
    }

    // Listen for messages changes
    addMessagesListener(configId, callback) {
        if (!this.isFirebaseEnabled || !configId) {
            return null;
        }

        const messagesRef = this.database.ref(this.getMessagesPath(configId));
        
        const listener = messagesRef.on('value', (snapshot) => {
            try {
                const messagesData = snapshot.val();
                if (messagesData) {
                    const items = messagesData.items ? Object.keys(messagesData.items).map(key => ({
                        id: key,
                        ...messagesData.items[key]
                    })).sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)) : [];

                    const result = {
                        status: "ok",
                        feed: messagesData.feed || {
                            title: "הודעות",
                            description: "הודעות לדיירים",
                            image: ""
                        },
                        items: items
                    };

                    callback(result);
                }
            } catch (error) {
                console.error('Error in messages listener:', error);
            }
        });

        this.listeners.add({ configId, listener, ref: messagesRef });
        
        // Return unsubscribe function
        return () => {
            messagesRef.off('value', listener);
            this.listeners.delete({ configId, listener, ref: messagesRef });
        };
    }

    // Remove all listeners
    removeAllListeners() {
        this.listeners.forEach(({ ref, listener }) => {
            ref.off('value', listener);
        });
        this.listeners.clear();
    }

    // Migrate messages from JSON format to Firebase
    async migrateMessagesFromJSON(configId, jsonData) {
        if (!this.isFirebaseEnabled) {
            throw new Error('Firebase not available');
        }

        if (!configId) {
            throw new Error('Configuration ID is required');
        }

        try {
            // Convert array format to Firebase object format
            const firebaseItems = {};
            
            if (jsonData.items && Array.isArray(jsonData.items)) {
                jsonData.items.forEach((item, index) => {
                    const key = this.database.ref().child('temp').push().key; // Generate unique key
                    firebaseItems[key] = {
                        title: item.title,
                        description: item.description,
                        pubDate: item.pubDate,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                });
            }

            const messagesData = {
                feed: jsonData.feed || {
                    title: "הודעות",
                    description: "הודעות לדיירים",
                    image: ""
                },
                items: firebaseItems,
                metadata: {
                    migratedAt: new Date().toISOString(),
                    source: 'JSON migration'
                }
            };

            await this.database.ref(this.getMessagesPath(configId)).set(messagesData);
            console.log(`Messages migrated successfully for config: ${configId}`);
            return Object.keys(firebaseItems).length;
        } catch (error) {
            console.error('Failed to migrate messages:', error);
            throw new Error(`Failed to migrate messages: ${error.message}`);
        }
    }

    // Check if Firebase is available
    isAvailable() {
        return this.isFirebaseEnabled;
    }
}

// Create global instance
window.messagesService = new MessagesService();
