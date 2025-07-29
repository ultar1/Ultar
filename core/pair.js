const { default: makeWASocket } = require('@whiskeysockets/baileys');
const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config');
const pino = require('pino');
const { Boom } = require('@hapi/boom');

// Re-use the same database connection and session logic as connect.js
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
    // This is the same session store function from core/connect.js
    // It ensures both files save data to the same place
    const store = {
        get: async (key) => {
            const session = await Session.findOne({ where: { key } });
            return session ? JSON.parse(session.value) : null;
        },
        set: async (key, value) => {
            await Session.findOrCreate({ where: { key } }).then(([session]) => {
                session.value = JSON.stringify(value);
                return session.save();
            });
        }
    };
    return {
        keys: {
            get: async (type, ids) => {
                const keys = await Promise.all(ids.map(id => store.get(`${type}-${id}`)));
                const result = {};
                keys.forEach((value, i) => { if (value) result[ids[i]] = value; });
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
        creds: {
            get: () => store.get('creds'),
            set: (value) => store.set('creds', value),
            del: () => store.del('creds')
        }
    };
};

// Main function to export
async function getPairingCode(phoneNumber) {
    const { state, saveCreds } = { auth: createSequelizeStore() };

    const bot = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['Ultar-MD (Pairing)', 'Chrome', '1.0.0'],
        auth: state
    });

    return new Promise(async (resolve, reject) => {
        bot.ev.on('creds.update', saveCreds);

        // Wait for the pairing code
        setTimeout(async () => {
            try {
                const code = await bot.requestPairingCode(phoneNumber);
                resolve(code);
            } catch (error) {
                reject(error);
            }
        }, 5000); // 5-second delay
    });
}

module.exports = { getPairingCode };
