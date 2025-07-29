const TelegramBot = require('node-telegram-bot-api');
const chalk = require('chalk');
const { getPairingCode } = require('./core/pair.js');

// ⚠️ Get your token from BotFather on Telegram
const TELEGRAM_BOT_TOKEN = '8029175609:AAFyEm6APB8giEJh7-nImaAaFRA0JP2caMY';

console.log(chalk.blue('Starting Telegram Bot controller...'));
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
console.log(chalk.green('Telegram Bot is listening for commands.'));

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, `Welcome to the Ultar-MD Control Panel!\n\nUse /reqpair <whatsapp_number_with_country_code> to get a pairing code.`);
});

bot.onText(/\/reqpair (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const phoneNumber = match[1];

    try {
        await bot.sendMessage(chatId, `Request received! Generating a pairing code for ${phoneNumber}...`);
        
        const code = await getPairingCode(phoneNumber);

        const response = `Success! Your pairing code is:\n\n*${code}*`;
        await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
        console.log(chalk.green(`Successfully sent pairing code to user.`));

    } catch (error) {
        console.error(chalk.red('Error generating pairing code:'), error);
        bot.sendMessage(chatId, 'Oops! Something went wrong. Please check the logs.');
    }
});
