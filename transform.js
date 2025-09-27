const DEFAULT_AGENT_NAME = "unknown";
const DEFAULT_AGENT_ID = "unknown";


async function checkDuplicateLead(
  db,
  collectionName,
  phoneNumber,
  propertyName
) {
  const querySnapshot = await db
    .collection(collectionName)
    .where("phoneNumber", "==", phoneNumber)
    .where("propertyName", "==", propertyName)
    .get();

  const querySnapshot1 = await db
    .collection(collectionName)
    .where("phoneNumber", "==", phoneNumber)
    .where("propertyName", "==", propertyName.toLowerCase())
    .get();

  return !querySnapshot.empty || !querySnapshot1.empty;
}

async function checkExistingUser(db, phoneNumber) {
  const userQuery = await db
    .collection("canvashomesUsersTest")
    .where("phoneNumber", "==", phoneNumber)
    .limit(1)
    .get();
  if (!userQuery.empty) {
    const userDoc = userQuery.docs[0];
    return userDoc.data().userId;
  }
  return null;
}

async function getNextId(counterDocPath, prefix, db, paddingLength = 3) {
  const counterRef = db.doc(counterDocPath);

  return await db.runTransaction(async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    let currentCount = 0;

    if (counterDoc.exists) {
      currentCount = counterDoc.data().count || 0;
    }

    const newCount = currentCount + 1;
    const newId = `${prefix}${newCount
      .toString()
      .padStart(paddingLength, "0")}`;

    transaction.set(counterRef, { count: newCount }, { merge: true });

    return newId;
  });
}

async function getPropertyIdByName(propertyName, db) {
  if (!propertyName) {
    console.warn("No propertyName provided");
    return null;
  }

  try {
    const propertyQuery = await db
      .collection("restackPreLaunchProperties")
      .where("projectName", "==", propertyName)
      .limit(1)
      .get();

    if (propertyQuery.empty) {
      console.warn(`Property not found with name: ${propertyName}`);
      return null;
    }

    const propertyDoc = propertyQuery.docs[0];
    const propertyId = propertyDoc.id;
    console.log(
      `Found propertyId: ${propertyId} for propertyName: ${propertyName}`
    );
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
    const platform = "google";

    const agentName = row.currentAgent || DEFAULT_AGENT_NAME;
    const agentId = row.currentAgentId || DEFAULT_AGENT_ID;

    const isDuplicate = await checkDuplicateLead(
      db,
      "canvashomesEnquiriesTest",
      phone,
      projectName
    );

    if (isDuplicate) {
      console.log("duplicate lead found!!!! skip it");
      continue;
    }

    // Generate userId dynamically
    let userId = await checkExistingUser(db, phone);
    if (userId) {
      console.log(
        `User already exists with userId: ${userId}, skipping user creation.`
      );
      userData.alreadyExists = true;
    } else {
      userId = await getNextId("canvashomesAdmin/lastUser", "user", db);
      console.log(`Generated userId: ${userId}`);
    }

    // Generate enquiryId dynamically
    const enquiryId = await getNextId(
      "canvashomesAdmin/lastEnquiry",
      "enq",
      db
    );
    console.log(`Generated enquiryId: ${enquiryId}`);
    // Fetch propertyId using propertyName
    const projectId = await getPropertyIdByName(projectName, db);

    const timestamp = Math.floor(Date.now() / 1000);

    const userData = {
      userId: userId,
      phoneNumber: phone,
      name: name,
      campaign: true,
      utmDetails: row.utmDetails,
      added: now,
      lastModified: now,
      label: "call",
      phoneNumbers:[
        { label: "primary", number: phone, addedAt: timestamp }
      ]
    };
    userData.enquiryData = {
      enquiryId: enquiryId,
      userId: userId,
      agentId: agentId,
      agentName: agentName ? agentName.toLowerCase() : null,
      propertyName: projectName ? projectName.toLowerCase() : null,
      propertyId: projectId || null,
      rootPropertyName: null,
      rootPropertyId: null,
      name: name.trim(),
      phoneNumber: phone || null,
      label: "call", 
      source: platform,
      leadStatus: null,
      stage: null,
      agentHistory: [
        {
          agentId: agentId,
          agentName: agentName ? agentName.toLowerCase() : null,
          timestamp: now,
          lastStage: null,
        },
      ],
      notes: [],
      activityHistory: [
        {
          activityType: "lead added",
          timestamp: now,
          agentName: agentName ? agentName.toLowerCase() : null,
          data: {},
        },
      ],
      tag: null,
      taskType: null,
      scheduledDate: null,
      rnr: false,
      rnrCount: 0,
      documents: [],
      requirements: [],
      state: "fresh",
      added: now,
      lastModified: now,
    };
    leadsData.push(userData);
  }

  console.log("leadsData before return:", leadsData);
  return leadsData;
}

export { transformData };
