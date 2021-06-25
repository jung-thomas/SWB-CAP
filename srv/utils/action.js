const language = require("./language.js");
const resource = require("./resource.js");
const response = require("./response.js");
const memory = require("./memory.js");

module.exports = {
  userSentence: userSentenceManagement,
  buttonClick: buttonClickManagement,
  selection: selectionManagement,
  listItemClick: listItemClickManagement,
  tableItemClick: tableItemClickManagement,
  resourceCall: resourceCallManagement,
};

/////////////////////////////////////////////////////////////////////////
// USER SENTENCE
// Thsi is the logic to be executed when the action received is a sentence from the user
////////////////////////////////////////////////////////////////////////
async function userSentenceManagement(requestInformation, memoryInformation) {
  // We check the read the sentence and we translate into english if it is a different language
  const sentence = await language.translateRequest(requestInformation);
  const resourcesResponse = await resource.callResources(
    requestInformation,
    memoryInformation,
    sentence
  );
  const finalResponse = await response.responseManagement(
    requestInformation,
    memoryInformation,
    resourcesResponse
  );

  //****************************** */
  //TODO - The array is added here but this should be comming directly in the response
  return finalResponse;
}

// TODO-
function buttonClickManagement(
  requestInformation,
  memoryInformation,
  feedbackInformation
) {
  //intrinsic feedback collection + future functionality
  feedbackInformation.responseId = requestInformation.action_responseId;
  feedbackInformation.session_ID = requestInformation.session;
  feedbackInformation.elementId = JSON.parse(
    requestInformation.action_properties
  ).elementId;

  return [];
}

async function selectionManagement(requestInformation, memoryInformation) {
  /// TODO-
  // We have to write the customer/entity selected into Memory
  // We need to define the logic to check if there were not fulfilled intents waiting for the user to select the right customer/entity
  const customerSelected = [];
  customerSelected.push(JSON.parse(requestInformation.action_properties));
  memory.updateMemoryInformation(memoryInformation, customerSelected);
  
  const resourcesResponse = undefined;
  const finalResponse = await response.responseManagement(
    requestInformation,
    memoryInformation,
    resourcesResponse
  );

  //****************************** */
  //TODO - The array is added here but this should be comming directly in the response
  return finalResponse;
}

function listItemClickManagement(
  requestInformation,
  memoryInformation,
  feedbackInformation
) {
  //intrinsic feedback collection
  feedbackInformation.responseId = requestInformation.action_responseId;
  feedbackInformation.session_ID = requestInformation.session;
  feedbackInformation.elementId = JSON.parse(
    requestInformation.action_properties
  ).elementId;

  return [];
}

function tableItemClickManagement(
  requestInformation,
  memoryInformation,
  feedbackInformation
) {
  feedbackInformation.responseId = requestInformation.action_responseId;
  feedbackInformation.session_ID = requestInformation.session;
  feedbackInformation.elementId = JSON.parse(
    requestInformation.action_properties
  ).elementId;

  return [];
  //intrinsic feedback collection
}

async function resourceCallManagement(requestInformation,
  memoryInformation
) {
  const sentence = await language.translateRequest(requestInformation);
  const resourcesResponse = await resource.callResources(
    requestInformation,
    memoryInformation,
    sentence
  );
  const finalResponse = await response.responseManagement(
    requestInformation,
    memoryInformation,
    resourcesResponse
  );

 return finalResponse;
}