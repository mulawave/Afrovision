const User = require('../users/user.model');
const KycModel = require('../kyc/kyc.model');

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;

  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age;
}

async function isAdultKycVerified(userId) {
  const user = await User.findById(userId);
  if (!user || user.kyc_status !== 'verified') return false;

  const kyc = await KycModel.findByUserId(userId);
  if (!kyc || kyc.status !== 'verified') return false;

  const age = calculateAge(kyc.date_of_birth);
  return age !== null && age >= 18;
}

module.exports = {
  calculateAge,
  isAdultKycVerified,
};
