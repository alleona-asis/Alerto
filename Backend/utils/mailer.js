const nodemailer = require('nodemailer');
require('dotenv').config();

// Create the transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false, // change to true if using port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Debug SMTP config
console.log('📦 Setting up transporter with SMTP config...');
console.log(`SMTP_HOST: ${process.env.SMTP_HOST}`);
console.log(`SMTP_PORT: ${process.env.SMTP_PORT}`);
console.log(`SMTP_USER: ${process.env.SMTP_USER}`);

// Verify connection config
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP transporter not ready:', error.message);
  } else {
    console.log('✅ SMTP transporter is ready to send emails');
  }
});

// Email sending function
const sendStatusEmail = async (toEmail, status) => {
  console.log(`📧 Preparing to send ${status} email to: ${toEmail}`);

  const subject = 'Account Status Notification';
  const html = `
    <p>Dear Applicant,</p>
    <p>Your account has been <strong>${status}</strong> by the administrator.</p>
    <p>If you have any questions, please contact support.</p>
    <br/>
    <p>– Your App Team</p>
  `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: toEmail,
      subject,
      html,
    });

    console.log(`✅ Email sent successfully to ${toEmail}`);
  } catch (err) {
    console.error(`❌ Failed to send email to ${toEmail}:`, err.message);
  }
};

module.exports = { sendStatusEmail };
