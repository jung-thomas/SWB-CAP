const { OPEN_READONLY } = require("sqlite3");
const { v4: uuidv4 } = require("uuid");
const memory = require("./memory.js");
const request = require("./request.js");
const c4s = require("./c4s.js");
const check = require("./checks/responseChecks.js");
const resource = require("./resource.js");

const {
  isBotFaq,
  isBotIntent,
  isModel,
  isNotOthers,
  isOther,
  isCai,
  isSwitchboard,
  isText,
  isButton,
  isPicture,
  isOverConfidenceThreshold,
} = check;

module.exports = {
  responseManagement: async function (
    requestInformation,
    memoryInformation,
    resourcesResponse
  ) {
    pendingResources = [];
    resourcesToRecall = [];

    let selectedResponses = await selectResponses(
      requestInformation,
      memoryInformation,
      resourcesResponse
    );

    /******************************* */
    // resourcesPending could be an array of possible responses from different bots that are requesting some entities
    // that have been already provided in the sentence.
    // In selected Responses there might be entityRequested that is detected before
    
    if (pendingResources.length !== 0) {
      const responsesPending = await resource.callResourcesPending(
        pendingResources,
        memoryInformation,
        requestInformation
      );
      if (responsesPending.length !== 0) {
        selectedResponses = [];
        for (response of responsesPending) {
          const selected = isRightResponse(requestInformation, response);
          if (selected) {
            selectedResponses.push(response);
          }
        }
      }
    } else if (resourcesToRecall.length !== 0) {
      const responsesPending = await resource.callResourcesToRecall(
        resourcesToRecall,
        memoryInformation,
        requestInformation
      );
      if (responsesPending.length !== 0) {
        selectedResponses = [];
        for (response of responsesPending) {
          const selected = isRightResponse(requestInformation, response);
          if (selected) {
            selectedResponses.push(response);
          }
        }
      }
    } 
    /**************************** */

    const finalResponse = generateFinalResponse(
      requestInformation,
      memoryInformation,
      selectedResponses
    );
    request.updateRequestInformationResponse(requestInformation, finalResponse);

    const responseExpected = requestInformation.responseExpected;
    if (responseExpected.includes("memory")) {
      const memoryResponse = generateMemoryResponse(
        requestInformation,
        memoryInformation
      );
      request.updateRequestInformationResponse(
        requestInformation,
        memoryResponse
      );
    }

    return requestInformation.response;
  },
};

let pendingResources;
let resourcesToRecall;

async function selectResponses(
  requestInformation,
  memoryInformation,
  resourcesResponse
) {
  let selectedResponses = [];
  let response;
  //memoryInformation["pendingResources"] = [];
  
  if (!resourcesResponse) {
    pendingResources = Object.keys(
      resource.getAllResources()
    );
    return undefined;
  }

  for (response of resourcesResponse) {
    const memoryResponse = memory.findNewMemoryEntity(
      response,
      memoryInformation
    );
    const memoryFullValues = await memory.searchMemoryFullValuesInDb(
      memoryResponse
    );
    if (memoryResponse.customerName && memoryFullValues.length > 1) {
      //There is more than one customer in DB
      // We are going to send a selection of customer request to the user and set something in memory that indicates that the selection request was sent
      await sendCustomerSelection(requestInformation, memoryFullValues);
      selectedResponses = true;
      //memory.updateIntentMemory(memoryInformation, response);
      break;
    }
    memory.updateMemoryInformation(memoryInformation, memoryFullValues);

    const selected = isRightResponse(requestInformation, response);
    if (selected) {
      selectedResponses.push(response);
    }
  }
  const currentMemoryNames = Object.keys(memoryInformation.currentMemory);
  if (currentMemoryNames.length !== 0) {
    for (response of resourcesResponse) {
      //const entityRequested = response.conversation ? response.conversation.memory ? response.conversation.memory.entityRequested : undefined : undefined;
      const availableEntities = response.conversation
        ? response.conversation.memory
          ? response.conversation.memory.availableEntities
          : undefined
        : undefined;
      if (availableEntities) {
        const availableEntitiesNames = Object.keys(availableEntities);
        for (availableEntitiesName of availableEntitiesNames) {
          if (currentMemoryNames.includes(availableEntitiesName)) {
            const resourceId = response.resource.ID;
            if (!resourcesToRecall.includes(resourceId)) {
              resourcesToRecall.push(resourceId);
            }
          }
        }
      }
    }

    //TODO - Check if this one is already catched in the for loop above...
    const previousEntityRequested =
      memoryInformation.previousMemory.entityRequested;
    if (previousEntityRequested) {
      for (entityRequested of previousEntityRequested) {
        if (
          Object.keys(memoryInformation.currentMemory).includes(entityRequested)
        ) {
          const previousResourceId =
            memoryInformation.previousMemory.resourceId[0];
          if (
            !pendingResources.includes(previousResourceId)
          ) {
            pendingResources.push(previousResourceId);
          }
        }
      }
    }
  }

  return selectedResponses;
}

