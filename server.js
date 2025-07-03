import express from 'express';
import admin from 'firebase-admin';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({ origin: true }));
app.use(express.json());

// Initialize Firebase Admin SDK for two different systems
let db1; // For googleLeadsStage1
let db2; // For new_users
let firebase1Initialized = false;
let firebase2Initialized = false;

async function initializeFirebase1() {
  try {
    // Check if service account file exists for Firebase 1
    const serviceAccountPath1 = path.join(__dirname, 'serviceAccountKey.json');
    
    if (!fs.existsSync(serviceAccountPath1)) {
      throw new Error('serviceAccountKey1.json file not found in the root directory');
    }

    // Read and validate service account
    const serviceAccountData1 = fs.readFileSync(serviceAccountPath1, 'utf8');
    const serviceAccount1 = JSON.parse(serviceAccountData1);
    
    // Validate required fields
    const requiredFields = ['private_key', 'client_email', 'project_id'];
    for (const field of requiredFields) {
      if (!serviceAccount1[field]) {
        throw new Error(`Missing required field in serviceAccountKey1.json: ${field}`);
      }
    }

    // Initialize Firebase Admin App 1
    const app1 = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount1),
      projectId: serviceAccount1.project_id
    }, 'firebase1'); // Named app instance

    // Get Firestore instance for App 1
    db1 = admin.firestore(app1);
    
    // Test the connection
    await db1.collection('test').limit(1).get();
    
    firebase1Initialized = true;
    console.log('✅ Firebase 1 initialized successfully');
    console.log('📁 Firebase 1 Project ID:', serviceAccount1.project_id);
    
  } catch (error) {
    console.error('❌ Firebase 1 initialization failed:', error.message);
    console.error('\nPlease ensure:');
    console.error('1. serviceAccountKey1.json exists in the root directory');
    console.error('2. The file contains valid JSON with all required fields');
    console.error('3. The service account has proper permissions');
    
    process.exit(1);
  }
}

async function initializeFirebase2() {
  try {
    // Check if service account file exists for Firebase 2
    const serviceAccountPath2 = path.join(__dirname, 'serviceAccountKey2.json');
    
    if (!fs.existsSync(serviceAccountPath2)) {
      throw new Error('serviceAccountKey2.json file not found in the root directory');
    }

    // Read and validate service account
    const serviceAccountData2 = fs.readFileSync(serviceAccountPath2, 'utf8');
    const serviceAccount2 = JSON.parse(serviceAccountData2);
    
    // Validate required fields
    const requiredFields = ['private_key', 'client_email', 'project_id'];
    for (const field of requiredFields) {
      if (!serviceAccount2[field]) {
        throw new Error(`Missing required field in serviceAccountKey2.json: ${field}`);
      }
    }

    // Initialize Firebase Admin App 2
    const app2 = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount2),
      projectId: serviceAccount2.project_id
    }, 'firebase2'); // Named app instance

    // Get Firestore instance for App 2
    db2 = admin.firestore(app2);
    
    // Test the connection
    await db2.collection('test').limit(1).get();
    
    firebase2Initialized = true;
    console.log('✅ Firebase 2 initialized successfully');
    console.log('📁 Firebase 2 Project ID:', serviceAccount2.project_id);
    
  } catch (error) {
    console.error('❌ Firebase 2 initialization failed:', error.message);
    console.error('\nPlease ensure:');
    console.error('1. serviceAccountKey2.json exists in the root directory');
    console.error('2. The file contains valid JSON with all required fields');
    console.error('3. The service account has proper permissions');
    
    process.exit(1);
  }
}

// Middleware to check Firebase initialization
const checkFirebaseInit = (req, res, next) => {
  if (!firebase1Initialized || !firebase2Initialized) {
    return res.status(500).json({
      error: 'Firebase not fully initialized. Server cannot process requests.',
      firebase1: firebase1Initialized,
      firebase2: firebase2Initialized
    });
  }
  next();
};

export const addCampaginData = (afterCreate, unixTimestamp) => {
  const userData = afterCreate;
  const unixNextDayTimestamp = unixTimestamp + 86400;
  const randomID = uuidv4();

  if (userData.campaign === true) {
      userData.subSource = 'Google Search';
      userData.projectName = `${userData.projectName}`;
      userData.sharedProperties = [
          {
              name: `${userData.projectName}`,
              status: 'Customer Selected',
              id: `${userData.projectId}`,
              recommendedBy: "Customer",
              timestamp: unixTimestamp,
          },
      ];
      userData.source = 'Website';
      userData.stage = 'Unqualified';
      userData.currentAgent = `${userData.currentAgent}`;
      userData.newlead = 'yes';
      userData.tag = 'Fresh';
      userData.mode = 'Online';
      userData.added = unixTimestamp;
      userData.lastModified = unixTimestamp;
      userData.customerType = 'Basic';
      userData.tasks = [
          {
              taskName: 'Collect Requirement',
              actionType: 'Call',
              agent: 'rahul@truestate.in',
              objectID: `${randomID}`,
              schedule: unixNextDayTimestamp,
              timestamp: unixTimestamp,
              type: 'Customer',
          },
      ];
      userData.status = 'Customer';
  }

  return userData;
}

