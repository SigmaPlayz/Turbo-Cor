// This file exports a single object containing both legacy prefix commands and slash commands.

const { EmbedBuilder, WebhookClient, PermissionsBitField, SlashCommandBuilder } = require('discord.js');

const legacyCommands = [
    {
        name: 'ping',
        description: 'Shows the bot\'s latency and API latency.',
        async execute(message, args) {
            const sent = await message.reply('Pinging...');
            const latency = sent.createdTimestamp - message.createdTimestamp;

            const pingEmbed = new EmbedBuilder()
                .setTitle('Pong!')
                .setColor(0x0099FF)
                .addFields(
                    { name: 'Latency', value: `${latency}ms`, inline: true },
                    { name: 'API Latency', value: `${message.client.ws.ping}ms`, inline: true }
                );

            sent.edit({ embeds: [pingEmbed], content: null });
        },
    },
    {
        name: 'uptime',
        description: 'Shows the bot\'s uptime.',
        execute(message) {
            let totalSeconds = (message.client.uptime / 1000);
            let days = Math.floor(totalSeconds / 86400);
            totalSeconds %= 86400;
            let hours = Math.floor(totalSeconds / 3600);
            totalSeconds %= 3600;
            let minutes = Math.floor(totalSeconds / 60);
            let seconds = Math.floor(totalSeconds % 60);
            message.channel.send(`I have been online for ${days} days, ${hours} hours, ${minutes} minutes and ${seconds} seconds.`);
        },
    },
    {
        name: 'avatar',
        description: 'Displays the avatar of the mentioned user or yourself.',
        execute(message) {
            const user = message.mentions.users.first() || message.author;
            const avatarEmbed = new EmbedBuilder()
                .setTitle(`${user.username}'s Avatar`)
                .setColor(0x0099FF)
                .setImage(user.displayAvatarURL({ dynamic: true, size: 4096 }));
            message.channel.send({ embeds: [avatarEmbed] });
        },
    },
    {
        name: 'serverinfo',
        description: 'Displays information about the server.',
        execute(message) {
            const server = message.guild;
            if (!server) {
                return message.reply('This command can only be used in a server.');
            }
            const serverEmbed = new EmbedBuilder()
                .setTitle(`${server.name} Information`)
                .setColor(0x0099FF)
                .addFields(
                    { name: 'Server Name', value: server.name, inline: true },
                    { name: 'Total Members', value: `${server.memberCount}`, inline: true },
                    { name: 'Creation Date', value: server.createdAt.toDateString(), inline: true },
                    { name: 'Owner', value: `<@${server.ownerId}>`, inline: true },
                    { name: 'Server Boosts', value: `${server.premiumSubscriptionCount || '0'}`, inline: true },
                    { name: 'Roles', value: `${server.roles.cache.size}`, inline: true },
                    { name: 'Channels', value: `${server.channels.cache.size}`, inline: true },
                )
                .setThumbnail(server.iconURL({ dynamic: true }));
            message.channel.send({ embeds: [serverEmbed] });
        },
    },
    {
        name: 'userinfo',
        description: 'Displays information about a user.',
        execute(message) {
            const user = message.mentions.users.first() || message.author;
            const member = message.guild.members.cache.get(user.id);
            const userEmbed = new EmbedBuilder()
                .setTitle(`${user.username} Information`)
                .setColor(0x0099FF)
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: 'Username', value: user.username, inline: true },
                    { name: 'User ID', value: user.id, inline: true },
                    { name: 'Account Creation Date', value: user.createdAt.toDateString(), inline: false },
                    { name: 'Joined Server Date', value: member.joinedAt.toDateString(), inline: false },
                    { name: 'Roles', value: member.roles.cache.map(role => role.name).join(', ') },
                );
            message.channel.send({ embeds: [userEmbed] });
        },
    },
    {
        name: 'myinvites',
        description: 'Shows the number of invites you have created.',
        async execute(message) {
            const user = message.author;
            const invites = await message.guild.invites.fetch();
            const userInvites = invites.filter(i => i.inviter.id === user.id);
            const totalInvites = userInvites.reduce((acc, invite) => acc + invite.uses, 0);
            message.reply(`You have created ${totalInvites} invites.`);
        },
    },
    {
        name: 'say',
        description: 'Makes the bot say a message.',
        execute(message, args) {
            const messageToSay = args.join(' ');
            if (messageToSay) {
                // Delete the original command message to make the bot's response cleaner.
                message.delete().catch(console.error);
                message.channel.send(messageToSay);
            } else {
                message.reply('Please provide a message for me to say!');
            }
        },
    },
    {
        name: 'webhook',
        description: 'Sends a message as a webhook. Usage: !webhook <name> <msg>',
        async execute(message, args) {
            // Check for required permissions
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageWebhooks)) {
                return message.reply('You do not have permission to use this command.');
            }
            if (args.length < 2) {
                return message.reply('Please provide a webhook name and message. Usage: `!webhook <name> <msg>`');
            }

            const webhookName = args.shift();
            const webhookMessage = args.join(' ');

            try {
                // Attempt to find an existing webhook in the channel
                let webhooks = await message.channel.fetchWebhooks();
                let webhook = webhooks.find(wh => wh.name === webhookName);

                // If no webhook is found, create a new one.
                if (!webhook) {
                    webhook = await message.channel.createWebhook({
                        name: webhookName,
                        avatar: message.client.user.displayAvatarURL(),
                    });
                }

                await webhook.send({
                    content: webhookMessage,
                    username: webhookName,
                });

                message.delete().catch(console.error);
            } catch (error) {
                console.error('Error with webhook:', error);
                message.reply('There was an error creating or sending the webhook message.');
            }
        },
    },
];

