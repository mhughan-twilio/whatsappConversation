const twilio = require('twilio');
const { Analytics } = require('@segment/analytics-node');
const { OpenAI } = require("openai");

exports.handler = async function(context, event, callback) {

    // Extract the necessary information from the incoming event
    const { 
        To: toNumber, 
        From: fromNumber, 
        Body: lastMessage, 
        ProfileName: name, 
        ReferralBody: AdReferralBody, 
        ReferralSourceURL: AdReferralSourceURL
    } = event;
    console.log("lastMessage:", lastMessage); 

    // Initialize Twilio, Segment, OpenAI clients
    const client = context.getTwilioClient();
    const openai = new OpenAI({ apiKey: context.OPENAI_API_KEY });
    const analytics = new Analytics({ writeKey: context.SEGMENT_WRITE_KEY })

    // Define the credit card offering for the AI to reference
    const offering = getCreditCardOffering();
    
    try {
/*
        // Get or create a conversation between the customer and the AI assistant
        console.log("Getting or creating conversation...");
        const conversationSid = await getOrCreateConversation(client, fromNumber, toNumber, lastMessage);
        
        // Retrieve messages from the conversation
        console.log("Retrieving messages from conversation...");
        const messages = await client.conversations.v1.conversations(conversationSid).messages.list({ limit: 20 });

        // Format the existing messages in the conversation for OpenAI
        console.log("Formatting messages for OpenAI...");
        const formattedMessages = messages.map(message => ({
            role: message.author === 'system' ? 'assistant' : 'user',
            content: message.body
        }));

        // Set the system messages for OpenAI to guide response
        console.log("Setting system messages for OpenAI...");
        const systemMessages = getSystemMessages(name, AdReferralBody, offering);
        
        // Get the AI response and send it to the customer
        console.log("Getting AI response and sending it to the customer...");
        const aiResponse = await createChatCompletion(openai, formattedMessages, systemMessages);
        await sendMessage(client, conversationSid, aiResponse);

        // Analyze the conversation to determine if the customer has chosen a credit card
        console.log("Analyzing conversation to determine if the customer has chosen a credit card...");
        const hasChosenCreditCard = await analyzeConversation(openai, formattedMessages, systemMessages, 
            `Does this conversation indicate that the customer has chosen a credit card? Answer with "yes" or "no".`);

        // Analyze the conversation to determine if the customer wants to escalate to a real person
        console.log("Analyzing conversation to determine if the customer wants to escalate to a real person...");
        const escalationRequest = await analyzeConversation(openai, formattedMessages, systemMessages, 
            `Does this conversation indicate that the customer wants to escalate to a manager or speak to real person instead of the AI assistant they are currently speaking with? 
            Answer with "yes" or "no".`
        );

        // Analyze the conversation to determine which credit card the customer seems to be the best fit for
        console.log("Analyzing conversation to determine which credit card the customer seems to be the best fit for...");
        let creditCardChoice;
        if (hasChosenCreditCard.toLowerCase() === 'yes') {
            creditCardChoice = await analyzeConversation(openai, formattedMessages, systemMessages, 
                `Which credit card does this customer seem to be the best fit for? 
                Answer with just the name of the Credit Card from: ${offering}`
            );
        };
*/
        // Collect all traits
        const traits = {
            name,
            lastMessage,
            //AdReferralBody, 
            //AdReferralSourceURL, 
            //hasChosenCreditCard, 
            //creditCardChoice, 
            //escalationRequest 
        };

        const endpoint = `https://${context.DOMAIN_NAME}/writeTraitsToSegment`;
        const myHeaders = {
            'Cookies': `userId=${fromNumber}; traits=${JSON.stringify(traits)}`
        };

        const requestOptions = {
            method: "POST",
            headers: myHeaders
        };

        await fetch(endpoint, requestOptions)


        /*
        // Call the function to write traits to Segment
        const writeTraitsUrl = `https://${context.DOMAIN_NAME}/writeTraitsToSegment`;
        console.log("userId sending to function:", fromNumber);

        const response1 = await client.request({
            method: 'POST',
            uri: writeTraitsUrl,
            body: {
                userId: fromNumber,
                traits
            },
            cookies: {
                userId: fromNumber,
                traits
            }
        });*/

/*
        // Write the customer traits to Segment
        console.log("Writing traits to segment...");
        await writeTraitsToSegment(analytics, fromNumber, { 
            name,
            lastMessage,
            //AdReferralBody, 
            //AdReferralSourceURL, 
            //hasChosenCreditCard, 
            //creditCardChoice, 
            //escalationRequest 
        });*/
        console.log("Done.");

    } catch (error) {
        console.error("Error in handler function:", error);
        callback(error);
    }
};

