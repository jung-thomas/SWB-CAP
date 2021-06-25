const { v4: uuidv4 } = require("uuid");
const cds = require("@sap/cds");

module.exports = {
  ////////////////////////////////////////////////////////////////////////////////////////////////
  // REQUEST INFORMATION
  // requestInformation is going to be the internal variable where we will be persisting all the information related with the request
  // and that will be persisted when the response is sent
  ////////////////////////////////////////////////////////////////////////////////////////////////

  createRequestInformation: function () {
    const requestInformation = {
      ID: uuidv4(), // We generate the ID of the request not to wait for the DB to autogenerate one and include it in the response
      session: "",
      responseExpected: [],
      config: [],
      action_type: "",
      action_properties: "",
      response: [],
    };

    return requestInformation;
  },

  // update the response property in requestInformation variable
  updateRequestInformationResponse: function (
    requestInformation,
    finalResponse
  ) {
    if (finalResponse) {
      requestInformation.response.push(finalResponse);
    }
    
  },

  // Write the request in DB
  writeRequestInformation: function (requestInformation) {},

  //This fucntion creates a Session if the session with the ID provided in the request does not exist in DB
  //We also check that the user is the same one that is authenticated
  manageRequestSession: async function (
    requestInformation,
    memoryInformation,
    dbService,
    dbTx
  ) {
    const { Sessions } = dbService.entities;

    if (!requestInformation.session) {
      // No session provided by client
      // TODO - Send a error response 400 saying that there is no session ID and that this needs to be provided
      // or generate a new session id when there is no session provided by the client app
    }

    if (requestInformation.session) {
      session = await dbTx.run(
        SELECT.from(Sessions).where({ ID: { "=": requestInformation.session } })
      );
      if (session.length == 0) {
        //There is not an existing session created with this ID for this user. Let's now write in entity sessions a new session
        //TODO - WE have to see if we need to wait till the session is created in db, or if we postpone the write into DB action to the end of the request process
        await dbTx.run(
          INSERT.into(Sessions).entries({
            ID: requestInformation.session,
            user: memoryInformation.user,
          })
        );
        await dbTx.commit();
      } else {
        if (session[0].user != memoryInformation.user) {
          //TODO - User is not the same as the one maintained in the session. We nend to throw an error
        }
      }
    }
    return requestInformation;
  },

  persistRequestInformation: async function (
    requestInformation,
    dbService,
    dbTx
  ) {
    const { Requests } = dbService.entities;

    await dbTx.run(INSERT.into(Requests).entries(requestInformation));
    await dbTx.commit();
  },
};