async function sendCustomerSelection(requestInformation, memoryFullValues) {
  let selectionFinalResponse = {
    responseId: uuidv4(),
    responseType: "chat",
    text: [
      "There is more than one customer in the database with that Name. Could you please choose the right one in the following list?",
    ],
    elements: [],
  };
  let i = 0;
  for (customer of memoryFullValues) {
    const ID = uuidv4();
    const text = customer.customerName;
    const tooltip =
      "ERP Number: " +
      customer.erpNumber +
      " // BP Number: " +
      customer.bpNumber;
    const properties = JSON.stringify(customer);

    selectionFinalResponse.elements[i] = {
      ID,
      type: "selection",
      text,
      tooltip,
      properties,
    };
    i = i + 1;
  }

  requestInformation.response = [selectionFinalResponse];
}

function generateFinalResponse(
  requestInformation,
  memoryInformation,
  selectedResponses
) {
  //We need to update the memory with the lastIntent and entity resqested values
  //entityName  : String; //>> It could be "erpNumber", "bpNumber", "customerName", "lastIntent", "entityRequested", ... "productName"
  // In selected responses we have the resource that generate the response in  "selectedResponses[X].resource"
  // TODO - This will select the first botIntent in selectedResponses, if none,
  // If botIntent MAster is "swb" then we have to generate the reponse (list)
  // then it will show FAQbot response

  let finalResponse = {};

  if (selectedResponses === true || !selectedResponses) {
    const userSentence = JSON.parse(requestInformation.action_properties).text;
    const memoryFullValues = {
      userSentence,
    };
    memory.updateMemoryInformation(memoryInformation, [memoryFullValues]);
    return;
  }

  const response = findTheBestResponse(selectedResponses);
  
  const responseExpected = requestInformation.responseExpected;

  if (selectedResponses[0].model === "lsa_tfidf_esrc_qa") {
    const responseId = uuidv4();
    const responseType = "chat";
    const relevanceThreshold = 40;
    if (selectedResponses[0].results.Relevance[0] > relevanceThreshold) {
      text = [
        "I have not a direct answer from the training I received, but looking into ESRC documentation I can see some possible answers that I show you here below:",
      ];
    } else {
      text = [
        "I have not a direct answer from the training I received, and looking into ESRC documentation I could not find an answer that I am confident enough to tell you, so I am sending this question to my human colleagues to see how they can help me to answer it next time.",
      ];
    }
    
    const elements = [];
    const lsiResultsAnswers = selectedResponses[0].results.A;
    const lsiResultsRelevance = selectedResponses[0].results.Relevance;
    const resultsLength = Object.keys(lsiResultsAnswers).length;
    for (let i = 0; i < resultsLength; i++) {
      if (lsiResultsRelevance[i] > 40) {
        const ID = uuidv4();
        const type = "list";
        const text = lsiResultsAnswers[i];
        const tooltip =  "Relevance: " + lsiResultsRelevance[i];
        const element = {
          ID,
          type,
          text,
          tooltip,
        };
        elements.push(element);
      }
    }

    const esrcLsiResponse = {
      responseId,
      responseType,
      text,
      elements,
    };
    return esrcLsiResponse;
  }

  if (!response) {
    const responseId = uuidv4();
    const responseType = "chat";
    const text = [
      "I think I have not answer to that question, could you please repeat using a different expression or check what I can help you with by asking for help.",
    ];
    const elements = [];
    const noFinalResponse = {
      responseId,
      responseType,
      text,
      elements,
    };
    if (responseExpected.includes("chat")) {
      return noFinalResponse;
    } else {
      return null;
    }
    
  }

  const botType = response.resource.type;
  const botMaster = response.resource.botMaster;
  const hasBotMessage = response.messages
    ? response.messages[0]
      ? true
      : false
    : false;

  if (
    (isBotIntent(botType) || isBotFaq(botType)) &&
    isCai(botMaster) &&
    hasBotMessage
  ) {
    // If it is CAI bot giving a response in message we will get that one as a response of SWB
    finalResponse = generateCaiFinalResponse(response);
    memory.updateIntentMemory(memoryInformation, response);
  } else if (isBotIntent(botType) && isSwitchboard(botMaster)) {
    // If the response is to be generated by SWB then we generate the response
    finalResponse = generateSwbFinalResponse(
      response,
      selectedResponses,
      requestInformation,
      memoryInformation
    );
    memory.updateIntentMemory(memoryInformation, response);
  } else {
    // TODO- Respond with there is no response
  }

  return finalResponse;
}

