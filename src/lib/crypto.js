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

  // ✅ FIX: Match backend hash generation (aadhaar:voterId with colon!)
  // Backend uses: SHA256(aadhaar:voterId)
  const voterProof = await sha256(`${aadhaar}:${voterId}`);

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

// ✅ FIXED — XOR blinding makes the content cryptographically opaque to EC
export function createBlindedVote(electionId, candidateId) {
  const voteData = {
    election: electionId,
    candidate: candidateId,
    timestamp: Date.now()
  };

  const voteBytes = new TextEncoder().encode(JSON.stringify(voteData));
  const blindingKey = new Uint8Array(voteBytes.length);
  crypto.getRandomValues(blindingKey); // Cryptographically secure random mask

  // XOR every byte of voteData with the blindingKey — makes it unreadable
  const blinded = voteBytes.map((b, i) => b ^ blindingKey[i]);

  // Return BOTH — blindedVote goes to EC, blindingKey stays in browser memory
  return {
    blindedVote: btoa(String.fromCharCode(...blinded)),
    blindingKey: Array.from(blindingKey) // Stored locally, used to unblind after signing
  };
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
