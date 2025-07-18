import express from 'express';
import admin from 'firebase-admin';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import * as transform from './transform.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({ origin: true }));
app.use(express.json());

// Initialize Firebase Admin SDK for two different systems
let db1; // For googleLeadsStage1
let firebase1Initialized = false;

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
    console.log('📁 Firebase 1 Project ID:', serviceAccount1.project_id);
    
  } catch (error) {
   
    console.error('3. The service account has proper permissions in the Firebase project.');
    
    process.exit(1);
  }
}


// Middleware to check Firebase initialization
const checkFirebaseInit = (req, res, next) => {
  if (!firebase1Initialized) {
    return res.status(500).json({
      error: 'Firebase not fully initialized. Server cannot process requests.',
      firebase1: firebase1Initialized,
    });
  }
  next();
};

app.post('/handleMultipleCampaignData', checkFirebaseInit, async (req, res) => {
    const getUnixDateTime = () => {
        return Math.floor(Date.now() / 1000);
    };

    const unixDateTime = getUnixDateTime();

    try {
        // Destructure required fields from the request body
        const { phoneNumber, name, campaign, projectId, projectName, utmDetails, currentAgent } = req.body;

        console.log("Received data:", req.body);
        // Validate required fields
        if (!phoneNumber || !name || campaign === undefined || !projectName) {
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
        const newUserDataCampaign1 = [{
            phoneNumber,
            name,
            campaign,
            projectId,
            projectName,
            utmDetails,
            currentAgent,
            added: unixDateTime,
        }];

    let transformedLeads;

    try {
      transformedLeads = await transform.transformData(newUserDataCampaign1, db1);
    } catch (error) {
      console.error("Error during data transformation:", error);
      return res.status(500).json({
        error: 'Data transformation failed',
        details: error.message
      });
    }

    // 3. Upload data
    for (const record of transformedLeads) {
      const { leadData, enquiryData, ...userData } = record;

      console.log("lead data:", leadData);
      console.log("Enquiry data:", enquiryData);
      console.log("User data:", userData);

      // Upload user
      await db1.collection('canvashomesUsers').doc(userData.userId).set(userData);
      console.log(`✓ Uploaded user: ${userData.userId}`);

      // Upload lead
      await db1.collection('canvashomesLeads').doc(leadData.leadId).set(leadData);
      console.log(`✓ Uploaded lead: ${leadData.leadId}`);

      // Upload enquiry
      await db1.collection('canvashomesEnquiries').doc(enquiryData.enquiryId).set(enquiryData);
      console.log(`✓ Uploaded enquiry: ${enquiryData.enquiryId}`);

      console.log(`--- Record processed successfully ---\n`);
    }

    console.log("🎉 All records uploaded successfully.");


         return res.status(201).json({
                message: "Data successfully saved to systems. New user created.",
          });

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
      timestamp: new Date().toISOString(),
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
      message: 'Dual Firebase Express Server',
      status: 'Running',
      firebase1: firebase1Initialized ? 'Connected' : 'Not Connected',
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
      initializeFirebase1()
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