function findTheBestResponse(selectedResponses) {
  let bestResponse;
  for (response of selectedResponses) {
    const bestResponseBotType = bestResponse
      ? bestResponse.resource
        ? bestResponse.resource.type
        : undefined
      : undefined;
    const bestResponseIntentConfidence = response.nlp
      ? response.nlp.intents[0]
        ? response.nlp.intents[0].confidence
        : undefined
      : undefined;
    const bestResponseFaqConfidence = response.qna
      ? response.qna.faq.max_confidence
      : undefined;
    const responseBotType = response.resource.type;
    const responseIntentConfidence = response.nlp
      ? response.nlp.intents[0]
        ? response.nlp.intents[0].confidence
        : undefined
      : undefined;
    const responsefaqConfidence = response.qna
      ? response.qna.faq.max_confidence
      : undefined;

    if (responseBotType === "botIntent") {
      if (bestResponseBotType === "botIntent") {
        if (bestResponseIntentConfidence < responseIntentConfidence) {
          bestResponse = response;
        }
      } else {
        bestResponse = response;
      }
    } else if (responseBotType === "botFAQ") {
      if (bestResponseBotType === "botFAQ") {
        if (bestResponseFaqConfidence < responsefaqConfidence) {
          bestResponse = response;
        }
      } else if (bestResponseBotType === undefined) {
        bestResponse = response;
      }
    }
  }
  return bestResponse;
}

function generateCaiFinalResponse(response) {
  const responseId = uuidv4();
  const resourceId = response.resource.ID;
  const responseType = "chat";
  let text;
  let elements = [];

  const botMessage = response.messages[0];
  const botMessageType = botMessage.type;

  if (isText(botMessageType)) {
    text = [botMessage.content];
  }

  if (isButton(botMessageType)) {
    text = [botMessage.content.title];
    const buttons = botMessage.content.buttons;
    for (button of buttons) {
      const ID = uuidv4();
      const url = button.value;
      const text = button.title;
      const tooltip = button.value;
      const element = {
        ID,
        type: "button",
        url,
        text,
        tooltip,
      };
      elements.push(element);
    }
  }

  if (isPicture(botMessageType)) {
    const ID = uuidv4();
    const url = botMessage.content;
    const tooltip = botMessage.delay;
    const element = {
      ID,
      type: "picture",
      url,
      tooltip,
    };
    elements.push(element);
  }
  const caiFinalResponse = {
    responseId,
    resourceId,
    responseType,
    text,
    elements,
  };

  return caiFinalResponse;
}

