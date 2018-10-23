var mock = require('./index');
var pinkiePromise = require('pinkie-promise');

module.exports = function(opts) {
  return new pinkiePromise(function(resolve, reject) {
    mock(opts || {}, function(err, server) {
      if (err) {
        reject(err);
      } else {
        resolve(server);
      }
    });
  });
};
