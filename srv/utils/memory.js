const cds = require("@sap/cds");
const customerLib = require("../resources/customer.js");
const { customerList } = customerLib;

module.exports = {
  ////////////////////////////////////////////////////////////////////////////////////////////////
  // MEMORY  INFORMATION
  // memoryInformation is going to be the internal variable where we will be persisting all the information to be memorized and used by the bot in the future
  // and that will be persisted when the response is sent
  ////////////////////////////////////////////////////////////////////////////////////////////////

  createMemoryInformation: async function (user, requestId, dbService, dbTx) {
    const memoryInformation = {
      user: user,
      requestId: requestId,
      recordsPreviousMemory: {},
      recordsToBeUpdated: [],
      previousMemory: {},
      currentMemory: {},
    };

    const records = await readMemoryInformation(user, dbService, dbTx);

    memoryInformation.previousMemory = translateMemories(
      memoryInformation,
      records
    );

    return memoryInformation;
  },

  
  updateMemoryInformation: function (memoryInformation, memoryFullValues) {
    const memoryToUpdate = memoryFullValues[0];
    if (!memoryToUpdate) return;

    for (const [key, value] of Object.entries(memoryToUpdate)) {
      const memoryId = memoryInformation.recordsPreviousMemory[key];
      // if the entity is already in memory we put the ID in records to be Updated with latest = false
      if (
        memoryId &&
        !memoryInformation.recordsToBeUpdated.includes(memoryId)
      ) {
        memoryInformation.recordsToBeUpdated.push(
          memoryId
        );
      }
      memoryInformation.currentMemory[key] = value;
    }
  },

  updateIntentMemory: function (memoryInformation, response) {
    // TODO - This is preparing yhe MemoryFullVAlues to include the intent and entityRequested memory entries
      // Let's save here the intent, and the "resource", "userSentence", "entityRequested", "availableEntity" in memory
  
    const userSentence = response.logs.input;
    const intent = response.nlp? response.nlp.intents[0]? response.nlp.intents[0].slug : "faq" : "faq";
    const resourceId = response.resource.ID;
    const entityRequested = response.conversation.memory? response.conversation.memory.entityRequested : undefined; // This is an array
    const availableEntities = response.conversation.memory? response.conversation.memory.availableEntities : undefined; // This is an array
  

    let memoryFullValues = {
      intent,
      resourceId,
      userSentence,
    };
    if (entityRequested) {
      memoryFullValues["entityRequested"] = entityRequested;
    }

    if (availableEntities) {
      memoryFullValues["availableEntity"] = [];

      // We only need to persist the key of the availableEntities as the name and other information is used only when getting the response from the bot,
      // and sent to the client directly to be used when rendering the memory in the UI
      for (const [key, value] of Object.entries(availableEntities)) {
        memoryFullValues["availableEntity"].push(key);
      }
    }

    module.exports.updateMemoryInformation(memoryInformation, [memoryFullValues]);
  },

  persistMemoryInformation: async function (
    memoryInformation,
    dbService,
    dbTx
  ) {
    const recordsToInsert = prepareMemoryInformationRecordsToInsert(
      memoryInformation
    );
    await insertMemoryInformationInDb(recordsToInsert, dbService, dbTx);

    await updateMemoryInformationInDb(
      memoryInformation.recordsToBeUpdated,
      dbService,
      dbTx
    );
  },

  searchMemoryFullValuesInDb: async function (memoryResponse) {
    //should we search in ODP for the memory values to enrich that.
    //In the case of Customers it makes sense.
    //Should it be don waiting for ODPresponse or async...?
    let entitiesFromDB = [];
    for (const [key, value] of Object.entries(memoryResponse)) {
      entitiesFromDB = findCustomer(key, value);
    }
    if (entitiesFromDB.length === 0 && Object.entries(memoryResponse).length !== 0) {
      if (!memoryResponse.searchTerm) {
        entitiesFromDB = [{
          erpNumber: "820345",
          bpNumber: "0004502090",
          customerName: "CUSTOMER NOT IN DB (FAKE ONE = TESLA)",
        }];
      } else {
        entitiesFromDB = [{
          searchTerm : memoryResponse.searchTerm,
        }];
      }
      
    }
    return entitiesFromDB;
    /*
    const body = c4s.transformQueryForC4s(memoryResponse);
    const responseC4s = c4s.queryC4s(body);
    const memory = c4s.transformResponseC4sToMemory(responseC4s);
    return memory;
    */
  },

  findNewMemoryEntity: function (response, memoryInformation) {
    const memoryResponse = {};
    const currentMemory = memoryInformation.currentMemory;
    const previousMemory = memoryInformation.previousMemory;

    //This statement below should work but it seems it is not. Maybe CDS issue ...
    //const memory = response?.conversation?.memory;
    const memory = response
      ? response.conversation
        ? response.conversation.memory
        : undefined
      : undefined;

    if (!memory) return memoryResponse;

    for (memoryEntityToBeChecked of memoryEntitiesToBeChecked) {
      const memoryEntityValueInResponse = memory[memoryEntityToBeChecked];
      // we check if the entity to be Checked is in Bot response and it is not already in current memory with that value...
      if (
        memoryEntityValueInResponse &&
        currentMemory[memoryEntityToBeChecked] !== memoryEntityValueInResponse &&
        previousMemory[memoryEntityToBeChecked] !== memoryEntityValueInResponse
      ) {
        memoryResponse[memoryEntityToBeChecked] = memoryEntityValueInResponse;
      }
    }

    return memoryResponse;
  },
  
  formatMemoryForBots: function(previousMemory, currentMemory) {
    const previousMemoryCloned = { ...previousMemory };
  
    //Only the values in previousMemory that contain an array with one element are the ones we are sending to the bot
    for (const [key, value] of Object.entries(previousMemoryCloned)) {
      previousMemoryCloned[key] = value.length === 1 ? value[0] : false;
      if (!previousMemoryCloned[key]) delete previousMemoryCloned[key];
    }
    const memory = {
      ...previousMemoryCloned,
      ...currentMemory,
    };
    return memory;
  }
  /*
  findResourceActionPending: function(memoryInformation){
    //TODO
    const pendingResources = [];
    for (resource of memoryInformation.pendingResources) {
      if (resource.entityRequested in memoryInformation.currentMemory) {
        pendingResources.push(resource.resourceId);
      }
    }
    const preciousEntityRequested = memoryInformation.previousMemory.entityRequested;
    if (!preciousEntityRequested) return pendingResources;
    for (entityRequested of preciousEntityRequested){
      if (entityRequested in memoryInformation.currentMemory) {
        pendingResources.push(memoryInformation.previousMemory.resourceId[0]);
      }
    }
    return pendingResources;
  },
*/
};

