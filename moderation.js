// This file exports a single object containing both legacy prefix commands and slash commands for moderation.

const { EmbedBuilder, PermissionsBitField, SlashCommandBuilder } = require('discord.js');

const legacyCommands = [
    {
        name: 'ban',
        description: 'Bans a member from the server.',
        async execute(message, args) {
            // Check for required permissions
            if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                return message.reply('You do not have permission to ban members.');
            }
            const memberToBan = message.mentions.members.first();
            if (!memberToBan) {
                return message.reply('Please mention a user to ban.');
            }
            if (!memberToBan.bannable) {
                return message.reply('I cannot ban this user.');
            }

            const reason = args.slice(1).join(' ') || 'No reason provided.';

            await memberToBan.ban({ reason });

            const banEmbed = new EmbedBuilder()
                .setTitle('Member Banned')
                .setColor(0xFF0000)
                .setDescription(`${memberToBan.user.tag} has been banned.`)
                .addFields(
                    { name: 'Moderator', value: message.author.tag },
                    { name: 'Reason', value: reason },
                );

            message.channel.send({ embeds: [banEmbed] });
        },
    },
    {
        name: 'unban',
        description: 'Unbans a user from the server.',
        async execute(message, args) {
            if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                return message.reply('You do not have permission to unban members.');
            }
            const userId = args[0];
            if (!userId) {
                return message.reply('Please provide a user ID to unban.');
            }

            try {
                const user = await message.guild.members.unban(userId);
                const unbanEmbed = new EmbedBuilder()
                    .setTitle('User Unbanned')
                    .setColor(0x00FF00)
                    .setDescription(`${user.tag} has been unbanned.`);

                message.channel.send({ embeds: [unbanEmbed] });
            } catch (error) {
                console.error(error);
                message.reply('Could not unban the user. They may not be banned or the ID is invalid.');
            }
        },
    },
    {
        name: 'timeout',
        description: 'Timeouts a member.',
        async execute(message, args) {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                return message.reply('You do not have permission to timeout members.');
            }
            const memberToTimeout = message.mentions.members.first();
            if (!memberToTimeout) {
                return message.reply('Please mention a user to timeout.');
            }

            const timeInMinutes = parseInt(args[1]);
            if (isNaN(timeInMinutes) || timeInMinutes <= 0) {
                return message.reply('Please provide a valid timeout duration in minutes.');
            }

            const reason = args.slice(2).join(' ') || 'No reason provided.';
            const timeInMilliseconds = timeInMinutes * 60 * 1000;

            await memberToTimeout.timeout(timeInMilliseconds, reason);

            const timeoutEmbed = new EmbedBuilder()
                .setTitle('Member Timed Out')
                .setColor(0xFFA500)
                .setDescription(`${memberToTimeout.user.tag} has been timed out for ${timeInMinutes} minutes.`)
                .addFields(
                    { name: 'Moderator', value: message.author.tag },
                    { name: 'Reason', value: reason },
                );

            message.channel.send({ embeds: [timeoutEmbed] });
        },
    },
    {
        name: 'kick',
        description: 'Kicks a member from the server.',
        async execute(message, args) {
            if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
                return message.reply('You do not have permission to kick members.');
            }
            const memberToKick = message.mentions.members.first();
            if (!memberToKick) {
                return message.reply('Please mention a user to kick.');
            }
            if (!memberToKick.kickable) {
                return message.reply('I cannot kick this user.');
            }

            const reason = args.slice(1).join(' ') || 'No reason provided.';

            await memberToKick.kick(reason);

            const kickEmbed = new EmbedBuilder()
                .setTitle('Member Kicked')
                .setColor(0xFF4500)
                .setDescription(`${memberToKick.user.tag} has been kicked.`)
                .addFields(
                    { name: 'Moderator', value: message.author.tag },
                    { name: 'Reason', value: reason },
                );

            message.channel.send({ embeds: [kickEmbed] });
        },
    },
    {
        name: 'warn',
        description: 'Warns a user and sends the warning in a DM.',
        async execute(message, args) {
            if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
                return message.reply('You do not have permission to warn members.');
            }
            const memberToWarn = message.mentions.members.first();
            if (!memberToWarn) {
                return message.reply('Please mention a user to warn.');
            }

            const reason = args.slice(1).join(' ') || 'No reason provided.';
            const warnEmbed = new EmbedBuilder()
                .setTitle('You have been warned!')
                .setColor(0xFFFF00)
                .addFields(
                    { name: 'Reason', value: reason },
                    { name: 'Server', value: message.guild.name },
                );

            try {
                await memberToWarn.send({ embeds: [warnEmbed] });
                const confirmEmbed = new EmbedBuilder()
                    .setTitle('User Warned')
                    .setColor(0x00FF00)
                    .setDescription(`Successfully warned ${memberToWarn.user.tag}.`);
                message.channel.send({ embeds: [confirmEmbed] });
            } catch (error) {
                console.error('Failed to send DM to user:', error);
                message.reply('Could not send a warning DM to that user.');
            }
        },
    },
];

