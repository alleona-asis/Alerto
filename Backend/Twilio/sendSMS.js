//  * Balance: $13.5997
const twilio = require('twilio');
require('dotenv').config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

/**
 * Send an SMS using Twilio
 * @param {string} to - Recipient's phone number
 * @param {string} body - The content of the SMS message
 */
const sendSMS = async (to, body) => {
  console.log('Sending to:', to);
  console.log('Message:', body);

  try {
    const message = await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER, // Verified Twilio number
      to,
    });

    console.log('Sent successfully. SID:', message.sid);
    return message;
  } catch (err) {
    console.error('Error sending message:', err.message);
    throw err;
  }
};

module.exports = sendSMS;


