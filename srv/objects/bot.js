const axios = require("axios");
const communityUrl = "https://api.cai.tools.sap/"
const dialogPath = "build/v1/dialog"

class Bot {
  constructor(
    ID,
    name,
    type,
    description,
    botMaster,
    botToken,
    language,
    translation,
    url,
    processingTime
  ) {
    this.ID = ID;
    this.name = name;
    this.type = type;
    this.description = description;
    this.botMaster = botMaster;
    this.botToken = botToken;
    this.language = language;
    this.translation = translation;
    this.url = url;
    this.processingTime = processingTime;
  }

  call(session, sentence, memory) {
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
          "Content-Type": "application/json",
          Authorization: "Token " + this.botToken,
        },
        data: data,
      };
      let response = await axios(config);
      response = response.data.results;
      response["resource"] = resource;
      return response;
  }
}

export {Bot}
