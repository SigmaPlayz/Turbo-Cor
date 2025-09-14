// This is the main file for your Discord bot.
// It sets up the client, loads commands, and handles incoming messages.

// Load environment variables from the .env file
require('dotenv').config();

const { Client, GatewayIntentBits, Collection, EmbedBuilder, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { legacyCommands: utilityLegacy, slashCommands: utilitySlash } = require('./utility.js');
const { legacyCommands: moderationLegacy, slashCommands: moderationSlash } = require('./moderation.js');
const { loadEconomy, legacyCommands: economyLegacy, slashCommands: economySlash, saveEconomy } = require('./economy.js');
const { loadTicketData, legacyCommands: ticketLegacy, slashCommands: ticketSlash } = require('./ticket.js');
const { legacyCommands: ownerLegacy } = require('./owner.js');

// Create a new Discord client instance with the necessary intents.
// Intents are required to let Discord know what events your bot wants to receive.
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Create a new Collection to store your commands.
client.commands = new Collection();
client.slashCommands = new Collection();

// Combine and load all legacy commands from all files.
const allLegacyCommands = [...utilityLegacy, ...moderationLegacy, ...economyLegacy, ...ticketLegacy, ...ownerLegacy];
for (const command of allLegacyCommands) {
    client.commands.set(command.name, command);
}

// Combine and load all slash commands from all files.
const allSlashCommands = [...utilitySlash, ...moderationSlash, ...economySlash, ...ticketSlash];
for (const command of allSlashCommands) {
    if (command.data) {
        client.slashCommands.set(command.data.name, command);
    } else {
        console.error(`[WARNING] Slash command is missing 'data' property. Skipping.`);
    }
}

// Define the help command dynamically
const helpCommand = {
    name: 'help',
    description: 'Displays a list of all available commands.',
    async execute(message) {
        const isOwner = message.author.id === process.env.OWNER_ID;

        const options = [
            new StringSelectMenuOptionBuilder()
                .setLabel('Utility Commands')
                .setValue('help_utility')
                .setDescription('General utility commands like ping and say.'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Moderation Commands')
                .setValue('help_moderation')
                .setDescription('Commands for managing the server.'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Economy Commands')
                .setValue('help_economy')
                .setDescription('Commands for the server economy.'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Ticket Commands')
                .setValue('help_ticket')
                .setDescription('Commands for the support ticket system.'),
        ];

        if (isOwner) {
            options.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Owner Commands')
                    .setValue('help_owner')
                    .setDescription('Commands for bot owner only.')
            );
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('help_menu')
                    .setPlaceholder('Select a command category...')
                    .addOptions(...options),
            );

        const helpEmbed = new EmbedBuilder()
            .setTitle('Bot Commands')
            .setColor(0x0099FF)
            .setDescription('Please select a category below to view the commands.');

        await message.reply({ embeds: [helpEmbed], components: [row] });
    },
};

// Add the help command to the collection
client.commands.set(helpCommand.name, helpCommand);

// Define the command prefix.
const prefix = '$';

// Event listener for when the bot is ready.
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // Register slash commands
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('Started refreshing application (/) commands globally.');
        const slashCommandData = client.slashCommands.map(command => command.data.toJSON());
        // Use global registration for universal availability.
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: slashCommandData },
        );

        console.log('Successfully reloaded application (/) commands globally.');
    } catch (error) {
        console.error(error);
    }
});

// Event listener for incoming messages (legacy prefix commands).
client.on('messageCreate', (message) => {
    // Ignore messages from other bots and messages that don't start with the prefix.
    if (message.author.bot || !message.content.startsWith(prefix)) {
        return;
    }

    // Extract the command name and arguments from the message.
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // Check if the command exists in our collection.
    if (!client.commands.has(commandName)) {
        return; // Do nothing if the command doesn't exist.
    }

    // Get the command from the collection.
    const command = client.commands.get(commandName);

    try {
        // Execute the command's function.
        command.execute(message, args);
    } catch (error) {
        console.error(error);
        message.reply('There was an error trying to execute that command!');
    }
});

