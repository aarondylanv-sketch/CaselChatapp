const firebaseConfig = {
    apiKey: "AIzaSyDDjZqUJair7pxWlq6cqh0BUKW0bhsT4Og",
    authDomain: "casel-c8bad.firebaseapp.com",
    databaseURL: "https://casel-c8bad-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "casel-c8bad",
    storageBucket: "casel-c8bad.firebasestorage.app",
    messagingSenderId: "520040965581",
    appId: "1:520040965581:web:e4b4a3ff03929c635bd084"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

db.enablePersistence()
    .then(() => console.log('Offline mode ready'))
    .catch((err) => console.log('Persistence error:', err));