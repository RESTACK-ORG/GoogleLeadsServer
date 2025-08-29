import express from 'express';
import admin from 'firebase-admin';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import * as transform from './transform.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({ origin: true }));
app.use(express.json());

let db1;
let firebase1Initialized = false;

async function initializeFirebase1() {
  try {
    // Read service account key from local file
    const fs = await import('fs');
    const path = await import('path');
    
    const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
    
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error('serviceAccountKey.json file not found in project root');
    }

    const serviceAccountData = fs.readFileSync(serviceAccountPath, 'utf8');
    const serviceAccount1 = JSON.parse(serviceAccountData);
    const requiredFields = ['private_key', 'client_email', 'project_id'];
    for (const field of requiredFields) {
      if (!serviceAccount1[field]) {
        throw new Error(`Missing required field in service account: ${field}`);
      }
    }

    const app1 = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount1),
      projectId: serviceAccount1.project_id
    }, 'firebase1');

    db1 = admin.firestore(app1);
    await db1.collection('test').limit(1).get();
    firebase1Initialized = true;
    console.log('Firebase initialized successfully');
    
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}
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
        if (!phoneNumber || !name || campaign === undefined || !projectName) {
            return res.status(400).json({
                error: 'Missing required fields: phoneNumber, name, campaign, projectId, projectName, and currentAgent.',
            });
        }
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
    for (const record of transformedLeads) {
      const { leadData, enquiryData, ...userData } = record;

      await db1.collection('canvashomesUsers').doc(userData.userId).set(userData);
      await db1.collection('canvashomesLeads').doc(leadData.leadId).set(leadData);
      await db1.collection('canvashomesEnquiries').doc(enquiryData.enquiryId).set(enquiryData);
    }


         return res.status(201).json({
                message: "Data successfully saved to systems. New user created.",
          });

    } catch (error) {
        console.error("Error processing request:", error);
        return res.status(500).json({ 
            error: error.message,
            details: "Failed to save data to Firebase"
        });
    }
});

app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'OK',
      firebase1: firebase1Initialized ? 'Connected' : 'Not Connected',
      timestamp: new Date().toISOString(),
    });
});

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

async function startServer() {
    await initializeFirebase1();
    
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});