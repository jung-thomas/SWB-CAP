using swb.memory as swb from '../db/data-model';

service RequestService { //@(requires : 'authenticated-user') {

    //This is an entity that is here only to facilitate the reception of values in the POST call body
    //and return the response back to the client
    entity Response as
        select from swb.Requests {
            ID,
            session,
            responseExpected,
            config,
            action,
            response
        };

    //This one is here but I think it could be removed and use the one that is available in service Memory in swb-memory.service
    entity IntrinsicFeedback as projection on swb.IntrinsicFeedback;
    entity Sessions          as projection on swb.Sessions;
    entity Resources         as projection on swb.Resources;
    entity Memories          as projection on swb.Memories;

}
