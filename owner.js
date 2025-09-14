const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { legacyCommands: economyLegacy, slashCommands: economySlash, saveEconomy } = require('./economy.js');
const fs = require('fs');

// The bot's owner ID from the .env file
const ownerID = process.env.OWNER_ID;

const legacyCommands = [
    {
        name: 'eval',
        description: 'Evaluates a JavaScript code snippet (Owner Only).',
        async execute(message, args) {
            if (message.author.id !== ownerID) return message.reply('This is an owner-only command.');
            try {
                const code = args.join(' ');
                let result = await eval(code);
                if (typeof result !== 'string') {
                    result = require('util').inspect(result, { depth: 1 });
                }
                const embed = new EmbedBuilder()
                    .setTitle('Evaluation Result')
                    .setDescription(`\`\`\`js\n${result}\n\`\`\``)
                    .setColor(0x3498db);
                message.reply({ embeds: [embed] });
            } catch (error) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('Evaluation Error')
                    .setDescription(`\`\`\`js\n${error.stack}\n\`\`\``)
                    .setColor(0xe74c3c);
                message.reply({ embeds: [errorEmbed] });
            }
        },
    },
    {
        name: 'broadcast',
        description: 'Broadcasts a message to all servers (Owner Only).',
        async execute(message, args) {
            if (message.author.id !== ownerID) return message.reply('This is an owner-only command.');
            const broadcastMessage = args.join(' ');
            if (!broadcastMessage) return message.reply('Please provide a message to broadcast.');

            let successCount = 0;
            let failureCount = 0;

            for (const [guildId, guild] of message.client.guilds.cache) {
                try {
                    const defaultChannel = guild.channels.cache.find(
                        (channel) =>
                            channel.type === 0 &&
                            channel.permissionsFor(message.client.user).has('SendMessages')
                    );

                    if (defaultChannel) {
                        const broadcastEmbed = new EmbedBuilder()
                            .setTitle('Server Broadcast')
                            .setDescription(broadcastMessage)
                            .setFooter({ text: `Message from ${message.author.tag}` })
                            .setColor(0xf1c40f);
                        await defaultChannel.send({ embeds: [broadcastEmbed] });
                        successCount++;
                    } else {
                        failureCount++;
                    }
                } catch (error) {
                    console.error(`Could not broadcast to guild ${guild.name}: ${error.message}`);
                    failureCount++;
                }
            }

            const resultEmbed = new EmbedBuilder()
                .setTitle('Broadcast Complete')
                .setDescription(`Successfully sent the message to ${successCount} servers. Failed to send to ${failureCount} servers.`)
                .setColor(0x2ecc71);

            message.reply({ embeds: [resultEmbed] });
        },
    },
    {
        name: 'listservers',
        description: 'Lists all servers the bot is in (Owner Only).',
        execute(message) {
            if (message.author.id !== ownerID) return message.reply('This is an owner-only command.');
            const servers = message.client.guilds.cache.map(guild => `${guild.name} (${guild.id}) - ${guild.memberCount} members`);
            const serverList = servers.join('\n');
            const embed = new EmbedBuilder()
                .setTitle('Connected Servers')
                .setDescription(serverList)
                .setColor(0x3498db);
            message.reply({ embeds: [embed] });
        },
    },
    {
        name: 'dm',
        description: 'DMs a user (Owner Only).',
        async execute(message, args) {
            if (message.author.id !== ownerID) return message.reply('This is an owner-only command.');
            const user = message.mentions.users.first();
            const dmMessage = args.slice(1).join(' ');

            if (!user || !dmMessage) {
                return message.reply('Please mention a user and provide a message to DM.');
            }

            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('DM from Bot Owner')
                    .setDescription(dmMessage)
                    .setFooter({ text: `Message from ${message.author.tag}` })
                    .setColor(0x3498db);
                await user.send({ embeds: [dmEmbed] });
                message.reply(`Successfully sent a DM to ${user.tag}.`);
            } catch (error) {
                console.error(error);
                message.reply('Failed to send DM to that user.');
            }
        },
    },
    {
        name: 'shutdown',
        description: 'Shuts down the bot (Owner Only).',
        async execute(message) {
            if (message.author.id !== ownerID) return message.reply('This is an owner-only command.');
            await message.reply('Shutting down...');
            message.client.destroy();
        },
    },
    {
        name: 'reboot',
        description: 'Reboots the bot (Owner Only).',
        async execute(message) {
            if (message.author.id !== ownerID) return message.reply('This is an owner-only command.');
            await message.reply('Rebooting...');
            message.client.destroy();
            message.client.login(process.env.DISCORD_TOKEN);
        },
    },
    {
        name: 'set',
        description: 'Sets the bot\'s status (Owner Only).',
        async execute(message, args) {
            if (message.author.id !== ownerID) return message.reply('This is an owner-only command.');
            const statusType = args[0] ? args[0].toLowerCase() : null;
            const statusMessage = args.slice(1).join(' ');

            if (!statusType) {
                return message.reply('Please provide a status type (e.g., `online`, `idle`, `dnd`, `invisible`).');
            }

            try {
                await message.client.user.setStatus(statusType);
                if (statusMessage) {
                    await message.client.user.setActivity(statusMessage, { type: 'LISTENING' });
                } else {
                    await message.client.user.setActivity(null);
                }
                message.reply(`Bot status set to **${statusType}** with activity **${statusMessage || 'none'}**.`);
            } catch (error) {
                console.error(error);
                message.reply('Failed to set bot status. Check the status type.');
            }
        },
    },
    {
        name: 'reload',
        description: 'Reloads a command file (Owner Only).',
        async execute(message, args) {
            if (message.author.id !== ownerID) return message.reply('This is an owner-only command.');
            const file = args[0];
            if (!file) return message.reply('Please provide a command file to reload (e.g., `utility`, `moderation`, `economy`).');

            try {
                const filePath = `./${file}.js`;
                if (require.cache[require.resolve(filePath)]) {
                    delete require.cache[require.resolve(filePath)];
                }

                if (file === 'economy') {
                    const newCommands = require(filePath);

                    // Clear and reload economy commands
                    client.commands = client.commands.filter(cmd => !economyLegacy.some(ecmd => ecmd.name === cmd.name));
                    client.slashCommands = client.slashCommands.filter(cmd => !economySlash.some(ecmd => ecmd.data.name === cmd.data.name));

                    for (const command of newCommands.legacyCommands) {
                        message.client.commands.set(command.name, command);
                    }
                    for (const command of newCommands.slashCommands) {
                        message.client.slashCommands.set(command.data.name, command);
                    }
                    message.reply(`Successfully reloaded ${file}.js commands.`);

                } else if (file === 'ticket') {
                    // Logic to reload ticket.js if you want to
                    message.reply('Reload logic for ticket.js is not yet implemented.');
                } else {
                    const newCommands = require(filePath);
                    for (const command of newCommands.legacyCommands) {
                        message.client.commands.set(command.name, command);
                    }
                    message.reply(`Successfully reloaded ${file}.js commands.`);
                }
            } catch (error) {
                console.error(error);
                message.reply(`Failed to reload ${file}.js. Check the file name.`);
            }
        },
    },
    {
        name: 'addbal',
        description: 'Adds balance to a user\'s account (Owner Only).',
        async execute(message, args) {
            if (message.author.id !== ownerID) return message.reply('This is an owner-only command.');
            const user = message.mentions.users.first() || message.client.users.cache.get(args[0]);
            const amount = parseInt(args[1], 10);

            if (!user || isNaN(amount)) {
                return message.reply('Please mention a user and provide a valid amount to add.');
            }

            try {
                let economyData = require('./data/economy.json');
                if (!economyData[user.id]) {
                    economyData[user.id] = { balance: 0, lastDaily: 0, lastWork: 0 };
                }
                economyData[user.id].balance += amount;
                await saveEconomy(economyData);
                message.reply(`Successfully added ${amount} to ${user.tag}'s balance. New balance: ${economyData[user.id].balance}`);
            } catch (error) {
                console.error(error);
                message.reply('An error occurred while adding the balance.');
            }
        }
    },
    {
        name: 'ownerhelp',
        description: 'Displays a list of all owner-only commands.',
        execute(message) {
            if (message.author.id !== ownerID) return message.reply('This is an owner-only command.');
            const embed = new EmbedBuilder()
                .setTitle('Owner Commands')
                .setColor(0x000000)
                .setDescription('Commands available only to the bot owner.');

            legacyCommands.forEach(command => {
                if (command.name !== 'ownerhelp') {
                    embed.addFields({
                        name: `\`$${command.name}\``,
                        value: command.description,
                        inline: false,
                    });
                }
            });

            message.reply({ embeds: [embed] });
        }
    }
];

module.exports = { legacyCommands };
