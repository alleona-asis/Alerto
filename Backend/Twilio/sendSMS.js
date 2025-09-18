//  * Balance: $13.5997
const twilio = require('twilio');
require('dotenv').config(); // Load environment variables from .env file

// Create a Twilio client instance using your credentials from the .env file
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

/**
 * Send an SMS using Twilio
 * @param {string} to - Recipient's phone number in E.164 format (e.g. +639xxxxxxxxx for PH)
 * @param {string} body - The content of the SMS message
 */
const sendSMS = async (to, body) => {
  console.log('📤 [SMS] Sending to:', to);
  console.log('📝 [SMS] Message:', body);

  try {
    const message = await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER, // Must be a verified Twilio number
      to,
    });

    console.log('✅ [SMS] Sent successfully. SID:', message.sid);
    return message;
  } catch (err) {
    console.error('❌ [SMS] Error sending message:', err.message);
    throw err; // Re-throw so the controller can handle the error
  }
};

module.exports = sendSMS;