//This array will contain the anme of the entities that we are looking for. It is only customer for the moment, but this will grow in future
const memoryEntitiesToBeChecked = ["bpNumber", "erpNumber", "customerName", "searchTerm"];

function findCustomer(key, value) {
  let customerResponse = [];
  for (customer of customerList) {
    if (customer[key] === value) {
      customerResponse.push(customer);
    } else if (
      key === "customerName" &&
      customer[key].toLowerCase().includes(value.toLowerCase())
    ) {
      customerResponse.push(customer);
    }
  }
  return customerResponse;
}

// TODO -Read memory from DB
async function readMemoryInformation(user, dbService, dbTx) {
  //const { Memories } = dbService.entities;
  const query =
    "SELECT * from swb_memory_Memories WHERE user = '" +
    user +
    "' AND latest = true";
  memories = await dbTx.run(query);

  return memories;
}

// This translate the rows read from Memories entity into a Json format
function translateMemories(memoryInformation, memories) {
  let previousMemory = {};
  //>> It could be "erpNumber", "bpNumber", "customerName", "resource", "intent", "entityRequested", "availableEntity", ... "productName"
  for (entity of memories) {
    // We fill the entityname in recordsPreviousMemory the ID of the record in Memory entity that contain the entityName and value
    memoryInformation.recordsPreviousMemory[entity.memory_entityName] =
      entity.ID;
    // We fill the entityname in previousMemory with the value of the record in memory
    const entityValue = JSON.parse(entity.memory_entityValue);

    previousMemory[entity.memory_entityName] = entityValue;
  }
  return previousMemory;
}

// this function converts the existing "currentMemory" values to the accepted Memories Entity in DB
function prepareMemoryInformationRecordsToInsert(memoryInformation) {
  let records = [];
  for (const [key, value] of Object.entries(memoryInformation.currentMemory)) {
    // TODO - En el caso de  "availableEntity" puede ser un array, luego hay que hacer varias entradas luego hay que meterlo en un for
    records.push({
      user: memoryInformation.user,
      //request: { ID: memoryInformation.requestId },
      memory_entityName: key,
      memory_entityValue: Array.isArray(value) ? value : [value],
      latest: true,
    });
  }

  return records;
}

// Write memory in DB
async function insertMemoryInformationInDb(records, dbService, dbTx) {
  const { Memories } = dbService.entities;
  if (records.length !== 0) {
    await dbTx.run(INSERT.into(Memories).entries(records));
    await dbTx.commit();
  }
}

async function updateMemoryInformationInDb(recordIds, dbService, dbTx) {
  //const { Memories } = dbService.entities;
  for (id of recordIds) {
    const query =
      "UPDATE swb_memory_Memories SET latest = false WHERE ID = '" + id + "'";
    await dbTx.run(query);
  }
  
  await dbTx.commit();
}
