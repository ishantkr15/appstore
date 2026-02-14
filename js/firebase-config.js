// Firebase Configuration for ModGalaxy
// Using Firebase Compat SDK (works with <script> tags)

const firebaseConfig = {
    apiKey: "AIzaSyCvhWvEVrSeNM5yKEzEIpVXAKO_sKJfeFE",
    authDomain: "modgalaxy-e2bca.firebaseapp.com",
    projectId: "modgalaxy-e2bca",
    storageBucket: "modgalaxy-e2bca.firebasestorage.app",
    messagingSenderId: "606924289397",
    appId: "1:606924289397:web:70ef9d48da37674b3ccf3c",
    measurementId: "G-VZZK8CTBRD"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ========== APP HELPERS ==========

async function getAllApps() {
    const snapshot = await db.collection('apps').orderBy('appId', 'asc').get();
    return snapshot.docs.map(doc => ({ _docId: doc.id, ...doc.data() }));
}

async function getAppById(slugId) {
    // Try direct doc first (faster), then query by 'id' field
    const doc = await db.collection('apps').doc(slugId).get();
    if (doc.exists) return { _docId: doc.id, ...doc.data() };
    const snapshot = await db.collection('apps').where('id', '==', slugId).limit(1).get();
    if (snapshot.empty) return null;
    return { _docId: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

async function getAppsByCategory(category) {
    const snapshot = await db.collection('apps').where('category', '==', category).get();
    return snapshot.docs.map(doc => ({ _docId: doc.id, ...doc.data() }));
}

// ========== CATEGORY HELPERS ==========

async function getAllCategories() {
    const snapshot = await db.collection('categories').orderBy('name', 'asc').get();
    return snapshot.docs.map(doc => ({ _docId: doc.id, ...doc.data() }));
}

// ========== ANALYTICS ==========

function getToday() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

async function trackVisit() {
    try {
        const today = getToday();
        const ref = db.collection('analytics').doc('visits');
        await ref.set({
            total: firebase.firestore.FieldValue.increment(1),
            [`daily.${today}`]: firebase.firestore.FieldValue.increment(1),
            lastVisit: new Date().toISOString()
        }, { merge: true });
    } catch (e) { /* silent fail for visitors */ }
}

async function trackAppView(appSlug) {
    try {
        const today = getToday();
        const ref = db.collection('analytics').doc('appViews');
        await ref.set({
            [`apps.${appSlug}`]: firebase.firestore.FieldValue.increment(1),
            [`daily.${today}`]: firebase.firestore.FieldValue.increment(1),
            totalViews: firebase.firestore.FieldValue.increment(1)
        }, { merge: true });
    } catch (e) { /* silent fail */ }
}

async function getAnalytics() {
    const visits = await db.collection('analytics').doc('visits').get();
    const appViews = await db.collection('analytics').doc('appViews').get();
    const searches = await db.collection('analytics').doc('searches').get();
    return {
        visits: visits.exists ? visits.data() : { total: 0, daily: {} },
        appViews: appViews.exists ? appViews.data() : { apps: {}, daily: {}, totalViews: 0 },
        searches: searches.exists ? searches.data() : { keywords: {}, total: 0 }
    };
}

// ========== SEARCH TRACKING ==========

async function trackSearch(keyword) {
    try {
        if (!keyword || keyword.length < 2) return;
        const clean = keyword.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '').substring(0, 50);
        if (!clean) return;
        const ref = db.collection('analytics').doc('searches');
        await ref.set({
            [`keywords.${clean}`]: firebase.firestore.FieldValue.increment(1),
            total: firebase.firestore.FieldValue.increment(1),
            lastSearch: new Date().toISOString()
        }, { merge: true });
    } catch (e) { /* silent */ }
}

// ========== USER RATINGS ==========

function getVisitorId() {
    let id = localStorage.getItem('mg_visitor');
    if (!id) { id = 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8); localStorage.setItem('mg_visitor', id); }
    return id;
}

async function submitRating(appSlug, stars) {
    const vid = getVisitorId();
    const docId = `${appSlug}_${vid}`;
    await db.collection('ratings').doc(docId).set({
        appSlug, stars, visitorId: vid, timestamp: new Date().toISOString()
    });
    // Update aggregated rating on the app
    const ratingsSnap = await db.collection('ratings').where('appSlug', '==', appSlug).get();
    let sum = 0, count = 0;
    ratingsSnap.forEach(d => { sum += d.data().stars; count++; });
    const avg = count > 0 ? (sum / count).toFixed(1) : '0';
    // Try to update app doc
    try { await db.collection('apps').doc(appSlug).update({ userRating: avg, userRatingCount: count }); } catch (e) { }
    return { average: avg, count };
}

async function getAppRating(appSlug) {
    const vid = getVisitorId();
    const ratingsSnap = await db.collection('ratings').where('appSlug', '==', appSlug).get();
    let sum = 0, count = 0, myRating = 0;
    ratingsSnap.forEach(d => {
        const data = d.data();
        sum += data.stars; count++;
        if (data.visitorId === vid) myRating = data.stars;
    });
    return { average: count > 0 ? (sum / count).toFixed(1) : '0', count, myRating };
}
