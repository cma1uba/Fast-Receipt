/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const SALT = new TextEncoder().encode("NoFussReceiptGrabberSaltSecret");

/**
 * Derives a cryptographic key from a client passphrase using PBKDF2
 */
async function getKey(passcode: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(passcode),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: SALT,
      iterations: 10000, // Balanced for fast mobile execution & adequate protection
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts cleartext back into standard Base64-encoded ciphertext with IV
 */
export async function encryptData(text: string, passcode: string): Promise<string> {
  try {
    const key = await getKey(passcode);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    
    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      enc.encode(text)
    );

    const combinedBytes = new Uint8Array(iv.length + encrypted.byteLength);
    combinedBytes.set(iv, 0);
    combinedBytes.set(new Uint8Array(encrypted), iv.length);

    // Convert primitive binary into clean base64 string
    let binary = "";
    const len = combinedBytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(combinedBytes[i]);
    }
    return btoa(binary);
  } catch (err) {
    console.error("Local client encryption error:", err);
    throw new Error("Unable to encrypt receipts safely. Check Web Crypto properties.");
  }
}

/**
 * Decrypts a Base64-encoded ciphertext string into normal clear text
 */
export async function decryptData(encoded: string, passcode: string): Promise<string> {
  try {
    const binaryString = atob(encoded);
    const len = binaryString.length;
    const combinedBytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      combinedBytes[i] = binaryString.charCodeAt(i);
    }

    if (combinedBytes.length < 13) {
      throw new Error("Ciphertext too short.");
    }

    const iv = combinedBytes.slice(0, 12);
    const ciphertext = combinedBytes.slice(12);

    const key = await getKey(passcode);
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    console.error("Local client decryption error:", err);
    throw new Error("Invalid decryption passcode or corrupted secure storage block.");
  }
}

/**
 * Generates an high-entropy random passphrase for standard session-only encryption
 */
export function generateSessionPasscode(): string {
  const primaryList = [
    "EPHEMERAL", "SHRED", "COSMIC", "SILENT", "SECURE", "OFFLINE", "MIND",
    "GEMS", "NODE", "FLITE", "STOMP", "SPIN", "SPYGLASS", "VORTEX", "ZEPHYR"
  ];
  const secondaryList = [
    "RIVER", "SHELTER", "PADDLE", "GRABBER", "PORTAL", "SLATE", "AURA",
    "BEAM", "TANGENT", "DRIFT", "PIXEL", "STEADY", "ECHO", "GUST", "SHADOW"
  ];

  const randomValues = new Uint32Array(3);
  window.crypto.getRandomValues(randomValues);

  const termA = primaryList[randomValues[0] % primaryList.length];
  const termB = secondaryList[randomValues[1] % secondaryList.length];
  const digits = (randomValues[2] % 9000) + 1000; // 4 random digits

  return `${termA}-${termB}-${digits}`;
}