const responseGenerator = {
  getassets: {
    resourceType: "model",
    resourceName: "asset_reccomendation",
    function: generateGetAssetsResponse,
  },
  getlinks: {
    resourceType: "model",
    resourceName: "links_search",
    function: generateGetLinksResponse,
  },
  helprequest: {
    resourceType: "swb",
    resourceName: "helpGererator",
    function: generateIntelligentAssistantHelp,
  },
  removememory: {
    resourceType: "swb",
    resourceName: "removeMemory",
    function: removeMemory,
  },
  triggerrpa: {
    resourceType: "swb",
    resourceName: "rpaTrigger",
    function: triggerRpa
  }
};



function generateSwbFinalResponse(
  response,
  selectedResponses,
  requestInformation,
  memoryInformation
) {
  let swbFinalResponse;
  const intent = response.nlp.intents[0]
    ? response.nlp.intents[0].slug
    : undefined;
  const responseGeneratorResourceType = responseGenerator[intent]
    ? responseGenerator[intent].resourceType
    : undefined;
  const responseGeneratorResourceName = responseGenerator[intent]
    ? responseGenerator[intent].resourceName
    : undefined;
  const responseGeneratorResponseTypeIn = responseGenerator[intent]
    ? responseGenerator[intent].responseTypeIn
    : undefined;

  //In case the response is generated with a SWB function as resource
  if (responseGeneratorResourceType === "swb") {
    const responseResource = response.resource
    swbFinalResponse = responseGenerator[intent].function(requestInformation, memoryInformation, responseResource);
    swbFinalResponse.responseType = "chat";
    return swbFinalResponse;
  }

  for (selectedResponse of selectedResponses) {
    const botType = selectedResponse.resource.type;
    const modelName = selectedResponse.model;
    if (
      botType == responseGeneratorResourceType &&
      modelName == responseGeneratorResourceName
    ) {
      swbFinalResponse = responseGenerator[intent].function(
        selectedResponse,
        responseGeneratorResponseTypeIn
      );
      // ***We are not persisting the intent when the answer is generated with SWB??
      //memory.updateIntentMemory(memoryInformation, response);
      break;
    }
  }
  swbFinalResponse.responseType = "chat";
  return swbFinalResponse;
}
function triggerRpa(requestInformation, memoryInformation, responseResource){
  const searchTerm = memoryInformation.currentMemory.searchTerm
  const rpaCalled = resource.callRpa(responseResource, searchTerm)
  
  const responseId = uuidv4();
  const responseType = "chat";
  const text = ["OK, I am executing that process for you..."];
  let elements = [];

  const finalResponseRpa = {
    responseId,
    responseType,
    text,
    elements,
  };
  return finalResponseRpa;

}

function removeMemory(requestInformation, memoryInformation){
  memory.updateMemoryInformation(memoryInformation, memoryInformation.previousMemory)
  const responseId = uuidv4();
    const responseType = "chat";
    const text = [
      "I have removed the memory.",
    ];
    const elements = [];
    const removeMemoryResponse = {
      responseId,
      responseType,
      text,
      elements,
    };
    return removeMemoryResponse;
}

function generateIntelligentAssistantHelp(requestInformation) {
  const resourcesCall = requestInformation.config;
  const resourcesAll = resource.getAllResources();
  let elements = [];
  for (let resource of resourcesCall) {
    const ID = uuidv4();
    const type = "list";
    const text = resourcesAll[resource].helpTitle;
    if (text) {
      const tooltip = resourcesAll[resource].helpDescription;
      const url = ""; //>> this one may be ampty in cases like Selection items where you are not navigating when selecting
      const properties = JSON.stringify({
        helpExamples: resourcesAll[resource].helpExamples,
        helpCommands: resourcesAll[resource].helpCommands,
      });
      const element = {
        ID,
        type,
        text,
        tooltip,
        url,
        properties,
      };
      elements.push(element);
    }
  }
  const responseId = uuidv4();
  //const resourceId = response.resource.ID; //Should we set a resource in this response??
  const responseType = "chat";
  const text = ["Here are some things I can help you with."];
  const finalResponseHelp = {
    responseId,
    //resourceId,
    responseType,
    text,
    elements,
  };
  return finalResponseHelp;
}

