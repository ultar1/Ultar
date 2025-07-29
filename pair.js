const { default: makeWASocket } = require('@whiskeysockets/baileys');
const { Sequelize, DataTypes } = require('sequelize');
const pino = require('pino');
const readline = require('readline');

// This script will get the DATABASE_URL from Render's environment variables
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error("Error: DATABASE_URL is not set. Please add it to your environment variables.");
    process.exit(1);
}

// Setup database connection
const sequelize = new Sequelize(DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    logging: false
});
const Session = sequelize.define('Session', {
    key: { type: DataTypes.STRING, primaryKey: true },
    value: { type: DataTypes.TEXT, allowNull: false }
});

// Setup the custom session store
const createSequelizeStore = () => {
    const store = {
        get: async (key) => {
            const session = await Session.findOne({ where: { key } });
            return session ? JSON.parse(session.value) : null;
        },
        set: async (key, value) => {
            await Session.findOrCreate({ where: { key } }).then(([s]) => { s.value = JSON.stringify(value); return s.save(); });
        }
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
                for (const type in data) { for (const id in data[type]) { await store.set(`${type}-${id}`, data[type][id]); } }
            }
        },
        creds: { get: () => store.get('creds'), set: (v) => store.set('creds', v), del: () => store.del('creds') }
    };
};

// Function to ask questions in the terminal
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// Main pairing function
async function pair() {
    try {
        await sequelize.authenticate();
        await Session.sync();

        const phoneNumber = await question("Enter your full WhatsApp number (e.g., +1234567890): ");
        const { state, saveCreds } = { auth: createSequelizeStore() };

        const bot = makeWASocket({
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ['Ultar-MD (Pairing)', 'Chrome', '1.0.0'],
            auth: state
        });
        
        const code = await bot.requestPairingCode(phoneNumber.trim());
        console.log(`\nYour pairing code is: ${code}\n`);
        console.log("Enter this code in WhatsApp on your phone (Settings > Linked Devices > Link with phone number).");
        console.log("The script will close automatically after pairing. You can then restart your main bot service.");

    } catch (error) {
        console.error("Pairing failed:", error);
    } finally {
        rl.close();
        await sequelize.close();
    }
}

pair();
