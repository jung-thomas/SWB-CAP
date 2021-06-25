const cds = require("@sap/cds");
const { v4: uuidv4 } = require("uuid");

module.exports = {
  createFeedbackInformation: function () {
    const feedbackInformation = {
      ID: uuidv4(), // We generate the ID of the request not to wait for the DB to autogenerate one and include it in the response
      session_ID: "",
      responseId: "",
      elementId: "",
    };

    return feedbackInformation;
  },

  persistFeedbackInformation: async function (
    feedbackInformation,
    dbService,
    dbTx
  ) {
    const { IntrinsicFeedback } = dbService.entities;

    await dbTx.run(INSERT.into(IntrinsicFeedback).entries(feedbackInformation));
    await dbTx.commit();
  },
};

/* 
entity IntrinsicFeedback : cuid, managed {
    session   : UUID;
    responseId   : UUID;
    elementId : UUID;
    
}
 */