function generateGetAssetsResponse(response) {
  const responseId = uuidv4();
  const resourceId = response.resource.ID;
  const responseType = "assets";
  const text = ["This is the list of Assets I have found: "];
  let elements = [];
  const resultsTitle = response.results["Asset Name"];
  const resultsDescription = response.results.Description;
  const resultsUrl = response.results["Asset Type"];
  const resultsMatchPercentage = response.results["Match Percentage"];
  const resultsLength = Object.keys(resultsTitle).length;
  for (let i = 0; i < resultsLength; i++) {
    const ID = uuidv4();
    const type = "list";
    const text = resultsTitle[i];
    const tooltip = resultsDescription[i];
    const url = resultsUrl[i]; //>> this one may be ampty in cases like Selection items where you are not navigating when selecting
    const properties = JSON.stringify({matchPercentage: resultsMatchPercentage[i],});
    const element = {
      ID,
      type,
      text,
      tooltip,
      url,
      properties,
    };
    elements.push(element);
  }

  const finalResponseAssets = {
    responseId,
    resourceId,
    responseType,
    text,
    elements,
  };
  return finalResponseAssets;
}

function generateGetLinksResponse(response) {
  const responseId = uuidv4();
  const resourceId = response.resource.ID;
  const responseType = "links";
  const text = ["This is the list of Links I have found: "];
  let elements = [];
  const resultsTitle = response.results.Title;
  const resultsDescription = response.results.Description;
  const resultsUrl = response.results.Url;
  const resultsMatchPercentage = response.results["Match Percentage"];
  const resultsLength = Object.keys(resultsTitle).length;
  for (let i = 0; i < resultsLength; i++) {
    const ID = uuidv4();
    const type = "list";
    const text = resultsTitle[i];
    const tooltip = resultsDescription[i];
    const url = resultsUrl[i]; //>> this one may be ampty in cases like Selection items where you are not navigating when selecting
    //const properties = JSON.stringify({matchPercentage: resultsMatchPercentage[i],});
    const element = {
      ID,
      type,
      text,
      tooltip,
      url,
      //properties,
    };
    elements.push(element);
  }

  const finalResponseLinks = {
    responseId,
    resourceId,
    responseType,
    text,
    elements,
  };
  return finalResponseLinks;
}

const resourceResponseGenerator = {
  "links_search": {
    function: generateGetLinksResponse,
  },
  "asset_reccomendation": {
    function: generateGetAssetsResponse,
  },
  "esrc_qa_lsi": {
    function: generateEsrcLsiResponse,
  }
}

function generateEsrcLsiResponse(response) {
  const responseId = uuidv4();
  const resourceId = response.resource.ID;
  const responseType = "esrc_lsi";
  const text = ["These are the answers I have found: "];
  let elements = [];
  const resultsTitle = response.results.A;
  //const resultsDescription = response.results.Description;
  //const resultsUrl = response.results.Url;
  const resultsMatchPercentage = response.results.Relevance;
  const resultsLength = Object.keys(resultsTitle).length;
  for (let i = 0; i < resultsLength; i++) {
    const ID = uuidv4();
    const type = "list";
    const text = resultsTitle[i];
    const tooltip = "Answer conficende level: " + resultsMatchPercentage[i];
    //const url = resultsUrl[i]; //>> this one may be ampty in cases like Selection items where you are not navigating when selecting
    const properties = JSON.stringify({matchPercentage: resultsMatchPercentage[i],});
    const element = {
      ID,
      type,
      text,
      tooltip,
      //url,
      properties,
    };
    elements.push(element);
  }

  const finalResponseEsrcLsi = {
    responseId,
    resourceId,
    responseType,
    text,
    elements,
  };
  return finalResponseEsrcLsi;
}

function generateResourceResponse(response) {
  const resourceName = response.resource.name;
  let resourceResponse = resourceResponseGenerator[resourceName].function(response);
  resourceResponse.responseType = "resource";
  return resourceResponse;
}

