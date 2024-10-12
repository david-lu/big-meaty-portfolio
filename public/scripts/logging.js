// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-analytics.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCa_C3I6Or8EUyz73GsCq_SCnX0jiL8NkE",
  authDomain: "big-meaty-portfolio.firebaseapp.com",
  projectId: "big-meaty-portfolio",
  storageBucket: "big-meaty-portfolio.appspot.com",
  messagingSenderId: "650520034172",
  appId: "1:650520034172:web:2f4650e4e72bbd77acc2f9",
  measurementId: "G-9P1VT52DKP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
