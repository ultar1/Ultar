const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeInMemoryStore
} = require('@whiskeysockets/baileys');
const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// --- Database & Session Setup ---
const sequelize = new Sequelize(config.database_url, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    logging: false
});
const Session = sequelize.define('Session', {
    key: { type: DataTypes.STRING, primaryKey: true },
    value: { type: DataTypes.TEXT, allowNull: false }
});

const createSequelizeStore = () => {
    const store = {
        get: async (key) => {
            const session = await Session.findOne({ where: { key } });
            return session ? JSON.parse(session.value) : null;
        },
        set: async (key, value) => {
            await Session.findOrCreate({ where: { key } }).then(([s]) => { s.value = JSON.stringify(value); return s.save(); });
        },
        del: async (key) => { await Session.destroy({ where: { key } }); }
    };
    return {
        keys: {
            get: async (type, ids) => {
                const keys = await Promise.all(ids.map(id => store.get(`${type}-${id}`)));
                const result = {};
                keys.forEach((v, i) => { if (v) result[ids[i]] = v; });
                return result;
            },
            set: async (data) => {
                for (const type in data) {
                    for (const id in data[type]) {
                        await store.set(`${type}-${id}`, data[type][id]);
                    }
                }
            }
        },
        creds: { get: () => store.get('creds'), set: (v) => store.set('creds', v), del: () => store.del('creds') }
    };
};

// --- Main Connection Logic ---
const connect = async () => {
    const { state, saveCreds } = await useMultiFileAuthState(createSequelizeStore());
    const bot = makeWASocket({
        logger: pino({ level: config.pino_debug ? 'debug' : 'silent' }),
        printQRInTerminal: true,
        browser: ['Ultar-MD', 'Chrome', '1.0.0'],
        auth: state
    });

    const commands = loadPlugins();

    bot.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = new Boom(lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(chalk.red('Connection closed. Reconnecting:'), shouldReconnect);
            if (shouldReconnect) connect();
        } else if (connection === 'open') {
            console.log(chalk.green('WhatsApp connection established!'));
        }
    });

    bot.ev.on('creds.update', saveCreds);

    // --- Message Handler ---
    bot.ev.on('messages.upsert', async (chatUpdate) => {
        const message = chatUpdate.messages[0];
        if (!message.message) return;

        const messageType = Object.keys(message.message)[0];
        const messageText = messageType === 'conversation' ? message.message.conversation :
                            messageType === 'extendedTextMessage' ? message.message.extendedTextMessage.text : '';

        if (!messageText) return;

        const prefix = /^[\\/!#.]/gi.test(messageText) ? messageText.match(/^[\\/!#.]/gi)[0] : /^[\\/!#.]/gi.test(messageText) ? messageText.match(/^[\\/!#.]/gi)[0] : '';
        const commandName = messageText.replace(prefix, '').split(/ +/).shift().toLowerCase();
        
        const command = commands.get(commandName);
        if (command) {
            try {
                await command.func(bot, message);
            } catch (error) {
                console.error(chalk.red(`Error executing command '${commandName}':`), error);
                await bot.sendMessage(message.key.remoteJid, { text: 'An error occurred while executing the command.' });
            }
        }
    });

    if (config.auto_status_read) {
        bot.ev.on('messages.upsert', async (chatUpdate) => {
            if (chatUpdate.messages[0]?.key?.remoteJid === 'status@broadcast') {
                await bot.readMessages([chatUpdate.messages[0].key]);
            }
        });
    }
};

// --- Plugin Loader ---
function loadPlugins() {
    const commands = new Map();
    const pluginsDir = path.join(__dirname, '../plugins');
    if (!fs.existsSync(pluginsDir)) {
        console.log(chalk.yellow("Plugins directory not found. No commands will be loaded."));
        return commands;
    }

    const pluginFiles = fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js'));
    console.log(chalk.blue(`Found ${pluginFiles.length} plugins.`));

    pluginFiles.forEach(file => {
        try {
            const plugin = require(path.join(pluginsDir, file));
            if (plugin.command && plugin.func) {
                commands.set(plugin.command, plugin);
                console.log(chalk.cyan(`- Loaded command: ${plugin.command}`));
            }
        } catch (error) {
            console.error(chalk.red(`Failed to load plugin ${file}:`), error);
        }
    });
    return commands;
}

module.exports = { connect };

