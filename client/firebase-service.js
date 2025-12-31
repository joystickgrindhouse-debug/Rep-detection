// Firebase Service for Stats
let firebaseApp = null;

export async function initializeFirebase() {
  if (typeof window === 'undefined') return;
  
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js');
  const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js');
  const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');

  // Fetch API key from backend to keep it secure
  let apiKey = '';
  try {
    const response = await fetch('/api/firebase-config');
    const config = await response.json();
    apiKey = config.apiKey;
  } catch (error) {
    console.error('Failed to fetch Firebase API key:', error);
    return;
  }

  const firebaseConfig = {
    apiKey: apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  try {
    firebaseApp = initializeApp(firebaseConfig);
    window.firebaseAuth = getAuth(firebaseApp);
    window.firebaseDb = getFirestore(firebaseApp);
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
}

export async function sendRepCountToFirebase(totalReps, sessionDuration, exercises) {
  if (!window.firebaseAuth || !window.firebaseDb) {
    console.log('Firebase not initialized');
    return;
  }

  const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
  const user = window.firebaseAuth.currentUser;

  if (!user) {
    console.log('User not authenticated - using anonymous session');
    return;
  }

  try {
    const statsRef = collection(window.firebaseDb, 'users', user.uid, 'sessions');
    await addDoc(statsRef, {
      totalReps,
      sessionDuration,
      exercises,
      timestamp: serverTimestamp(),
      userId: user.uid,
      userName: user.displayName || user.email,
    });

    // Update user stats totals
    const userStatsRef = collection(window.firebaseDb, 'leaderboard');
    const userDoc = await getDocs(query(userStatsRef, where('userId', '==', user.uid)));
    
    if (userDoc.empty) {
      await addDoc(userStatsRef, {
        userId: user.uid,
        userName: user.displayName || user.email,
        totalReps: totalReps,
        sessionsCount: 1,
        lastSession: serverTimestamp(),
      });
    } else {
      const docRef = userDoc.docs[0].ref;
      const { updateDoc, increment } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
      await updateDoc(docRef, {
        totalReps: increment(totalReps),
        sessionsCount: increment(1),
        lastSession: serverTimestamp(),
      });
    }

    console.log('Stats sent to Firebase successfully');
  } catch (error) {
    console.error('Error sending stats to Firebase:', error);
  }
}
