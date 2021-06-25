const cds = require("@sap/cds");
const axios = require("axios");
const memory = require("./memory.js");

let resources;

module.exports = {

  callRpa: async function (resource, searchTerm) {
    
    triggerRpa(resource, searchTerm)
    return true
  },

  callResources: async function (
    requestInformation,
    memoryInformation,
    sentence
  ) {
    // If resources have not been read from DB we read from there in order to use it for all the rest of requests.
    // We can maybe add another check that makes the resources to be updated everyday
    if (!resources) {
      resources = await readResources();
    }

    const resourcesCallPromisses = prepareResources(
      requestInformation,
      memoryInformation,
      sentence
    );

    const responses = await Promise.all(resourcesCallPromisses);
    return responses;
    /*
    return new Promise((resolve, reject)=> {
      const responsesModels = Promise.all(promisesModels)
      const responsesBots = await Promise.all(bots)

      if(everythingOK){
        resolve(responsesBots)
      }

      responsesModels.then( res=> {
        // logic with models
        // when logic done
        resolve(dataToBeReturned)
      }).catch(e =>{
        // insert on error
        reject('Oops! Something went wrong')
      })

    })
*/
  },

  callResourcesPending: async function (resourcePending, memoryInformation, requestInformation) {
    // TODO
    if (!resources) {
      resources = await readResources();
    }

    const sentence = memoryInformation.previousMemory.userSentence? memoryInformation.previousMemory.userSentence[0] : undefined;
    if (!sentence) return [];
    const memories = memory.formatMemoryForBots(
      memoryInformation.previousMemory,
      memoryInformation.currentMemory
    );
    // TODO - ADD the fact that resourcePending could be an array of resources...
    const resourcesPendingCallPromisses = resourcePending.map((resource) =>
      generatePromise(requestInformation, memories, resource, sentence)
    );
    const responsesPending = await Promise.all(resourcesPendingCallPromisses);
    
    return responsesPending;
    
  },
  callResourcesToRecall: async function (resourceToRecall, memoryInformation, requestInformation) {
    // TODO
    if (!resources) {
      resources = await readResources();
    }
    const sentence = JSON.parse(requestInformation.action_properties).text;
    if (!sentence) return [];
    const memories = memory.formatMemoryForBots(
      memoryInformation.previousMemory,
      memoryInformation.currentMemory
    );
    // TODO - ADD the fact that resourceToRecall could be an array of resources...
    const resourcesPendingCallPromisses = resourceToRecall.map((resource) =>
      generatePromise(requestInformation, memories, resource, sentence)
    );
    const responsesPending = await Promise.all(resourcesPendingCallPromisses);
    
    return responsesPending;
    
  },

  getAllResources: function() {
    return resources;
  },


};

const communityUrl = "https://api.cai.tools.sap/";
const dialogPath = "build/v1/dialog";

async function readResources() {
  const request = await cds.connect.to("RequestService");
  const resources = await request.read("Resources");
  
  let resourcesToObject = {};
  for (resource of resources) {
    resourcesToObject[resource.ID] = resource;
  }
  return resourcesToObject;
}

function prepareResources(requestInformation, memoryInformation, sentence) {
  // TODO - We may need to separate the paralelization into different groups depending on resources type or resources execution time...
  //For the moment all the botIntent and model resources are going to be executed in parallel
  //Also the botFaq, and others will be executed in parallel and only awaited when returning the response to the client
  //        This can be done grouping the resources before callling generatePromise

  // WE have to send the previousMEmory + currentMemory to the Bot, not only previous memory values, but updated with current ones. and not into an array
  const memories = memory.formatMemoryForBots(
    memoryInformation.previousMemory,
    memoryInformation.currentMemory
  );

  const resourcesCallPromisses = requestInformation.config.map((resource) =>
    generatePromise(requestInformation, memories, resource, sentence)
  );
  return resourcesCallPromisses;
}

// These are the pointers to the functions to call the different resources depending on the resource type
const resourceType = {
  botIntent: callBot,
  botFAQ: callBot,
  model: callModel,
  other: callOthers,
};

