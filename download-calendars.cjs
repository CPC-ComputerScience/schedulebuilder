const { initializeApp, cert } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");
const fs = require("fs");
const path = require("path");

let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (err) {
    console.error("Error parsing FIREBASE_SERVICE_ACCOUNT env variable:", err.message);
    process.exit(1);
  }
} else {
  // Load service account key from file
  const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
  if (!fs.existsSync(serviceAccountPath)) {
    console.warn("Warning: serviceAccountKey.json not found and FIREBASE_SERVICE_ACCOUNT not set. Skipping calendar download. Using cached files.");
    process.exit(0);
  }
  serviceAccount = require(serviceAccountPath);
}

// Initialize Firebase
initializeApp({
  credential: cert(serviceAccount),
  storageBucket: "cpc-schedule-builder.firebasestorage.app"
});

const publicDir = path.join(__dirname, "public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

async function downloadFile(bucketFile, localName) {
  const destPath = path.join(publicDir, localName);
  console.log(`Downloading gs://cpc-schedule-builder.firebasestorage.app/${bucketFile} to ${destPath}...`);
  try {
    const bucket = getStorage().bucket();
    const file = bucket.file(bucketFile);
    await file.download({ destination: destPath });
    console.log(`Successfully downloaded ${localName}`);
  } catch (error) {
    console.error(`Error downloading ${bucketFile}:`, error);
    process.exit(1);
  }
}

async function main() {
  await downloadFile("cpc days.ics", "cpc-days.ics");
  await downloadFile("cpc teacher days.ics", "cpc-teacher-days.ics");
  console.log("All calendars downloaded successfully!");
}

main();
