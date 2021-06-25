using {
    cuid,
    managed
} from '@sap/cds/common';

namespace swb.memory;

type Action {
    type       : String; //>> It can be "userSentence", "buttonClick", "selection", "listItemClick", "tableItemClick", "resourceCall"
    responseId : UUID; //>> This is the last response ID received in the UI. MAybe this is not needed as this is persisted in memory and always read
    properties : String; //>> This contains the sentence JSON.stringify({text: "sentence"}) or some important values related with the action type JSON.stringify(selection made, list item clicked....)
}

type Element {
    ID         : UUID;
    type       : String; //>> type could be "picture", "button", "selection", "list", **"table" . Pictures and gifs are URLs. table needs to be analyzed if it should be a different property of the entity...
    text       : String;
    tooltip    : String;
    url        : String; //>> this one may be ampty in cases like Selection items where you are not navigating when selecting
    properties : String; //>> This might be JSON.stringify of several different parameters related with the element type. Incustomer selection for example (ERPnumber, BPnumber and name)
}

type Response {
    responseId   : UUID; //>> we send the responseId to the client in case the client uses it??
    resourceId   : UUID; //>> Which are the resources that provides the response
    responseType : String; //>> This could be "help.sap", "blogs", "links", "chat"...
    text         : array of String; //>> What is the IA response expressions. More than one is possible
    elements     : array of Element; //these are interactive elements like buttons, selection items, lists items, table items; *Maybe tables can be changed
}

//>> It could be "erpNumber", "bpNumber", "customerName", "resource", "intent", "entityRequested", "availableEntity" ...
//   "productName", "resource", "intent", "entityRequested", "availableEntity" indicates the resource, the intent and the entities that has been requested by the intent and the ones the intentdeal with
type Memory {
    entityName  : String;
    entityValue : array of String;
}

//@cds.persistence.skip
entity Requests : cuid, managed {
    session          : Association to Sessions;
    config           : array of UUID; //>> Thia ia the array od resources to call
    responseExpected : array of String; //>> It could be "chat", "helpSap", "blogs", "links", "memory"...
    action           : Action;
    response         : array of Response; //>> It could be more than one response from different resources
}

entity Sessions : cuid, managed {
    user : String;
}

entity Resources : cuid, managed {
    type            : String; //>> It can be : "botIntent", "botFAQ" "model", "other"
    name            : String;
    description     : String;
    botMaster       : String; //>> We can use this with possible values "cai" or "swb", or configuring CAI to reply nothing or something specific when SWB is master
    botToken        : String;
    language        : String;
    translation     : Boolean;
    url             : String;
    processingTime  : String; //>> It can be "short", "medium", "long". Short and medium execute all together gouping them in two groups. Long are executed one by one.
    helpTitle       : String;
    helpDescription : String;
    helpExamples    : String; //>> HTML text to be printed as examples
    helpCommands    : array of String;
    clientId        : String;
    clientSecret    : String;
}

entity Memories : cuid, managed {
    user    : String;
    request : Association to Requests;
    memory  : Memory;
    latest  : Boolean;
}

entity ThumbsFeedback : cuid, managed {
    user      : String;
    requestId : UUID;
    value     : Boolean;
    comment   : array of String;
}

entity IntrinsicFeedback : cuid, managed {
    session    : Association to Sessions;
    responseId : UUID;
    elementId  : UUID;

}
