const fs = require('fs');


const projectAgentEmail = {
  "nikoo homes sadahalli": "vishakha@canvas-homes.com",
  "adarsh tropica phase 2": "srihitha.reddy@truestate.in",
  "dsr the address": "srihitha.reddy@truestate.in",
  "nambiar district 25": "srihitha.reddy@truestate.in",
  "provident botanico": "srihitha.reddy@truestate.in",
  "godrej lakeside orchard": "srihitha.reddy@truestate.in",
  "assetz codename altitude": "yasswanth@canvas-homes.com",
  "assetz codename micropolis": "yasswanth@canvas-homes.com",
  "sattva hamlet": "vishakha@canvas-homes.com",
  "tata carnatic": "ish.venaik@truestate.in",
  "brigade plot malur": "srihitha.reddy@truestate.in",
  "sattva aeropolis": "piyush@canvas-homes.com"
};

const projectAgentId = {
  "nikoo homes sadahalli": "canv14",
  "adarsh tropica phase 2": "canv03",
  "dsr the address": "canv03",
  "nambiar district 25": "canv03",
  "provident botanico": "canv03",
  "godrej lakeside orchard": "canv03",
  "assetz codename altitude": "canv02",
  "assetz codename micropolis": "canv02",
  "sattva hamlet": "canv14",
  "tata carnatic": "canv04",
  "brigade plot malur": "canv03",
  "sattva aeropolis": "canv05"
};

const projectAgentName = {
  "nikoo homes sadahalli": "Vishakha Sipani",
  "adarsh tropica phase 2": "Srihitha",
  "dsr the address": "Srihitha",
  "nambiar district 25": "Srihitha",
  "provident botanico": "Srihitha",
  "godrej lakeside orchard": "Srihitha",
  "assetz codename altitude": "Yashwanth.s",
  "assetz codename micropolis": "Yashwanth.s",
  "sattva hamlet": "Vishakha Sipani",
  "tata carnatic": "Ish Venaik",
  "brigade plot malur": "Srihitha",
  "sattva aeropolis": "Piyush Lalwani"
};

const DEFAULT_EMAIL = "contact@canvas-homes.com";
const DEFAULT_AGENT_NAME = "unknown";
const DEFAULT_AGENT_ID = "unknown";

function agentInfo(project) {
  const key = (project || "").toLowerCase().trim();
  return {
    email: projectAgentEmail[key] || DEFAULT_EMAIL,
    name: projectAgentName[key] || DEFAULT_AGENT_NAME,
    id: projectAgentId[key] || DEFAULT_AGENT_ID
  };
}



async function checkDuplicateLead(db, collectionName, phoneNumber, propertyName) {
  const querySnapshot = await db.collection(collectionName)
    .where("phoneNumber", "==", phoneNumber)
    .where("propertyName", "==", propertyName)
    .get();

  return !querySnapshot.empty;
}

// Helper function to generate next ID with transaction
async function getNextId(counterDocPath, prefix,db,paddingLength = 3) {
  const counterRef = db.doc(counterDocPath);

  return await db.runTransaction(async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    let currentCount = 0;

    if (counterDoc.exists) {
      currentCount = counterDoc.data().count || 0;
    }

    const newCount = currentCount + 1;
    const newId = `${prefix}${newCount.toString().padStart(paddingLength, '0')}`;

    // Update the counter
    transaction.set(counterRef, { count: newCount }, { merge: true });

    return newId;
  });
}

// Helper function to fetch propertyId by propertyName
async function getPropertyIdByName(propertyName,db) {
  if (!propertyName) {
    console.warn('No propertyName provided');
    return null;
  }

  try {
    const propertyQuery = await db.collection('restackPreLaunchProperties')
      .where('projectName', '==', propertyName)
      .limit(1)
      .get();

    if (propertyQuery.empty) {
      console.warn(`Property not found with name: ${propertyName}`);
      return null;
    }

    const propertyDoc = propertyQuery.docs[0];
    const propertyId = propertyDoc.id;
    console.log(`Found propertyId: ${propertyId} for propertyName: ${propertyName}`);
    return propertyId;
  } catch (error) {
    console.error(`Error fetching propertyId for ${propertyName}:`, error);
    return null;
  }
}

async function transformData(leads, db) {
  const now = Math.floor(Date.now() / 1000);
  const leadsData = [];

  for (let idx = 0; idx < leads.length; idx++) {
    const row = leads[idx];
    const phone = row.phoneNumber;
    const name = row.name || "";
    const projectName = row.projectName || "";
    const platform = 'google';

    const { email: agentEmail, name: agentName, id: agentId } = agentInfo(projectName);

    const isDuplicate = await checkDuplicateLead(db, "canvashomesLeads", phone, projectName);

    if (isDuplicate) {
      console.log("duplicate lead found!!!! skip it");
      continue;
    }
    

      // Generate userId dynamically
      const userId = await getNextId('canvashomesAdmin/lastUser', 'user',db);
      console.log(`Generated userId: ${userId}`);
      
      // Generate leadId dynamically
      const leadId = await getNextId('canvashomesAdmin/lastLead', 'lead',db);
      console.log(`Generated leadId: ${leadId}`);
      
      // Generate enquiryId dynamically
      const enquiryId = await getNextId('canvashomesAdmin/lastEnquiry', 'enq',db);
      console.log(`Generated enquiryId: ${enquiryId}`);
      // Fetch propertyId using propertyName
      const projectId = await getPropertyIdByName(projectName,db);

    const userData = {
      userId: userId,
      phoneNumber: phone,
      name: name,
      campaign: true,
      utmDetails: row.utmDetails,
      added: now,
      lastModified: now,
      label:'call'
    };

    userData.leadData = {
      agentName: agentName.toLowerCase(),
      name: name.trim(),
      agentId: agentId,
      phoneNumber: phone,
      propertyName: projectName.toLowerCase(),
      propertyId: projectId,
      rnr:false,
      rnrCount:0,
      utmDetails: row.utmDetails,
      tag: null,
      source: platform,
      stage: null,
      taskType: null,
      scheduledDate: null,
      leadStatus: null,
      state: "fresh",
      added: now,
      completionDate: null,
      lastModified: now,
      userId: userId,
      leadId: leadId
    };

    userData.enquiryData = {
      agentId: agentId,
      propertyId: projectId,
      propertyName: projectName.toLowerCase(),
      source: platform,
      leadStatus: null,
      stage: null,
      rnr:false,
      rnrCount:0,
      agentName: agentName.toLowerCase(),
      agentHistory: [
        {
          agentId: agentId,
          agentName: agentName.toLowerCase(),
          timestamp: now,
          lastStage: null
        }
      ],
      notes: [],
      activityHistory: [
        {
          activityType: "lead added",
          timestamp: now,
          agentName: agentName.toLowerCase(),
          data: {}
        }
      ],
      tag: null,
      documents: [],
      state: "fresh",
      requirements: [],
      added: now,
      lastModified: now,
      leadId: leadId,
      enquiryId: enquiryId
    };
    leadsData.push(userData);
    
  }

  console.log("leadsData before return:", leadsData);
  return leadsData;
}


module.exports = { transformData };