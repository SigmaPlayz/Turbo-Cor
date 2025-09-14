// This file contains commands and logic for a Discord ticket system.

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

let ticketData = {};
const filePath = path.join(__dirname, 'data', 'ticket.json');

// Function to load ticket data from the JSON file
async function loadTicketData() {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        ticketData = JSON.parse(data);
        console.log('Ticket data loaded successfully.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('Ticket data file not found. Creating a new one.');
            await saveTicketData();
        } else {
            console.error('Failed to load ticket data:', error);
        }
    }
}

// Function to save ticket data to the JSON file
async function saveTicketData() {
    try {
        await fs.writeFile(filePath, JSON.stringify(ticketData, null, 2), 'utf8');
        console.log('Ticket data saved successfully.');
    } catch (error) {
        console.error('Failed to save ticket data:', error);
    }
}

// Helper to find a ticket channel for a user
function findTicketChannel(guild, userId) {
    return guild.channels.cache.find(channel =>
        channel.type === ChannelType.GuildText &&
        channel.topic &&
        channel.topic.includes(`ticket-user-${userId}`)
    );
}

const legacyCommands = [
    {
        name: 'ticket-panel',
        description: 'Creates a ticket panel.',
        permissions: ['Administrator'],
        async execute(message) {
            const panelEmbed = new EmbedBuilder()
                .setTitle('Create a Ticket')
                .setDescription('Click the button below to create a new support ticket.')
                .setColor(0x0099FF);

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('create_ticket')
                        .setLabel('Create Ticket')
                        .setStyle(ButtonStyle.Primary)
                );

            await message.channel.send({ embeds: [panelEmbed], components: [row] });
        }
    },
    {
        name: 'ticket-create',
        description: 'Creates a support ticket.',
        async execute(message) {
            const userId = message.author.id;
            const guild = message.guild;

            if (findTicketChannel(guild, userId)) {
                return message.reply({ content: 'You already have an open ticket.', ephemeral: true });
            }

            const ticketChannel = await guild.channels.create({
                name: `ticket-${message.author.username}`,
                type: ChannelType.GuildText,
                topic: `ticket-user-${userId}`,
                parent: ticketData.categoryChannelId, // Use a category ID if stored
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
                .setDescription(`Welcome to your support ticket, ${message.author}! A staff member will be with you shortly.`)
                .setColor(0x00FF00);

            await ticketChannel.send({ embeds: [welcomeEmbed] });
            await message.reply({ content: `Your ticket has been created in ${ticketChannel}.`, ephemeral: true });
        }
    },
    {
        name: 'ticket-adduser',
        description: 'Adds a user to the current ticket.',
        permissions: ['ManageChannels'],
        async execute(message, args) {
            const member = message.mentions.members.first();
            if (!member) {
                return message.reply('Please mention a user to add to the ticket.');
            }
            if (!message.channel.name.startsWith('ticket-')) {
                return message.reply('This command can only be used in a ticket channel.');
            }

            await message.channel.permissionOverwrites.edit(member.id, {
                ViewChannel: true,
                SendMessages: true
            });
            message.channel.send(`${member} has been added to the ticket.`);
        }
    },
    {
        name: 'ticket-removeuser',
        description: 'Removes a user from the current ticket.',
        permissions: ['ManageChannels'],
        async execute(message, args) {
            const member = message.mentions.members.first();
            if (!member) {
                return message.reply('Please mention a user to remove from the ticket.');
            }
            if (!message.channel.name.startsWith('ticket-')) {
                return message.reply('This command can only be used in a ticket channel.');
            }
            if (message.channel.topic.includes(`ticket-user-${member.id}`)) {
                return message.reply('You cannot remove the ticket owner.');
            }

            await message.channel.permissionOverwrites.edit(member.id, {
                ViewChannel: false,
            });
            message.channel.send(`${member} has been removed from the ticket.`);
        }
    },
    {
        name: 'ticket-close',
        description: 'Closes the current ticket.',
        permissions: ['ManageChannels'],
        async execute(message) {
            if (!message.channel.name.startsWith('ticket-')) {
                return message.reply('This command can only be used in a ticket channel.');
            }

            await message.channel.send('This ticket will be closed in 5 seconds...');
            setTimeout(() => {
                message.channel.delete();
            }, 5000);
        }
    },
    {
        name: 'ticket-logs',
        description: 'Saves a transcript of the ticket to a specified channel.',
        permissions: ['ManageChannels'],
        async execute(message, args) {
            const logsChannel = message.mentions.channels.first();
            if (!logsChannel) {
                return message.reply('Please mention a channel to send the logs to.');
            }
            if (!message.channel.name.startsWith('ticket-')) {
                return message.reply('This command can only be used in a ticket channel.');
            }

            // Simple log, a more robust solution would use message collectors
            const messages = await message.channel.messages.fetch({ limit: 100 });
            const logContent = messages.map(msg => `${msg.author.tag}: ${msg.content}`).reverse().join('\n');

            await logsChannel.send({
                files: [{
                    attachment: Buffer.from(logContent, 'utf-8'),
                    name: `ticket-log-${message.channel.name}.txt`
                }]
            });
            message.channel.send(`Ticket logs have been sent to ${logsChannel}.`);
        }
    },
    {
        name: 'ticket-transcript',
        description: 'Saves a transcript and closes the ticket.',
        permissions: ['ManageChannels'],
        async execute(message, args) {
            const logsChannel = message.mentions.channels.first();
            if (!logsChannel) {
                return message.reply('Please mention a channel to send the transcript to.');
            }
            if (!message.channel.name.startsWith('ticket-')) {
                return message.reply('This command can only be used in a ticket channel.');
            }

            const messages = await message.channel.messages.fetch({ limit: 100 });
            const logContent = messages.map(msg => `${msg.author.tag}: ${msg.content}`).reverse().join('\n');

            await logsChannel.send({
                files: [{
                    attachment: Buffer.from(logContent, 'utf-8'),
                    name: `ticket-transcript-${message.channel.name}.txt`
                }]
            });
            message.channel.send(`Ticket transcript has been sent to ${logsChannel}. This ticket will now be closed in 5 seconds...`);
            setTimeout(() => {
                message.channel.delete();
            }, 5000);
        }
    },
];

const slashCommands = [
    {
        data: new SlashCommandBuilder()
            .setName('ticket-panel')
            .setDescription('Creates a ticket panel.')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        async execute(interaction) {
            const panelEmbed = new EmbedBuilder()
                .setTitle('Create a Ticket')
                .setDescription('Click the button below to create a new support ticket.')
                .setColor(0x0099FF);

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('create_ticket')
                        .setLabel('Create Ticket')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.reply({ embeds: [panelEmbed], components: [row] });
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('ticket-create')
            .setDescription('Creates a support ticket.'),
        async execute(interaction) {
            const userId = interaction.user.id;
            const guild = interaction.guild;

            if (findTicketChannel(guild, userId)) {
                return interaction.reply({ content: 'You already have an open ticket.', ephemeral: true });
            }

            const ticketChannel = await guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                topic: `ticket-user-${userId}`,
                parent: ticketData.categoryChannelId, // Use a category ID if stored
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
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('ticket-adduser')
            .setDescription('Adds a user to the current ticket.')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('The user to add to the ticket.')
                    .setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
        async execute(interaction) {
            const member = interaction.options.getMember('user');
            if (!interaction.channel.name.startsWith('ticket-')) {
                return interaction.reply({ content: 'This command can only be used in a ticket channel.', ephemeral: true });
            }

            await interaction.channel.permissionOverwrites.edit(member.id, {
                ViewChannel: true,
                SendMessages: true
            });
            await interaction.reply({ content: `${member} has been added to the ticket.`, ephemeral: true });
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('ticket-removeuser')
            .setDescription('Removes a user from the current ticket.')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('The user to remove from the ticket.')
                    .setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
        async execute(interaction) {
            const member = interaction.options.getMember('user');
            if (!interaction.channel.name.startsWith('ticket-')) {
                return interaction.reply({ content: 'This command can only be used in a ticket channel.', ephemeral: true });
            }
            if (interaction.channel.topic.includes(`ticket-user-${member.id}`)) {
                return interaction.reply({ content: 'You cannot remove the ticket owner.', ephemeral: true });
            }

            await interaction.channel.permissionOverwrites.edit(member.id, {
                ViewChannel: false,
            });
            await interaction.reply({ content: `${member} has been removed from the ticket.`, ephemeral: true });
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('ticket-close')
            .setDescription('Closes the current ticket.')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
        async execute(interaction) {
            if (!interaction.channel.name.startsWith('ticket-')) {
                return interaction.reply({ content: 'This command can only be used in a ticket channel.', ephemeral: true });
            }

            await interaction.reply({ content: 'This ticket will be closed in 5 seconds...', ephemeral: false });
            setTimeout(() => {
                interaction.channel.delete();
            }, 5000);
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('ticket-logs')
            .setDescription('Saves a transcript of the ticket to a specified channel.')
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('The channel to send the logs to.')
                    .setRequired(true)
                    .addChannelTypes(ChannelType.GuildText))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
        async execute(interaction) {
            const logsChannel = interaction.options.getChannel('channel');
            if (!interaction.channel.name.startsWith('ticket-')) {
                return interaction.reply({ content: 'This command can only be used in a ticket channel.', ephemeral: true });
            }

            const messages = await interaction.channel.messages.fetch({ limit: 100 });
            const logContent = messages.map(msg => `${msg.author.tag}: ${msg.content}`).reverse().join('\n');

            await logsChannel.send({
                files: [{
                    attachment: Buffer.from(logContent, 'utf-8'),
                    name: `ticket-log-${interaction.channel.name}.txt`
                }]
            });
            await interaction.reply({ content: `Ticket logs have been sent to ${logsChannel}.`, ephemeral: true });
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('ticket-transcript')
            .setDescription('Saves a transcript and closes the ticket.')
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('The channel to send the transcript to.')
                    .setRequired(true)
                    .addChannelTypes(ChannelType.GuildText))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
        async execute(interaction) {
            const logsChannel = interaction.options.getChannel('channel');
            if (!interaction.channel.name.startsWith('ticket-')) {
                return interaction.reply({ content: 'This command can only be used in a ticket channel.', ephemeral: true });
            }

            const messages = await interaction.channel.messages.fetch({ limit: 100 });
            const logContent = messages.map(msg => `${msg.author.tag}: ${msg.content}`).reverse().join('\n');

            await logsChannel.send({
                files: [{
                    attachment: Buffer.from(logContent, 'utf-8'),
                    name: `ticket-transcript-${interaction.channel.name}.txt`
                }]
            });
            await interaction.reply({ content: `Ticket transcript has been sent to ${logsChannel}. This ticket will now be closed in 5 seconds...`, ephemeral: false });
            setTimeout(() => {
                interaction.channel.delete();
            }, 5000);
        }
    },
];

module.exports = {
    loadTicketData,
    legacyCommands,
    slashCommands
};
