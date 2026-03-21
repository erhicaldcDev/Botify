const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

class CryptoManager {
    constructor(userDataPath) {
        this.keyPath = path.join(userDataPath, ".encryption_key");
        this.key = this._loadOrCreateKey();
    }

    _loadOrCreateKey() {
        if (fs.existsSync(this.keyPath)) {
            return Buffer.from(fs.readFileSync(this.keyPath, "utf-8"), "hex");
        }
        const key = crypto.randomBytes(KEY_LENGTH);
        fs.writeFileSync(this.keyPath, key.toString("hex"), "utf-8");
        return key;
    }

    encrypt(plaintext) {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
        let encrypted = cipher.update(plaintext, "utf-8", "hex");
        encrypted += cipher.final("hex");
        const tag = cipher.getAuthTag();
        return {
            iv: iv.toString("hex"),
            data: encrypted,
            tag: tag.toString("hex"),
        };
    }

    decrypt(encryptedObj) {
        try {
            const iv = Buffer.from(encryptedObj.iv, "hex");
            const tag = Buffer.from(encryptedObj.tag, "hex");
            const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
            decipher.setAuthTag(tag);
            let decrypted = decipher.update(encryptedObj.data, "hex", "utf-8");
            decrypted += decipher.final("utf-8");
            return decrypted;
        } catch {
            return null;
        }
    }
}

module.exports = { CryptoManager };
