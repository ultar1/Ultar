const {
    default: makeWASocket,
    DisconnectReason,
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
    // This is the corrected authentication logic
    const auth = createSequelizeStore();
    const { creds, keys } = await auth.creds.get() || {};
    const state = {
        creds: creds || {
            noiseKey: { private: Buffer.alloc(32), public: Buffer.alloc(32) },
            signedIdentityKey: { private: Buffer.alloc(32), public: Buffer.alloc(32) },
            signedPreKey: { keyId: 0, keyPair: { private: Buffer.alloc(32), public: Buffer.alloc(32) }, signature: Buffer.alloc(64) },
            registrationId: 0,
            advSecretKey: '',
            processedHistoryMessages: [],
            nextPreKeyId: 0,
            firstUnuploadedPreKeyId: 0,
            accountSettings: { unarchiveChats: false },
        },
        keys: keys || {},
    };

    const bot = makeWASocket({
        logger: pino({ level: config.pino_debug ? 'debug' : 'silent' }),
        printQRInTerminal: true,
        browser: ['Ultar-MD', 'Chrome', '1.0.0'],
        auth: {
            creds: state.creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await auth.keys.get(type, [id]);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    await auth.keys.set(data);
                }
            }
        }
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

    bot.ev.on('creds.update', () => auth.creds.set(bot.authState.creds));

    // --- Message Handler ---
    bot.ev.on('messages.upsert', async (chatUpdate) => {
        const message = chatUpdate.messages[0];
        if (!message.message || message.key.remoteJid === 'status@broadcast') return;

        const messageType = Object.keys(message.message)[0];
        const messageText = messageType === 'conversation' ? message.message.conversation :
                            messageType === 'extendedTextMessage' ? message.message.extendedTextMessage.text : '';

        if (!messageText) return;

        const prefix = /^[\\/!#.]/gi.test(messageText) ? messageText.match(/^[\\/!#.]/gi)[0] : '';
        if (!prefix) return;

        const commandName = messageText.replace(prefix, '').split(/ +/).shift().toLowerCase();
        const command = commands.get(commandName);
        
        if (command) {
            try {
                await command.func(bot, message);
            } catch (error) {
                console.error(chalk.red(`Error executing command '${commandName}':`), error);
            }
        }
    });
};

// --- Plugin Loader ---
function loadPlugins() {
    const commands = new Map();
    const pluginsDir = path.join(__dirname, '../plugins');
    if (!fs.existsSync(pluginsDir)) return commands;

    const pluginFiles = fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js'));
    pluginFiles.forEach(file => {
        try {
            const plugin = require(path.join(pluginsDir, file));
            if (plugin.command && plugin.func) {
                commands.set(plugin.command, plugin);
            }
        } catch (error) {
            console.error(chalk.red(`Failed to load plugin ${file}:`), error);
        }
    });
    console.log(chalk.blue(`Loaded ${commands.size} plugins.`));
    return commands;
}

module.exports = { connect };
