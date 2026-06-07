importScripts(
'https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js'
);

importScripts(
'https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js'
);

firebase.initializeApp({

apiKey: "AIzaSyCpb4jW5v8XKkjNstw2kB4hHlfhMjP7lEc",

authDomain: "family-link-cd129.firebaseapp.com",

projectId: "family-link-cd129",

storageBucket: "family-link-cd129.firebasestorage.app",

messagingSenderId: "531289053010",

appId: "1:531289053010:web:5b9c5cb11025e936cacc8b"

});

firebase.messaging();