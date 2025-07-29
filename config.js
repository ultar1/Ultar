const fs = require('fs');

module.exports = {
    // Your name and number
    owner: [
        ['+1234567890', 'Ultar Owner', true] 
        // You can add more owners here
    ],
    
    // Set to true to see bot logs
    pino_debug: false,

    // Bot Info
    bot_name: "Ultar-MD",
    
    // Get this from Render's "Environment" tab after creating a database
    database_url: process.env.DATABASE_URL,

    // Auto-read statuses. true or false
    auto_status_read: false,

    // Sticker Metadata
    sticker_pack: "Ultar-MD Stickers",
    sticker_author: "Ultar"
};
