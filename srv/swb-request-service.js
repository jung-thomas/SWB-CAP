const cds = require("@sap/cds");
const request = require("./utils/request.js");
const memory = require("./utils/memory.js");
const action = require("./utils/action.js");
const feedback = require("./utils/feedback.js");

module.exports = (srv) => {
  //READ will be accessed by a GET HTTP request to /Response
  srv.on("CREATE", "Response", async (req) => {
    // We initialize the db service connection and transaction so that this is done once while processing the request
    const dbService = await cds.connect.to("db");
    const dbTx = dbService.transaction(req);

    // We get the authenticated user
    const user = req.user.id;

    // We create the variables that will contain values to be persisten in DB related with the request/response and the memory
    let requestInformation = request.createRequestInformation();
    let feedbackInformation = feedback.createFeedbackInformation();
    let memoryInformation = await memory.createMemoryInformation(
      user,
      requestInformation.ID,
      dbService,
      dbTx
    );

    //We copy the request body values in the requestInformation variable to be used during reqeust Mangement
    requestInformation.session = req.data.session_ID;
    requestInformation.responseExpected = req.data.responseExpected;
    requestInformation.config = req.data.config;
    requestInformation.action_type = req.data.action_type;
    requestInformation.action_properties = req.data.action_properties;
    requestInformation.action_responseId = req.data.action_responseId;
    await request.manageRequestSession(
      requestInformation,
      memoryInformation,
      dbService,
      dbTx
    );

    if (action[requestInformation.action_type]) {
      requestInformation.response = await action[
        requestInformation.action_type
      ](requestInformation, memoryInformation, feedbackInformation);
    } else {
      // TODO -  Reply with error
    }

    /************************ */
    // TODO - This needs to be taking into account when we receive the POST with the real body

    requestInformation.session_ID = requestInformation.session;
    delete requestInformation.session;

    // We clone the oject like this as '=' reference the objects as a pointer...
    // And because when persisting requestInformation in DB the variable is transformed in the inseert statement stringifying and adding ModifiedAt, etc...
    const reply = { ...requestInformation };

    await request.persistRequestInformation(
      requestInformation,
      dbService,
      dbTx
    );

    await memory.persistMemoryInformation(memoryInformation, dbService, dbTx);
    if (feedbackInformation.elementId !== "") {
      await feedback.persistFeedbackInformation(
        feedbackInformation,
        dbService,
        dbTx
      );
    }
    

    return req.reply(reply);
  });

  srv.on("READ", "Response", async (req) => {
    //srv.on("CREATE", "Response", async (req) => {

    // We initialize the db service connection and transaction so that this is done once while processing the request
    const dbService = await cds.connect.to("db");
    const dbTx = dbService.transaction(req);

    // We get the authenticated user
    const user = req.user.id;

    // We create the variables that will contain values to be persisten in DB related with the request/response and the memory
    let requestInformation = request.createRequestInformation();
    let memoryInformation = await memory.createMemoryInformation(
      user,
      requestInformation.ID,
      dbService,
      dbTx
    );

    //We copy the request body values in the requestInformation variable to be used during reqeust MAangement
    /*
    requestInformation.session = req.data.session_ID;
    requestInformation.config = req.data.config;
    requestInformation.action = req.data.action;
    */
    requestInformation.session = "478362c1-77c0-41b5-9464-000000000001";
    requestInformation.config = [
      "a7a1c073-54f1-49e2-881b-c63b0bb85129",
      "1c203244-7357-4d4b-a531-518a10b93c7d",
      "5304f148-8adb-4df6-82b1-c46a27a81e2a",
      "620ab974-c3e3-4c6c-a470-9b8c4355c4a1",
      "7d4eeaac-a3d4-44ab-8a62-d8bd9dce1569",
      "8fa45fd5-6552-4aab-94e1-27c14d487787",
      "b07fa1e7-68c5-4877-8f3e-74a2f37d9fe0",
      "c4470b1a-b01e-4cf4-a1ca-177b023c6671",
      "d251b3f5-4669-4d4e-a6c2-39ccff73d9a6",
      "f43e3094-d77e-4f11-81f9-0fedf5bb3647",
    ];
    requestInformation.action = {
      type: "userSentence",
      properties: JSON.stringify({
        text: "what is the landscape of the customer",
        //text: "lol",
        //text: "which services are there for successfactors talent management",
      }),
    };

    // TODO - SELECTION client request
    /*
    requestInformation.action = {
      type: "selection",
      properties: JSON.stringify({
        customerSelection: {
          customerName: "AIR FRANCE",
          erpNumber: "123254456",
          bpNumber: "1452",
        },
      }),
    };
*/

    await request.manageRequestSession(
      requestInformation,
      memoryInformation,
      dbService,
      dbTx
    );

    if (action[requestInformation.action.type]) {
      requestInformation.response = await action[
        requestInformation.action.type
      ](requestInformation, memoryInformation);
    } else {
      // TODO -  Reply with error
    }

    /************************ */
    // TODO - This needs to be taking into account when we receive the POST with the real body

    requestInformation.action_type = JSON.stringify(
      requestInformation.action.type
    );
    requestInformation.action_properties = JSON.stringify(
      requestInformation.action.properties
    );
    delete requestInformation.action;
    requestInformation.session_ID = requestInformation.session;
    delete requestInformation.session;

    // We clone the oject like this as '=' reference the objects as a pointer...
    // And because when persisting requestInformation in DB the variable is transformed in the inseert statement stringifying and adding ModifiedAt, etc...
    const reply = { ...requestInformation };

    await request.persistRequestInformation(
      requestInformation,
      dbService,
      dbTx
    );

    await memory.persistMemoryInformation(memoryInformation, dbService, dbTx);

    return req.reply(reply);
  });
};

/* TODO - Group the services into files so that the code is cleaner
const create = require('./SWB/create')
const read = require('./SWB/read')

module.exports = (srv) => {
  //READ will be accessed by a GET HTTP request to /Response
  srv.on("CREATE", "Response", create )
  srv.on("READ", "Response", read

}
*/
