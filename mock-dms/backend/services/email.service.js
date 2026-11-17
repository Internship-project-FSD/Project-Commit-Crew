
'use strict';

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendOtpEmail(email, otp) {
  await transporter.sendMail({
    from: `"Mock DMS" <${process.env.SMTP_FROM}>`,
    to: email,
    subject: 'Your Mock DMS Login OTP',
    text: `Your login OTP is ${otp}. It expires in 5 minutes. Do not share this code with anyone.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto;">
        <h2>Mock DMS Login Verification</h2>
        <p>Use the following OTP to complete your login:</p>
        <h1 style="letter-spacing: 8px;">${otp}</h1>
        <p>This OTP expires in <strong>5 minutes</strong>.</p>
        <p>Please do not share this code with anyone.</p>
      </div>
    `
  });
}

async function verifyEmailConnection() {
  await transporter.verify();
  console.log('Email SMTP connection verified successfully.');
}

module.exports = {
  sendOtpEmail,
  verifyEmailConnection
};
