import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

let serviceAccount;

if (process.env.NODE_ENV === 'production') {
  // Render par deploy karte waqt secret file se read karo
  serviceAccount = JSON.parse(fs.readFileSync('/etc/secrets/firebase-service-account.json', 'utf8'));
} else {
  // Local development ke liye file se read karo
  const serviceAccountPath = path.resolve('./firebase/serviceAccountKey.json');
  serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;