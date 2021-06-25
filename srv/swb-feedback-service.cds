using swb.memory as swb from '../db/data-model';

service FeedbackCollection {
    entity Feedback as
        select from swb.ThumbsFeedback {
        ID,
        requestId,
        value,
        comment
        };
}
