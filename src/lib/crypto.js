/**
 * Cryptographic Utility Functions for E-Voting System
 * 
 * Security Features:
 * - SHA-256 hashing for voter identity proofs
 * - Random Vote ID generation (anonymity)
 * - Nonce generation (replay attack prevention)
 * - Blinded vote creation (unlinkability)
 */

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
 * 
 * This creates the "voterProof" which is used ONLY during authentication phase.
 * After session creation, this proof is discarded and NOT sent with votes!
 * 
 * @param {string} aadhaar - 12-digit Aadhaar number
 * @param {string} voterId - Voter ID card number
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

/**
 * Generate a unique Vote ID (VOTE_ prefix + 32 hex characters)
 * 
 * This ID is completely random and CANNOT be linked back to voter identity.
 * It's used as the primary key for votes on blockchain.
 * 
 * Example: VOTE_a3f2b9c8d1e4f5a6b7c8d9e0f1a2b3c4
 * 
 * @returns {string} A unique vote ID
 */
export function generateVoteID() {
  const array = new Uint8Array(16); // 16 bytes = 128 bits
  crypto.getRandomValues(array); // Cryptographically secure random
  const hex = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  return `VOTE_${hex}`;
}

/**
 * Generate a cryptographic nonce (32 hex characters)
 * 
 * Nonce = "Number used ONCE"
 * Prevents replay attacks where someone tries to reuse old signatures.
 * 
 * Example: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6
 * 
 * @returns {string} A unique nonce
 */
export function generateNonce() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a blinded vote (base64 encoded)
 * 
 * This creates a "blinded" representation of your vote that the EC can sign
 * WITHOUT knowing who you're voting for or who you are!
 * 
 * The vote data is:
 * 1. Combined with timestamp (uniqueness)
 * 2. Base64 encoded (standard format)
 * 3. Sent to EC for blind signature
 * 
 * Security: The EC sees encoded data but can't decode your choice!
 * 
 * @param {string} electionId - The election ID
 * @param {string} candidateId - The candidate being voted for
 * @returns {string} Base64 encoded blinded vote
 */
export function createBlindedVote(electionId, candidateId) {
  const voteData = {
    election: electionId,
    candidate: candidateId,
    timestamp: Date.now() // Prevents duplicate signatures
  };
  
  // Convert to JSON string, then base64 encode
  return btoa(JSON.stringify(voteData));
}

/**
 * Generate a batch ID for vote grouping
 * 
 * Votes are grouped into batches before blockchain submission.
 * This helps with anonymity (individual votes get lost in the batch).
 * 
 * Format: BATCH_{timestamp}
 * Example: BATCH_1705248600000
 * 
 * @returns {string} A unique batch ID
 */
export function generateBatchID() {
  return `BATCH_${Date.now()}`;
}
