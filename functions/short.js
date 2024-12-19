const twilio = require('twilio');

exports.handler = async function(context, event, callback) {
    console.log("short.js");

    const response = new twilio.Response();
    response.appendHeader('Content-Type', 'application/json');
    response.setBody({ message: "Success" });

    callback(null, response);
};