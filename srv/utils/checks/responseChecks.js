const faqConfidenceThreshold = 0.6;

module.exports = {
  isBotIntent: function (botType) {
    return botType === "botIntent";
  },
  isBotFaq: function (botType) {
    return botType === "botFAQ";
  },
  isModel: function (botType) {
    return botType === "model";
  },
  isOther: function (botType) {
    return botType === "other";
  },
  isCai: function (botMaster) {
    return botMaster === "cai";
  },
  isSwitchboard: function (botMaster) {
    return botMaster === "swb";
  },
  isNotOthers: function (intent) {
    return intent !== "others";
  },
  isText: function (messageType) {
    return messageType === "text";
  },
  isButton: function (messageType) {
    return messageType === "buttons";
  },
  isPicture: function (messageType) {
    return messageType === "picture";
  },
  isOverConfidenceThreshold: function (faqConfidence) {
    return faqConfidence > faqConfidenceThreshold;
  },
};