app.post('/handleMultipleCampaignData', checkFirebaseInit, async (req, res) => {
    const getUnixDateTime = () => {
        return Math.floor(Date.now() / 1000);
    };

    const unixDateTime = getUnixDateTime();

    try {
        // Destructure required fields from the request body
        const { phoneNumber, name, campaign, projectId, projectName, utmDetails, currentAgent } = req.body;

        // Validate required fields
        if (!phoneNumber || !name || campaign === undefined || !projectId || !projectName || !currentAgent) {
            return res.status(400).json({
                error: 'Missing required fields: phoneNumber, name, campaign, projectId, projectName, and currentAgent.',
            });
        }

        // Additional validation
        if (typeof phoneNumber !== 'string' || typeof name !== 'string') {
            return res.status(400).json({
                error: 'phoneNumber and name must be strings.',
            });
        }


        // Create a new campaign data object
        const newUserDataCampaign = {
            phonenumber: phoneNumber,
            name,
            campaign,
            projectId,
            projectName,
            utmDetails,
            currentAgent,
            added: unixDateTime,
        };
        const newUserDataCampaign1 = {
            phoneNumber,
            name,
            campaign,
            projectId,
            projectName,
            utmDetails,
            currentAgent,
            added: unixDateTime,
        };

        // Save to Firebase 1 - googleLeadsStage1 collection
        console.log('📝 Saving to Firebase 1 - googleLeadsStage1');
        await db1.collection("googleLeadsStage1").add(newUserDataCampaign1);
        console.log('✅ Successfully saved to googleLeadsStage1 in Firebase 1');

        // Add campaign meta data
        const campaignDataWithMeta = addCampaginData(newUserDataCampaign, unixDateTime);

        // Query Firebase 2 for existing user by phone number
        console.log('🔍 Checking for existing user in Firebase 2');
        const userSnapshot = await db2
            .collection("new_users")
            .where("phonenumber", "==", phoneNumber)
            .get();

        if (!userSnapshot.empty) {
            console.log('👤 Updating existing user in Firebase 2');
            const userDoc = userSnapshot.docs[0];
            const userData = userDoc.data();

            const history = userData.history || [];

            // Prepare a new history entry with previous user data
            const newHistoryEntry = {
                projectId: userData.projectId || null,
                taskHistory: userData.taskHistory || [],
                notesHistory: userData.notesHistory || [],
                property_requirement_formHistory: userData.property_requirement_form || [],
                sharedPropertiesHistory: userData.sharedProperties || [],
                agentChangeHistory: userData.agentChange || [],
                timestamp: unixDateTime,
            };

            // Push new history entry only if the user has a projectId
            if (userData.projectId) {
                history.push(newHistoryEntry);
            }

            // Merge new campaign data and updated history into the existing document
            await userDoc.ref.set(
                {
                    ...campaignDataWithMeta,
                    history,
                },
                { merge: true }
            );

            console.log('✅ Successfully updated existing user in Firebase 2');
            return res.status(200).json({
                message: "Data successfully saved to both Firebase systems. Existing user updated with new campaign data and history.",
                firebase1: "googleLeadsStage1 - New record created",
                firebase2: "new_users - Existing record updated"
            });
        } else {
            console.log('👤 Creating new user in Firebase 2');
            // If no existing user, create a new document with the campaign data
            await db2.collection("new_users").add(campaignDataWithMeta);
            
            console.log('✅ Successfully created new user in Firebase 2');
            return res.status(201).json({
                message: "Data successfully saved to both Firebase systems. New user created.",
                firebase1: "googleLeadsStage1 - New record created",
                firebase2: "new_users - New record created"
            });
        }

    } catch (error) {
        console.error("❌ Error processing the request:", error);
        return res.status(500).json({ 
            error: error.message,
            details: "Failed to save data to one or both Firebase systems"
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        firebase1: firebase1Initialized ? 'Connected' : 'Not Connected',
        firebase2: firebase2Initialized ? 'Connected' : 'Not Connected',
        timestamp: new Date().toISOString(),
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Dual Firebase Express Server',
        status: 'Running',
        firebase1: firebase1Initialized ? 'Connected' : 'Not Connected',
        firebase2: firebase2Initialized ? 'Connected' : 'Not Connected',
        endpoints: {
            health: '/health',
            campaign: '/handleMultipleCampaignData'
        }
    });
});

// Initialize both Firebase instances before starting the server
async function startServer() {
    console.log('🚀 Initializing Firebase connections...');
    
    // Initialize both Firebase instances
    await Promise.all([
        initializeFirebase1(),
        initializeFirebase2()
    ]);
    
    console.log('✅ Both Firebase instances initialized successfully');
    
    app.listen(port, () => {
        console.log(`🚀 Server is running on port ${port}`);
        console.log(`📊 Health check: http://localhost:${port}/health`);
        console.log(`🏠 Home: http://localhost:${port}/`);
        console.log('🔥 Firebase 1: googleLeadsStage1 collection');
        console.log('🔥 Firebase 2: new_users collection');
    });
}

// Start the server
startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});