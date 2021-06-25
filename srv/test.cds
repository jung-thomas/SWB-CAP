//This is another way to provide parameters to the API, but I think it is better to do the POST aproach than this with GET + parameters...

service NewRequest {
    function response(session : String, query : String) returns String;
}
