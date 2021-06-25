module.exports = (NewRequest) => {
  NewRequest.on(
    "response",
    (req) => `Session: ${req.data.session} and query: ${req.data.query}!`
  );
};