async function getOrCreateConversation(client, fromNumber, toNumber, lastMessage) {
    const participantConversations = await client.conversations.v1.participantConversations.list({
        address: fromNumber,
        'participantMessagingBinding.proxy_address': toNumber,
    });

    if (participantConversations.length === 0) {
        const conversation = await client.conversations.v1.conversations.create({ friendlyName: 'New Conversation' });
        const conversationSid = conversation.sid;

        await client.conversations.v1.conversations(conversationSid).participants.create({
            'messagingBinding.address': fromNumber,
            'messagingBinding.proxyAddress': toNumber
        });

        await client.conversations.v1.conversations(conversationSid).messages.create({
            body: lastMessage,
            author: fromNumber
        });

        return conversationSid;
    } else {
        return participantConversations[0].conversationSid;
    }
}

function getSystemMessages(name, AdReferralBody, offering) {
    return [
        {
            role: "system",
            content: `
            You are an AI assistant for Creo Bank talking to a customer, ${name} who clicked on an ad with the content: ${AdReferralBody}.
            The conversation is taking place over WhatsApp so make responses easy to read over mobile and formatted appropriately for whatsapp.
            You have the credit card options: ${offering}. 
            Provide engaging but concise response.
            Response must be fewer than 50 words. 
            Ask questions to determine which Credit Card is the best fit for the customer. 
            Once it seems the customer has agreed to a given credit card, ask them to click on a link to apply for the card (www.creobank.com/apply).
            Do not ask for personally identifying information.
            If the customer wants to escalate to a manager or speak to a real person, provide a response that indicates the escalation process.
            Only answer questions that are related to the credit card options provided. Do not hallucinate or provide false information.`
        },
        {
            role: "user",
            content: 'We are having a casual conversation over chat so please provide engaging but concise responses.'
        }
    ];
}

async function createChatCompletion(openai, messages, systemMessages) {
    try {
        const response = await openai.chat.completions.create({
            messages: systemMessages.concat(messages),
            model: 'gpt-4',
            temperature: 0.8,
            max_tokens: 200,
            top_p: 0.9,
            n: 1,
        });
        return response.choices[0].message.content;
    } catch (error) {
        console.error("Error creating chat completion:", error);
        throw error;
    }
}

async function analyzeConversation(openai, messages, systemMessages, question) {
    try {
        const response = await openai.chat.completions.create({
            messages: systemMessages.concat(messages, [{ role: "user", content: question }]),
            model: 'gpt-4',
            temperature: 0.8,
        });
        return response.choices[0].message.content;
    } catch (error) {
        console.error("Error analyzing conversation:", error);
        throw error;
    }
}
async function writeTraitsToSegment(analytics, userId, traits) {
    try {
        console.log("Writing traits to segment:", traits)
        await new Promise((resolve) =>
            analytics.identify({
                userId: userId,
            traits: traits 
                }, resolve)
          )
        console.log("Successfully wrote traits to segment. Traits: ", traits);
    } catch (error) {
        console.error("Error writing traits to segment:", error);
        throw error;
    }
}

async function sendMessage(client, conversationSid, aiResponse) {
    await client.conversations.v1.conversations(conversationSid).messages.create({
        body: aiResponse,
        author: 'system'
    });
}

