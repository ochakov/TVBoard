// Firebase Configuration
// Replace these values with your actual Firebase project configuration
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDuQuv8lS-jIoLqGVeD0-IRlCH97rK1wjs",
    authDomain: "tvboard-b17d8.firebaseapp.com",
    databaseURL: "https://tvboard-b17d8-default-rtdb.europe-west1.firebasedatabase.app/",
    projectId: "tvboard-b17d8",
    storageBucket: "tvboard-b17d8.firebasestorage.app",
    messagingSenderId: "121686362519",
    appId: "1:121686362519:web:a40160954348f9c19d5cd2"
};

// Initialize Firebase
let firebaseApp = null;
let database = null;

try {
    firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
    database = firebase.database();
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization failed:', error);
    console.warn('Falling back to local configuration');
}

// Export Firebase instances for use in other modules
window.firebaseApp = firebaseApp;
window.firebaseDatabase = database;