async function generatePromise(requestInformation, memory, resource, sentence) {
  const session = requestInformation.session;

  const response = resourceType[resources[resource].type](
    resources[resource],
    sentence,
    memory,
    session
  );

  return response;
}

async function callSingleResource(
  resourceId,
  sentence,
  memoryInformation,
  session
) {
  const memories = memory.formatMemoryForBots(
    memoryInformation.previousMemory,
    memoryInformation.currentMemory
  );

  const response = resourceType[resources[resourceId].type](
    resources[resourceId],
    sentence,
    memories,
    session
  );

  return response;
}

const authUrl = "https://sapcai-community.authentication.eu10.hana.ondemand.com/oauth/token"
const grantType = "?grant_type=client_credentials&response_type=token"

const accessTokenUrl = "https://eaf56515trial.authentication.eu10.hana.ondemand.com/oauth/token"
const rpaApiUrl= "https://api.irpa-trial.cfapps.eu10.hana.ondemand.com/runtime/v1/apiTriggers/20ab6eb6-c893-47e8-b70c-993a9dfa1cde/runs"

async function getRpaToken(resource){
  const data = JSON.stringify({})
  const authorization = Buffer.from('sb-833f5ac0-2f8f-4462-9f3f-982e3983efb9!b66558|sapmlirpa--irpatrial--trial--uaa-service-broker!b30610:0m4UCtaOvjyJSL+oOclE4I4G+fA=', 'binary').toString('base64')
  config = {
    method: "post",
    url: accessTokenUrl + grantType,
    headers: {
      Authorization: "Basic " + authorization,
    },
    data: data,
  };
  let response = await axios(config);
  response = response.data.access_token;
  console.log(response)
  return response;
}

async function triggerRpa(resource, input) {
  const token = await getRpaToken(resource);
  const data = JSON.stringify({
      input: {"contains" :input},
  });

  config = {
    method: "post",
    url: rpaApiUrl,
    headers: {
      "irpa-api-key": "mJBOSnCouL4RH7QGVYnqhlOXl2U_qW-Z",
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    },
    data: data,
  };
  let response = await axios(config);
  return response;
}

async function getToken(resource) {
  const data = JSON.stringify({})
  const authorization = Buffer.from(resource.clientId + ':' + resource.clientSecret, 'binary').toString('base64')
  config = {
    method: "post",
    url: authUrl + grantType,
    headers: {
      Authorization: "Basic " + authorization,
    },
    data: data,
  };
  let response = await axios(config);
  response = response.data.access_token;
  return response;
}

async function callBot(resource, sentence, memory, session) {
  const token = await getToken(resource);
  const data = JSON.stringify({
    message: {
      type: "text",
      content: sentence,
    },
    conversation_id: session,
    log_level: "info",
    memory: memory,
    merge_memory: true,
  });

  config = {
    method: "post",
    url: communityUrl + dialogPath,
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json",
      "X-Token": "Token " + resource.botToken,
    },
    data: data,
  };
  let response = await axios(config);
  response = response.data.results;
  response["resource"] = resource;
  return response;
}

async function callModel(resource, sentence) {
  const data = JSON.stringify({
    query: sentence,
  });
  config = {
    method: "post",
    url: resource.url,
    headers: {
      "Content-Type": "application/json",
    },
    data: data,
  };
  let response = await axios(config);
  response = response.data;
  response["resource"] = resource;
  return response;
}

async function callOthers(resource, sentence) {
  const url = replaceKeywordsInUrl(resource.url, { query: sentence });
  const config = {
    method: "get",
    url: url,
  };
  let response = await axios(config);
  response = response.data;
  response["resource"] = resource;
  return response;
}

function replaceKeywordsInUrl(url, keywords) {
  let convertedUrl = "";
  if (url == undefined) {
    return convertedUrl;
  } else {
    let matches = url.match(/{{([A-Za-z0-9_-]*)}}/g);
    convertedUrl = url;
    for (match in matches) {
      convertedUrl = url.replace(
        /{{([A-Za-z0-9_-]*)}}/,
        keywords[matches[match].match(/{{([A-Za-z0-9_-]*)}}/)[1]]
      );
    }
    return convertedUrl;
  }
}