const slashCommands = [
    {
        data: new SlashCommandBuilder()
            .setName('ping')
            .setDescription('Shows the bot\'s latency and API latency.'),
        async execute(interaction) {
            const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
            const latency = sent.createdTimestamp - interaction.createdTimestamp;

            const pingEmbed = new EmbedBuilder()
                .setTitle('Pong!')
                .setColor(0x0099FF)
                .addFields(
                    { name: 'Latency', value: `${latency}ms`, inline: true },
                    { name: 'API Latency', value: `${interaction.client.ws.ping}ms`, inline: true }
                );

            await interaction.editReply({ embeds: [pingEmbed], content: null });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName('uptime')
            .setDescription('Shows the bot\'s uptime.'),
        async execute(interaction) {
            let totalSeconds = (interaction.client.uptime / 1000);
            let days = Math.floor(totalSeconds / 86400);
            totalSeconds %= 86400;
            let hours = Math.floor(totalSeconds / 3600);
            totalSeconds %= 3600;
            let minutes = Math.floor(totalSeconds / 60);
            let seconds = Math.floor(totalSeconds % 60);
            await interaction.reply({ content: `I have been online for ${days} days, ${hours} hours, ${minutes} minutes and ${seconds} seconds.` });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName('avatar')
            .setDescription('Displays the avatar of the mentioned user or yourself.')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('The user to get the avatar of.')
                    .setRequired(false)),
        async execute(interaction) {
            const user = interaction.options.getUser('user') || interaction.user;
            const avatarEmbed = new EmbedBuilder()
                .setTitle(`${user.username}'s Avatar`)
                .setColor(0x0099FF)
                .setImage(user.displayAvatarURL({ dynamic: true, size: 4096 }));
            await interaction.reply({ embeds: [avatarEmbed] });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName('serverinfo')
            .setDescription('Displays information about the server.'),
        async execute(interaction) {
            const server = interaction.guild;
            if (!server) {
                return interaction.reply('This command can only be used in a server.');
            }
            const serverEmbed = new EmbedBuilder()
                .setTitle(`${server.name} Information`)
                .setColor(0x0099FF)
                .addFields(
                    { name: 'Server Name', value: server.name, inline: true },
                    { name: 'Total Members', value: `${server.memberCount}`, inline: true },
                    { name: 'Creation Date', value: server.createdAt.toDateString(), inline: true },
                    { name: 'Owner', value: `<@${server.ownerId}>`, inline: true },
                    { name: 'Server Boosts', value: `${server.premiumSubscriptionCount || '0'}`, inline: true },
                    { name: 'Roles', value: `${server.roles.cache.size}`, inline: true },
                    { name: 'Channels', value: `${server.channels.cache.size}`, inline: true },
                )
                .setThumbnail(server.iconURL({ dynamic: true }));
            await interaction.reply({ embeds: [serverEmbed] });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName('userinfo')
            .setDescription('Displays information about a user.')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('The user to get information about.')
                    .setRequired(false)),
        async execute(interaction) {
            const user = interaction.options.getUser('user') || interaction.user;
            const member = interaction.guild.members.cache.get(user.id);
            const userEmbed = new EmbedBuilder()
                .setTitle(`${user.username} Information`)
                .setColor(0x0099FF)
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: 'Username', value: user.username, inline: true },
                    { name: 'User ID', value: user.id, inline: true },
                    { name: 'Account Creation Date', value: user.createdAt.toDateString(), inline: false },
                    { name: 'Joined Server Date', value: member.joinedAt.toDateString(), inline: false },
                    { name: 'Roles', value: member.roles.cache.map(role => role.name).join(', ') },
                );
            await interaction.reply({ embeds: [userEmbed] });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName('myinvites')
            .setDescription('Shows the number of invites you have created.'),
        async execute(interaction) {
            const user = interaction.user;
            const invites = await interaction.guild.invites.fetch();
            const userInvites = invites.filter(i => i.inviter.id === user.id);
            const totalInvites = userInvites.reduce((acc, invite) => acc + invite.uses, 0);
            await interaction.reply({ content: `You have created ${totalInvites} invites.` });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName('say')
            .setDescription('Makes the bot say a message.')
            .addStringOption(option =>
                option.setName('message')
                    .setDescription('The message to say.')
                    .setRequired(true)),
        async execute(interaction) {
            const messageToSay = interaction.options.getString('message');
            await interaction.reply({ content: messageToSay });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName('webhook')
            .setDescription('Sends a message as a webhook.')
            .addStringOption(option =>
                option.setName('name')
                    .setDescription('The name for the webhook.')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('message')
                    .setDescription('The message to send.')
                    .setRequired(true)),
        async execute(interaction) {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageWebhooks)) {
                return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            }

            const webhookName = interaction.options.getString('name');
            const webhookMessage = interaction.options.getString('message');
            const channel = interaction.channel;

            try {
                let webhooks = await channel.fetchWebhooks();
                let webhook = webhooks.find(wh => wh.name === webhookName);

                if (!webhook) {
                    webhook = await channel.createWebhook({
                        name: webhookName,
                        avatar: interaction.client.user.displayAvatarURL(),
                    });
                }

                await webhook.send({
                    content: webhookMessage,
                    username: webhookName,
                });

                await interaction.reply({ content: 'Webhook message sent!', ephemeral: true });
            } catch (error) {
                console.error('Error with webhook:', error);
                await interaction.reply({ content: 'There was an error creating or sending the webhook message.', ephemeral: true });
            }
        },
    },
];

module.exports = {
    legacyCommands,
    slashCommands
};
