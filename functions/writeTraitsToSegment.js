const { Analytics } = require('@segment/analytics-node');

exports.handler = async function(context, event, callback) {
    console.log("Event: ", JSON.stringify(event));
    console.log("context: ", JSON.stringify(context));
    console.log("callback: ", JSON.stringify(callback));

    const userIdcookie = event.request.cookies.userId;
    const userId = userIdcookie ? JSON.parse(decodeURIComponent(userIdcookie)) : null;

    console.log("userId: ", userId);
    console.log("user 2:", event.userId);
    console.log("user 3:", event.request.headers.cookies.userId);
    console.log("user 4:", event.request.cookies.userId);

    //console.log("traits: ", traits);
/*
    const analytics = new Analytics({ writeKey: context.SEGMENT_WRITE_KEY });

    try {
        console.log("Writing traits to segment:", traits);
        await new Promise((resolve) =>
            analytics.identify({
                userId: userId,
            traits: traits 
                }, resolve)
          )
        console.log("Successfully wrote traits to segment. Traits: ", traits);
        callback(null, "Success");
    } catch (error) {
        console.error("Error writing traits to segment:", error);
        callback(error);
    }*/
};