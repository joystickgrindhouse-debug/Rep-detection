// Firebase Service for Stats and Raffle Tickets
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

export async function sendRepCountToFirebase(totalReps, totalTickets, sessionDuration, exercises) {
  if (!window.firebaseAuth || !window.firebaseDb) {
    console.log('Firebase not initialized');
    return;
  }

  const { collection, addDoc, serverTimestamp, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
  const user = window.firebaseAuth.currentUser;

  if (!user) {
    console.log('User not authenticated - using anonymous session');
    return;
  }

  try {
    // Save session data with tickets
    const statsRef = collection(window.firebaseDb, 'users', user.uid, 'sessions');
    await addDoc(statsRef, {
      totalReps,
      totalTickets,
      sessionDuration,
      exercises,
      timestamp: serverTimestamp(),
      userId: user.uid,
      userName: user.displayName || user.email,
    });

    // Update user stats and leaderboard with tickets
    const userStatsRef = collection(window.firebaseDb, 'leaderboard');
    const userDoc = await getDocs(query(userStatsRef, where('userId', '==', user.uid)));
    
    if (userDoc.empty) {
      await addDoc(userStatsRef, {
        userId: user.uid,
        userName: user.displayName || user.email,
        totalReps: totalReps,
        totalTickets: totalTickets,
        sessionsCount: 1,
        lastSession: serverTimestamp(),
      });
    } else {
      const docRef = userDoc.docs[0].ref;
      const { updateDoc, increment } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
      await updateDoc(docRef, {
        totalReps: increment(totalReps),
        totalTickets: increment(totalTickets),
        sessionsCount: increment(1),
        lastSession: serverTimestamp(),
      });
    }

    console.log('Stats and tickets sent to Firebase successfully');
  } catch (error) {
    console.error('Error sending stats to Firebase:', error);
  }
}

// Get user profile with ticket count
export async function getUserProfile() {
  if (!window.firebaseAuth || !window.firebaseDb) {
    return null;
  }

  const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
  const user = window.firebaseAuth.currentUser;

  if (!user) {
    return null;
  }

  try {
    const userStatsRef = collection(window.firebaseDb, 'leaderboard');
    const userDoc = await getDocs(query(userStatsRef, where('userId', '==', user.uid)));
    
    if (!userDoc.empty) {
      return userDoc.docs[0].data();
    }
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

// Get leaderboard sorted by tickets
export async function getLeaderboard(maxResults = 10) {
  if (!window.firebaseDb) {
    return [];
  }

  const { collection, getDocs, query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');

  try {
    const leaderboardRef = collection(window.firebaseDb, 'leaderboard');
    const leaderboardQuery = query(leaderboardRef, orderBy('totalTickets', 'desc'), limit(maxResults));
    const snapshot = await getDocs(leaderboardQuery);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
}

// Get total raffle tickets in system
export async function getTotalRaffleTickets() {
  if (!window.firebaseDb) {
    return 0;
  }

  const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');

  try {
    const leaderboardRef = collection(window.firebaseDb, 'leaderboard');
    const snapshot = await getDocs(leaderboardRef);
    
    let total = 0;
    snapshot.docs.forEach(doc => {
      total += doc.data().totalTickets || 0;
    });
    
    return total;
  } catch (error) {
    console.error('Error fetching total tickets:', error);
    return 0;
  }
}
