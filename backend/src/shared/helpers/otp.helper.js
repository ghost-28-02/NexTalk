const otpGenerator = require('otp-generator');

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;

function generateOTP() {
  return otpGenerator.generate(OTP_LENGTH, {
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false,
  });
}

function getOTPExpiry() {
  return new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
}

module.exports = { generateOTP, getOTPExpiry, OTP_TTL_MINUTES };