function getCreditCardOffering() {
    return `
    Here’s a more detailed breakdown of the Creo Bank credit card options:

    1. Everyday Rewards Credit Card (Cashback Focus)
    Best For: Customers who make regular everyday purchases and want to earn cashback rewards.
    
    Card Features:
    Rewards Rate:
    2% cashback on groceries and dining.
    1% cashback on all other purchases.
    Sign-up Bonus: $150 after spending $1,000 in the first 3 months.
    Annual Fee: $0.
    APR:
    Introductory 0% APR on purchases and balance transfers for 12 months.
    Variable APR of 18.99% - 24.99% after the introductory period.
    Additional Perks:
    Purchase protection for eligible items.
    Extended warranty coverage on certain purchases.
    Fraud protection and zero liability for unauthorized transactions.
    Redemption Options:
    Cashback can be redeemed as a statement credit, direct deposit, or gift cards.
    Customer Fit Criteria:
    Spending Habits: Best for customers who spend frequently on groceries, dining, and everyday purchases.
    Financial Goals: Ideal for those who value simple, liquid rewards that can be used for any purpose, including paying down balances.
    Credit Profile: Typically suited for individuals with good to excellent credit (670+).
    Why It Works for This Customer:
    Provides straightforward cashback rewards, making it easy to save on everyday expenses.
    No annual fee means customers don’t need to worry about offsetting additional costs with spending.
    Flexible redemption options ensure rewards fit the customer’s lifestyle.
    2. Creo Travel Rewards Card (Points and Travel Perks)
    Best For: Frequent travelers who want to earn points toward travel-related expenses and enjoy premium travel benefits.
    
    Card Features:
    Rewards Rate:
    3x points on travel (airlines, hotels, car rentals) and dining.
    1.5x points on all other purchases.
    Sign-up Bonus: 50,000 points after spending $3,000 in the first 3 months (redeemable for $500 in travel).
    Annual Fee: $95 (waived for the first year).
    APR:
    Variable APR of 17.99% - 23.99%.
    Additional Perks:
    Complimentary travel insurance (trip delay, lost luggage).
    No foreign transaction fees.
    Limited access to airport lounges (via Priority Pass partnership).
    Roadside assistance.
    Redemption Options:
    Points can be redeemed for flights, hotels, car rentals, or statement credits for travel purchases.
    Customer Fit Criteria:
    Spending Habits: Ideal for frequent travelers who spend significantly on travel and dining.
    Financial Goals: Great for those looking to save on travel expenses through points and perks.
    Credit Profile: Suited for customers with good to excellent credit scores (700+).
    Why It Works for This Customer:
    High rewards rates for travel and dining maximize value for frequent travelers.
    Perks like no foreign transaction fees, lounge access, and travel insurance enhance the travel experience.
    The waived first-year fee allows customers to try the card with minimal upfront commitment.
    3. Creo Platinum Secured Card (Credit Building Focus)
    Best For: Customers building or rebuilding their credit who need a simple card to establish a positive credit history.
    
    Card Features:
    Credit Building: Reports to all three major credit bureaus.
    Security Deposit: A refundable deposit starting at $300 determines the credit limit.
    Rewards Rate: Earn 1% cashback on all purchases.
    Annual Fee: $0.
    APR:
    Fixed APR of 19.99%.
    Additional Perks:
    Free credit score tracking via Creo Credit Insights.
    Financial education tools to improve credit management.
    Fraud protection and zero liability for unauthorized transactions.
    Redemption Options:
    Cashback can be redeemed as a statement credit.
    Customer Fit Criteria:
    Financial Goals: Ideal for individuals with limited or poor credit history aiming to establish or rebuild credit responsibly.
    Spending Habits: Focused on responsible, small-scale spending to build credit.
    Credit Profile: Designed for those with no credit history or a score below 670.
    Why It Works for This Customer:
    Offers a secure way to build credit while earning small rewards.
    No annual fee ensures affordability for customers in financial recovery.
    Cashback rewards are a bonus for cardholders working to improve their credit score.    
    `;
}