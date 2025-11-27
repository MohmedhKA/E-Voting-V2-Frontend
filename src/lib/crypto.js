/**
 * Hashes a string using the SHA-256 algorithm.
 * Uses the browser's built-in SubtleCrypto API.
 * @param {string} input The string to hash.
 * @returns {Promise<string>} A promise that resolves to the hex-encoded hash.
 */
async function sha256(input) {
  const textAsBuffer = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', textAsBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Generates all necessary cryptographic proofs for a voter.
 * @param {string} aadhaar 
 * @param {string} voterId 
 * @param {string} name - The voter's full name
 * @returns {Promise<object>} An object containing all required hashes and the voterProof.
 */
export async function generateVoterProofs(aadhaar, voterId, name) {
  const hashedAadhaar = await sha256(aadhaar);
  const hashedVoterID = await sha256(voterId);
  const hashedName = await sha256(name);

  // The voterProof is the hash of the other two hashes combined,
  // matching the chaincode logic.
  const voterProof = await sha256(hashedAadhaar + hashedVoterID);

  return {
    hashedAadhaar,
    hashedVoterID,
    hashedName,
    voterProof,
  };
}
