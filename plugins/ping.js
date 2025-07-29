module.exports = {
    // The command that will be used to trigger this plugin
    command: 'ping',

    // A short description of what the command does
    description: 'Check the bot\'s response time.',
    
    // The main function that will be executed
    func: async (bot, message) => {
        // Get the current timestamp
        const startTime = Date.now();

        // Send a message and wait for it to be sent
        const sentMessage = await bot.sendMessage(message.key.remoteJid, { text: 'Pinging...' });
        
        // Calculate the time difference
        const endTime = Date.now();
        const latency = endTime - startTime;

        // Edit the original message to show the latency
        await bot.sendMessage(message.key.remoteJid, { 
            text: `*Pong!* \nLatensi: ${latency} ms`,
            edit: sentMessage.key 
        });
    }
};