// Event listener for slash command interactions and button interactions.
client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        const slashCommand = client.slashCommands.get(interaction.commandName);
        if (!slashCommand) return;
        try {
            await slashCommand.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
    } else if (interaction.isButton()) {
        const customId = interaction.customId;

        if (customId === 'create_ticket') {
            const userId = interaction.user.id;
            const guild = interaction.guild;

            const existingChannel = guild.channels.cache.find(channel =>
                channel.topic && channel.topic.includes(`ticket-user-${userId}`)
            );

            if (existingChannel) {
                return interaction.reply({ content: 'You already have an open ticket.', ephemeral: true });
            }

            const ticketChannel = await guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                topic: `ticket-user-${userId}`,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: userId,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                    },
                    // Add staff roles here
                ],
            });

            const welcomeEmbed = new EmbedBuilder()
                .setTitle('New Ticket')
                .setDescription(`Welcome to your support ticket, ${interaction.user}! A staff member will be with you shortly.`)
                .setColor(0x00FF00);

            await ticketChannel.send({ embeds: [welcomeEmbed] });
            await interaction.reply({ content: `Your ticket has been created in ${ticketChannel}.`, ephemeral: true });
        } else if (customId.startsWith('fight_')) {
            const [_, action, challengerId, challengedId] = customId.split('_');
            const challengedUser = interaction.user;
            const economyData = require('./data/economy.json');

            // Check if the interaction is from the challenged user
            if (challengedUser.id !== challengedId) {
                return interaction.reply({ content: 'You are not the user being challenged!', ephemeral: true });
            }

            const bet = economyData[challengerId]?.lastFightBet;
            if (bet === undefined) {
                return interaction.update({ content: 'This fight challenge has expired or the bet amount could not be found.', components: [] });
            }

            const challengerUser = await interaction.client.users.fetch(challengerId);

            if (action === 'accept') {
                if (!economyData[challengerUser.id] || economyData[challengerUser.id].balance < bet || !economyData[challengedUser.id] || economyData[challengedUser.id].balance < bet) {
                    return await interaction.update({ content: 'One of the users no longer has enough coins to fight!', components: [] });
                }

                const winner = Math.random() < 0.5 ? challengerUser : challengedUser;
                const loser = winner.id === challengerUser.id ? challengedUser : challengerUser;

                economyData[winner.id].balance += bet;
                economyData[loser.id].balance -= bet;

                await saveEconomy(economyData);

                const fightEmbed = new EmbedBuilder()
                    .setTitle('Fight Result')
                    .setColor(0x00FF00)
                    .setDescription(`${winner} has won the fight against ${loser}! They won **${bet}** coins.`);

                await interaction.update({ embeds: [fightEmbed], components: [] });
            } else {
                const declineEmbed = new EmbedBuilder()
                    .setTitle('Fight Declined')
                    .setColor(0xFF0000)
                    .setDescription(`${challengedUser} has declined the fight with ${challengerUser}.`);

                await interaction.update({ embeds: [declineEmbed], components: [] });
            }
        } else {
            const helpEmbed = new EmbedBuilder().setColor(0x0099FF);
            let commands;
            let title;
            let color;

            if (customId === 'help_utility') {
                title = 'Utility Commands';
                commands = utilityLegacy;
                color = 0x3498db;
            } else if (customId === 'help_moderation') {
                title = 'Moderation Commands';
                commands = moderationLegacy;
                color = 0xe74c3c;
            } else if (customId === 'help_economy') {
                title = 'Economy Commands';
                commands = economyLegacy;
                color = 0x2ecc71;
            } else if (customId === 'help_ticket') {
                title = 'Ticket Commands';
                commands = ticketLegacy;
                color = 0xf1c40f;
            }

            helpEmbed.setTitle(title);
            helpEmbed.setColor(color);
            commands.forEach(command => {
                helpEmbed.addFields({
                    name: `$${command.name}`,
                    value: command.description,
                    inline: false,
                });
            });

            await interaction.update({ embeds: [helpEmbed], components: [] });
        }
    } else if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'help_menu') {
            const selectedValue = interaction.values[0];

            const helpEmbed = new EmbedBuilder().setColor(0x0099FF);
            let commands;
            let title;
            let color;

            if (selectedValue === 'help_utility') {
                title = 'Utility Commands';
                commands = utilityLegacy;
                color = 0x3498db;
            } else if (selectedValue === 'help_moderation') {
                title = 'Moderation Commands';
                commands = moderationLegacy;
                color = 0xe74c3c;
            } else if (selectedValue === 'help_economy') {
                title = 'Economy Commands';
                commands = economyLegacy;
                color = 0x2ecc71;
            } else if (selectedValue === 'help_ticket') {
                title = 'Ticket Commands';
                commands = ticketLegacy;
                color = 0xf1c40f;
            } else if (selectedValue === 'help_owner') {
                title = 'Owner Commands';
                commands = ownerLegacy;
                color = 0x000000;
            }

            helpEmbed.setTitle(title);
            helpEmbed.setColor(color);
            commands.forEach(command => {
                helpEmbed.addFields({
                    name: `$${command.name}`,
                    value: command.description,
                    inline: false,
                });
            });

            const options = [
                new StringSelectMenuOptionBuilder()
                    .setLabel('Utility Commands')
                    .setValue('help_utility')
                    .setDescription('General utility commands like ping and say.'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Moderation Commands')
                    .setValue('help_moderation')
                    .setDescription('Commands for managing the server.'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Economy Commands')
                    .setValue('help_economy')
                    .setDescription('Commands for the server economy.'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Ticket Commands')
                    .setValue('help_ticket')
                    .setDescription('Commands for the support ticket system.'),
            ];

            if (interaction.user.id === process.env.OWNER_ID) {
                options.push(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Owner Commands')
                        .setValue('help_owner')
                        .setDescription('Commands for bot owner only.')
                );
            }

            const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('help_menu')
                        .setPlaceholder('Select a command category...')
                        .addOptions(...options),
                );

            await interaction.update({ embeds: [helpEmbed], components: [row] });
        }
    }
});


