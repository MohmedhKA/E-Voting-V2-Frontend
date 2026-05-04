/**
 * rsaBlind.js - Pure BigInt Implementation of Chaum's Blind Signature Scheme
 * 
 * Uses Web Crypto API for SHA-256 and native BigInt for all modular arithmetic.
 * NEVER uses external libraries (e.g., node-forge) to ensure browser compatibility.
 */

/**
 * Computes base^exp % mod using right-to-left binary method.
 */
function modPow(base, exp, mod) {
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = (result * base) % mod;
    }
    exp = exp / 2n;
    base = (base * base) % mod;
  }
  return result;
}

/**
 * Computes the Greatest Common Divisor of two BigInts.
 */
function gcd(a, b) {
  let temp;
  while (b !== 0n) {
    temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

/**
 * Computes the modular inverse of a modulo m using the Extended Euclidean Algorithm.
 * Returns x such that (a * x) % m === 1
 */
function modInverse(a, m) {
  let m0 = m;
  let x0 = 0n;
  let x1 = 1n;

  if (m === 1n) return 0n;

  while (a > 1n) {
    let q = a / m;
    let t = m;

    m = a % m;
    a = t;

    t = x0;
    x0 = x1 - q * x0;
    x1 = t;
  }

  if (x1 < 0n) {
    x1 += m0;
  }

  return x1;
}

/**
 * Generates a cryptographically secure random BigInt of the specified byte length.
 */
function getRandomBigInt(bytesLength) {
  const array = new Uint8Array(bytesLength);
  window.crypto.getRandomValues(array);
  const hex = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  return BigInt('0x' + hex);
}

/**
 * Hashes a string using SHA-256 and returns a BigInt.
 */
async function sha256ToBigInt(data) {
  const buffer = new TextEncoder().encode(data);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return BigInt('0x' + hex);
}

/**
 * Step 2: Blinds the ballot payload using the EC's public key (n, e).
 * 
 * @param {Object} payload The ballot payload to sign.
 * @param {string} nHex The RSA modulus n in hex.
 * @param {string} eHex The RSA public exponent e in hex.
 * @returns {Object} { blindedMessageHex, r, m }
 */
export async function blindBallot(payload, nHex, eHex) {
  const n = BigInt('0x' + nHex);
  const e = BigInt('0x' + eHex);
  
  const payloadStr = JSON.stringify(payload);
  const m = await sha256ToBigInt(payloadStr);
  
  let r;
  // Generate random 256-byte blinding factor r until gcd(r, n) == 1
  while (true) {
    r = getRandomBigInt(256); // 2048 bits = 256 bytes
    if (r > 0n && r < n && gcd(r, n) === 1n) {
      break;
    }
  }
  
  // Compute blindedMessage = (m * r^e) mod n
  const rPowE = modPow(r, e, n);
  const blindedMessage = (m * rPowE) % n;
  
  return {
    blindedMessageHex: blindedMessage.toString(16),
    r,
    m
  };
}

/**
 * Step 4: Unblinds the EC's signature to get the signature on the original ballot.
 * 
 * @param {string} blindedSignatureHex The blinded signature received from the EC.
 * @param {BigInt} r The blinding factor used during the blind step.
 * @param {string} nHex The RSA modulus n in hex.
 * @returns {string} The unblinded signature as a hex string.
 */
export function unblind(blindedSignatureHex, r, nHex) {
  const n = BigInt('0x' + nHex);
  const sPrime = BigInt('0x' + blindedSignatureHex);
  
  // rInverse = modInverse(r, n)
  const rInv = modInverse(r, n);
  
  // signature = (s' * rInverse) mod n
  const signature = (sPrime * rInv) % n;
  
  return signature.toString(16);
}