const slashCommands = [
    {
        data: new SlashCommandBuilder()
            .setName('ban')
            .setDescription('Bans a member from the server.')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('The member to ban.')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('reason')
                    .setDescription('The reason for the ban.')
                    .setRequired(false))
            .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers),
        async execute(interaction) {
            const memberToBan = interaction.options.getMember('user');
            if (!memberToBan) {
                return interaction.reply({ content: 'That user is not a member of this server.', ephemeral: true });
            }
            if (!memberToBan.bannable) {
                return interaction.reply({ content: 'I cannot ban this user.', ephemeral: true });
            }
            const reason = interaction.options.getString('reason') || 'No reason provided.';

            await memberToBan.ban({ reason });
            const banEmbed = new EmbedBuilder()
                .setTitle('Member Banned')
                .setColor(0xFF0000)
                .setDescription(`${memberToBan.user.tag} has been banned.`)
                .addFields(
                    { name: 'Moderator', value: interaction.user.tag },
                    { name: 'Reason', value: reason },
                );

            await interaction.reply({ embeds: [banEmbed] });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName('unban')
            .setDescription('Unbans a user from the server.')
            .addStringOption(option =>
                option.setName('userid')
                    .setDescription('The ID of the user to unban.')
                    .setRequired(true))
            .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers),
        async execute(interaction) {
            const userId = interaction.options.getString('userid');
            try {
                const user = await interaction.guild.members.unban(userId);
                const unbanEmbed = new EmbedBuilder()
                    .setTitle('User Unbanned')
                    .setColor(0x00FF00)
                    .setDescription(`${user.tag} has been unbanned.`);

                await interaction.reply({ embeds: [unbanEmbed] });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'Could not unban the user. They may not be banned or the ID is invalid.', ephemeral: true });
            }
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName('timeout')
            .setDescription('Timeouts a member.')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('The member to timeout.')
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('time')
                    .setDescription('The duration of the timeout in minutes.')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('reason')
                    .setDescription('The reason for the timeout.')
                    .setRequired(false))
            .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers),
        async execute(interaction) {
            const memberToTimeout = interaction.options.getMember('user');
            if (!memberToTimeout) {
                return interaction.reply({ content: 'That user is not a member of this server.', ephemeral: true });
            }
            const timeInMinutes = interaction.options.getInteger('time');
            const reason = interaction.options.getString('reason') || 'No reason provided.';
            const timeInMilliseconds = timeInMinutes * 60 * 1000;

            await memberToTimeout.timeout(timeInMilliseconds, reason);

            const timeoutEmbed = new EmbedBuilder()
                .setTitle('Member Timed Out')
                .setColor(0xFFA500)
                .setDescription(`${memberToTimeout.user.tag} has been timed out for ${timeInMinutes} minutes.`)
                .addFields(
                    { name: 'Moderator', value: interaction.user.tag },
                    { name: 'Reason', value: reason },
                );

            await interaction.reply({ embeds: [timeoutEmbed] });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName('kick')
            .setDescription('Kicks a member from the server.')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('The member to kick.')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('reason')
                    .setDescription('The reason for the kick.')
                    .setRequired(false))
            .setDefaultMemberPermissions(PermissionsBitField.Flags.KickMembers),
        async execute(interaction) {
            const memberToKick = interaction.options.getMember('user');
            if (!memberToKick) {
                return interaction.reply({ content: 'That user is not a member of this server.', ephemeral: true });
            }
            if (!memberToKick.kickable) {
                return interaction.reply({ content: 'I cannot kick this user.', ephemeral: true });
            }
            const reason = interaction.options.getString('reason') || 'No reason provided.';

            await memberToKick.kick(reason);

            const kickEmbed = new EmbedBuilder()
                .setTitle('Member Kicked')
                .setColor(0xFF4500)
                .setDescription(`${memberToKick.user.tag} has been kicked.`)
                .addFields(
                    { name: 'Moderator', value: interaction.user.tag },
                    { name: 'Reason', value: reason },
                );

            await interaction.reply({ embeds: [kickEmbed] });
        },
    },
    {
        data: new SlashCommandBuilder()
            .setName('warn')
            .setDescription('Warns a user and sends the warning in a DM.')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('The user to warn.')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('reason')
                    .setDescription('The reason for the warning.')
                    .setRequired(false))
            .setDefaultMemberPermissions(PermissionsBitField.Flags.KickMembers),
        async execute(interaction) {
            const memberToWarn = interaction.options.getMember('user');
            if (!memberToWarn) {
                return interaction.reply({ content: 'That user is not a member of this server.', ephemeral: true });
            }
            const reason = interaction.options.getString('reason') || 'No reason provided.';

            const warnEmbed = new EmbedBuilder()
                .setTitle('You have been warned!')
                .setColor(0xFFFF00)
                .addFields(
                    { name: 'Reason', value: reason },
                    { name: 'Server', value: interaction.guild.name },
                );

            try {
                await memberToWarn.send({ embeds: [warnEmbed] });
                const confirmEmbed = new EmbedBuilder()
                    .setTitle('User Warned')
                    .setColor(0x00FF00)
                    .setDescription(`Successfully warned ${memberToWarn.user.tag}.`);
                await interaction.reply({ embeds: [confirmEmbed] });
            } catch (error) {
                console.error('Failed to send DM to user:', error);
                await interaction.reply({ content: 'Could not send a warning DM to that user.', ephemeral: true });
            }
        },
    },
];

module.exports = {
    legacyCommands,
    slashCommands
};
