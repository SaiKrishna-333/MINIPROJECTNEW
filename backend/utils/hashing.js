const crypto = require("crypto");

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function secureHash(data, transactionId, salt = null) {
  if (!salt) salt = crypto.randomBytes(16).toString("hex");
  const firstHash = sha256(data + salt);
  const finalHash = sha256(firstHash + transactionId);
  return { finalHash, salt };
}

module.exports = { sha256, secureHash };
