const mongoose = require('mongoose');

const CekilisSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    imageUrl: {
        type: String,
        default: 'https://i.imgur.com/G5g2mJc.jpeg' 
    },
    endDate: {
        type: Date,
        required: true
    },
    participants: [{ // Katılan kullanıcıların ID'leri
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    winner: { // Kazananın ID'si
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Cekilis', CekilisSchema);