function isRightResponse(requestInformation, response) {
  // TODO - We need to check that if it is botIntent type, that the intent is not "others" and
  // we also discard the empty responses (message empty) when the botMaster is "cai"
  // FAQBots response not taken into account if confidence is below the Threshols
  // responses from models and others are always right

  const botType = response.resource.type;
  const botMaster = response.resource.botMaster;
  const hasBotMessage = response.messages
    ? response.messages[0]
      ? true
      : false
    : false;
  const intent = response.nlp
    ? response.nlp.intents[0]
      ? response.nlp.intents[0].slug
      : undefined
    : undefined;

  const faqConfidence = response.qna
    ? response.qna.faq.max_confidence
    : undefined;
  if (isBotIntent(botType) && isNotOthers(intent)) {
    if (isCai(botMaster) && !hasBotMessage) {
      return false;
    }
    return true;
  }
  if (isBotFaq(botType) && isOverConfidenceThreshold(faqConfidence)) {
    return true;
  }
  if (isModel(botType)) {
    //Let's add the links result to the response if responseExpected == "links". We could do the same with "assets"
    const resourceName = response.resource.name;
    const responseExpected = requestInformation.responseExpected;
    if (resourceName === "links_search" && responseExpected.includes("links")) {
      const responseLinks = generateGetLinksResponse(response);
      request.updateRequestInformationResponse(
        requestInformation,
        responseLinks
      );
    }
    if (responseExpected.includes("resource")) {
      const responseResource = generateResourceResponse(response);
      request.updateRequestInformationResponse(
        requestInformation,
        responseResource
      );
    }
    return true;
  }
  if (isOther(botType)) {
    //We are going to send to the user the results of the other resources (help.sap and comunities.sap)
    const responseOther = generateOtherFinalResponse(
      response,
      requestInformation
    );
    request.updateRequestInformationResponse(requestInformation, responseOther);
    return true;
  }

  return false;
}

function generateOtherFinalResponse(response, requestInformation) {
  const responseExpected = requestInformation.responseExpected;
  const resourceName = response.resource.name;
  const responseId = uuidv4();
  const resourceId = response.resource.ID;

  const text = [];
  let elements = [];
  let responseType;
  if (resourceName === "helpSap" && responseExpected.includes("helpSap")) {
    const results = response.data.results;
    responseType = "help.sap";
    for (result of results) {
      const ID = uuidv4();
      const type = "list";
      const text = result.deliverableTitle;
      const tooltip = result.snippet;
      const url = "https://help.sap.com" + result.url; //>> this one may be ampty in cases like Selection items where you are not navigating when selecting
      const properties = JSON.stringify(result);
      const element = {
        ID,
        type,
        text,
        tooltip,
        url,
        properties,
      };
      elements.push(element);
    }
  } else if (
    resourceName === "communitySap" &&
    responseExpected.includes("blogs")
  ) {
    const results = response.contentItems;
    responseType = "blogs";
    for (result of results) {
      const ID = uuidv4();
      const type = "list";
      const text = result.title;
      const tooltip = result.excerpt;
      const url = result.url; //>> this one may be ampty in cases like Selection items where you are not navigating when selecting
      const properties = JSON.stringify(result);
      const element = {
        ID,
        type,
        text,
        tooltip,
        url,
        properties,
      };
      elements.push(element);
    }
  }
  const finalResponseOthers = {
    responseId,
    resourceId,
    responseType,
    text,
    elements,
  };
  return finalResponseOthers;
}

function generateMemoryResponse(requestInformation, memoryInformation) {
  const memories = memory.formatMemoryForBots(
    memoryInformation.previousMemory,
    memoryInformation.currentMemory
  );
  const responseId = uuidv4();
  const responseType = "memory";
  const ID = uuidv4();
  const type = "object";
  let text = "Bot memory";
  const tooltip =
    "This is the memory values of the bot for this user and this conversation";
  const properties = JSON.stringify(memories);
  const elements = [
    {
      ID,
      type,
      text,
      tooltip,
      properties,
    },
  ];
  text = [];
  const memoryResponse = {
    responseId,
    responseType,
    text,
    elements,
  };
  return memoryResponse;
}
