const axios = require("axios");

module.exports = {
  translateRequest: async function (requestInformation) {
    const languageDetected = await module.exports.checkLanguage(
      requestInformation
    );

    let sentence = JSON.parse(requestInformation.action_properties).text;

    if (languageDetected != "en-US") {
      sentence = await module.exports.translateFromSourceToTarget(
        languageDetected,
        "en-US",
        sentence
      );
      return sentence;
    } else {
      return sentence;
    }
  },

  translateResponse: async function (requestInformation) {
    // TODO
  },

  translateFromSourceToTarget: async function (
    sourceLanguage,
    targetLanguage,
    sentence
  ) {
    data = JSON.stringify({
      sourceLanguage: sourceLanguage,
      targetLanguage: targetLanguage,
      file: sentence,
    });
    config = {
      method: "post",
      url: "https://translation.cfapps.sap.hana.ondemand.com/translate",
      headers: {
        "Content-Type": "application/json",
      },
      data: data,
    };
    const response = await axios(config);
    return response.data;
  },

  checkLanguage: async function (requestInformation) {
    const data = requestInformation.action_properties;
    const config = {
      method: "post",
      url:
        "https://translation.cfapps.sap.hana.ondemand.com/text_classification",
      headers: {
        "Content-Type": "application/json",
      },
      data: data,
    };
    const response = await axios(config);
    const languageDetected = response.data;
    //const languageDetected = "en-US";
    return languageDetected;
  },
};
