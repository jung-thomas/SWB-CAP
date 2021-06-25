const cds = require("@sap/cds");
const { v4: uuidv4 } = require("uuid");

module.exports = (srv) => {
  srv.on("CREATE", "Feedback", async (req) => {
    const dbService = await cds.connect.to("db");
    const dbTx = dbService.transaction(req);

    let feedback = {
      ID: uuidv4(),
      requestId: req.data.requestId,
      value: req.data.value,
      comment: req.data.comment,
    };
    const reply = {...feedback}
    const requestId = feedback.requestId;
    ;
    /*
    const feedbackToInsert = prepareFeedbackInformationRecordsToInsert(
      feedback
    );
    */

    const feedbackInDb = await readFeedbackInformation(
      requestId,
      dbService,
      dbTx
    );

    //check for requet ID and uodate instead of insert if it already exists
    if (feedbackInDb.length !== 0) {
      reply.ID = feedbackInDb[0].ID
      const comment = feedback.comment;
      if (comment && feedbackInDb[0].comment) {
        if (!feedbackInDb[0].comment.includes(feedback.comment[0])) {
          feedbackInDb[0].comment.push(feedback.comment[0]);
          feedback.comment = feedbackInDb[0].comment;
        } else {
          feedback.comment = feedbackInDb[0].comment;
        }
      }
      await deleteFeedbackInformationInDb(feedback, dbService, dbTx);
      await insertFeedbackInformationInDb(feedback, dbService, dbTx);
    } else {
      await insertFeedbackInformationInDb(feedback, dbService, dbTx);
    }

    
 
    return req.reply(reply);
  });

};
// TODO -Read memory from DB
    async function readFeedbackInformation(requestId, dbService, dbTx) {
      const { ThumbsFeedback } = dbService.entities;
      const requestedFeedback = await dbTx.run(
        SELECT.from(ThumbsFeedback).where({ requestId: { "=": requestId } })
      );
      return requestedFeedback;
    }

    async function insertFeedbackInformationInDb(feedback, dbService, dbTx) {
      const { ThumbsFeedback } = dbService.entities;
      await dbTx.run(INSERT.into(ThumbsFeedback).entries(feedback));
      await dbTx.commit();
    }

    async function deleteFeedbackInformationInDb(feedback, dbService, dbTx) {
      const { ThumbsFeedback } = dbService.entities;
      const query =
        "DELETE from swb_memory_ThumbsFeedback WHERE requestId = '" +
        feedback.requestId +
        "'";
      await dbTx.run(query);
    }

    async function updateFeedbackInformationInDb(feedback, dbService, dbTx) {
      const { ThumbsFeedback } = dbService.entities;
      const query = feedback.comment
        ? "UPDATE swb_memory_ThumbsFeedback SET value = " +
          feedback.value +
          " AND comment = '" +
          feedback.comment +
          "' WHERE requestId = '" +
          feedback.requestId +
          "'"
        : "UPDATE swb_memory_ThumbsFeedback SET value = " +
          feedback.value +
          " WHERE requestId = '" +
          feedback.requestId +
          "'";

      await dbTx.run(query);
      /*       await dbTx.run(INSERT.into(ThumbsFeedback).where({ request: { "=": requestId } })) 
      await dbTx.commit(); */
    }