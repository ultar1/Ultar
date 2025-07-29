const { Sequelize } = require('sequelize');
const { DataTypes } = require('sequelize');
const config = require('./config');
const { connect } = require('./core/connect');
const chalk = require('chalk');

console.log(chalk.blue('Starting Ultar-MD...'));

// Initialize database connection
const sequelize = new Sequelize(config.database_url, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    },
    logging: config.pino_debug // Use pino_debug to control logging
});

// Define a simple model for session data
const Session = sequelize.define('Session', {
    key: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    value: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
});

/**
 * Main function to start the bot
 */
async function start() {
    try {
        // Authenticate and sync the database
        await sequelize.authenticate();
        await Session.sync();
        console.log(chalk.green('Database connected successfully.'));

        // Start the WhatsApp connection
        await connect();

    } catch (error) {
        console.error(chalk.red('Failed to start the bot:'), error);
        console.error(chalk.yellow('Please ensure your DATABASE_URL in config.js (or environment variables) is correct.'));
    }
}

// Run the bot
start();
