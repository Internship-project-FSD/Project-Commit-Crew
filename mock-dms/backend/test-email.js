
require('dotenv').config();

const { verifyEmailConnection } = require('./services/email.service');

verifyEmailConnection()
  .then(() => {
    console.log('SMTP test passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('SMTP test failed:', error.message);
    process.exit(1);
  });
