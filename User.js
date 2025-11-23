const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    googleId: {
        type: String,
        required: true,
        unique: true
    },
    displayName: { // Google'dan alınan isim
        type: String,
        required: true
    },
    email: { // Google'dan alınan e-posta
        type: String,
        required: true,
        unique: true
    },
    isAdmin: { // Admin yetkisi (Sadece sizin e-postanız için true olacak)
        type: Boolean,
        default: false 
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('User', UserSchema);
