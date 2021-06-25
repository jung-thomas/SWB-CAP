using swb.memory as swb from '../db/data-model';

service MemoryService {
    entity Sessions @readonly       as projection on swb.Sessions;
    entity Requests @readonly       as projection on swb.Requests;
    entity Resources @readonly      as projection on swb.Resources;
    entity ThumbsFeedback @readonly as projection on swb.ThumbsFeedback;
    entity Memories @readonly       as projection on swb.Memories;
}