// Create a help slash command
const helpSlashCommand = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Displays a list of all available commands.'),
    async execute(interaction) {
        const isOwner = interaction.user.id === process.env.OWNER_ID;

        const options = [
            new StringSelectMenuOptionBuilder()
                .setLabel('Utility Commands')
                .setValue('help_utility')
                .setDescription('General utility commands like ping and say.'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Moderation Commands')
                .setValue('help_moderation')
                .setDescription('Commands for managing the server.'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Economy Commands')
                .setValue('help_economy')
                .setDescription('Commands for the server economy.'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Ticket Commands')
                .setValue('help_ticket')
                .setDescription('Commands for the support ticket system.'),
        ];

        if (isOwner) {
            options.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Owner Commands')
                    .setValue('help_owner')
                    .setDescription('Commands for bot owner only.')
                );
            }

            const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                    .setCustomId('help_menu')
                    .setPlaceholder('Select a command category...')
                    .addOptions(...options),
                );
        const helpEmbed = new EmbedBuilder()
            .setTitle('Bot Commands')
            .setColor(0x0099FF)
            .setDescription('Please select a category below to view the commands.');

        await interaction.reply({ embeds: [helpEmbed], components: [row] });
    }
};

// Add the help slash command to the collection
client.slashCommands.set(helpSlashCommand.data.name, helpSlashCommand);

// This is the crucial change. We now await the loading of economy and ticket data before logging in.
(async () => {
    await loadEconomy();
    await loadTicketData();
    client.login(process.env.DISCORD_TOKEN);
})();
