const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const economyFilePath = path.join(__dirname, 'data', 'economy.json');
let economyData = {};

// Ensure the data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// Function to save economy data to the JSON file
async function saveEconomy(data) {
    try {
        fs.writeFileSync(economyFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error('Failed to save economy data:', error);
    }
}

// Function to load economy data from the JSON file
async function loadEconomy() {
    try {
        if (fs.existsSync(economyFilePath)) {
            const data = fs.readFileSync(economyFilePath, 'utf-8');
            economyData = JSON.parse(data);
        } else {
            // Create an empty economy file if it doesn't exist
            saveEconomy({});
        }
    } catch (error) {
        console.error('Failed to load economy data:', error);
        economyData = {};
    }
}

// Legacy Commands
const legacyCommands = [
    {
        name: 'balance',
        description: 'Check your current balance.',
        async execute(message) {
            const user = message.author;
            const balance = economyData[user.id] ? economyData[user.id].balance : 0;
            const embed = new EmbedBuilder()
                .setTitle(`${user.username}'s Balance`)
                .setDescription(`You currently have **${balance}** coins.`)
                .setColor(0x3498db);
            message.reply({ embeds: [embed] });
        },
    },
    {
        name: 'daily',
        description: 'Claim your daily coins.',
        async execute(message) {
            const user = message.author;
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            const lastDaily = economyData[user.id]?.lastDaily || 0;

            if (now - lastDaily < oneDay) {
                const timeLeft = oneDay - (now - lastDaily);
                const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
                return message.reply(`You have already claimed your daily reward. Come back in ${hours}h ${minutes}m ${seconds}s.`);
            }

            const dailyReward = 100;
            if (!economyData[user.id]) {
                economyData[user.id] = { balance: 0, lastDaily: now, lastWork: 0 };
            }
            economyData[user.id].balance += dailyReward;
            economyData[user.id].lastDaily = now;

            await saveEconomy(economyData);
            const embed = new EmbedBuilder()
                .setTitle('Daily Reward Claimed')
                .setDescription(`You have claimed your daily reward of **${dailyReward}** coins! Your new balance is **${economyData[user.id].balance}** coins.`)
                .setColor(0x2ecc71);
            message.reply({ embeds: [embed] });
        },
    },
    {
        name: 'work',
        description: 'Work to earn some coins.',
        async execute(message) {
            const user = message.author;
            const now = Date.now();
            const oneHour = 60 * 60 * 1000;
            const lastWork = economyData[user.id]?.lastWork || 0;

            if (now - lastWork < oneHour) {
                const timeLeft = oneHour - (now - lastWork);
                const minutes = Math.floor(timeLeft / (1000 * 60));
                const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
                return message.reply(`You have worked recently. Try again in ${minutes}m ${seconds}s.`);
            }

            const earnings = Math.floor(Math.random() * 50) + 1; // Random earnings between 1 and 50
            if (!economyData[user.id]) {
                economyData[user.id] = { balance: 0, lastDaily: 0, lastWork: now };
            }
            economyData[user.id].balance += earnings;
            economyData[user.id].lastWork = now;

            await saveEconomy(economyData);
            const embed = new EmbedBuilder()
                .setTitle('Work Complete')
                .setDescription(`You worked hard and earned **${earnings}** coins! Your new balance is **${economyData[user.id].balance}** coins.`)
                .setColor(0xf1c40f);
            message.reply({ embeds: [embed] });
        },
    },
    {
        name: 'cf',
        description: 'Coinflip. Bet on heads or tails.',
        async execute(message, args) {
            const user = message.author;
            const bet = parseInt(args[0], 10);
            const choice = args[1]?.toLowerCase();

            if (!bet || bet <= 0 || isNaN(bet)) {
                return message.reply('Please specify a valid bet amount.');
            }
            if (!choice || (choice !== 'heads' && choice !== 'tails')) {
                return message.reply('Please choose either `heads` or `tails`.');
            }

            if (!economyData[user.id] || economyData[user.id].balance < bet) {
                return message.reply('You do not have enough coins to place that bet.');
            }

            const outcome = Math.random() < 0.5 ? 'heads' : 'tails';
            const resultEmbed = new EmbedBuilder();

            if (choice === outcome) {
                economyData[user.id].balance += bet;
                resultEmbed.setTitle('You Won!')
                    .setDescription(`The coin landed on **${outcome}**. You won **${bet}** coins. Your new balance is ${economyData[user.id].balance}.`)
                    .setColor(0x2ecc71);
            } else {
                economyData[user.id].balance -= bet;
                resultEmbed.setTitle('You Lost!')
                    .setDescription(`The coin landed on **${outcome}**. You lost **${bet}** coins. Your new balance is ${economyData[user.id].balance}.`)
                    .setColor(0xe74c3c);
            }
            await saveEconomy(economyData);
            message.reply({ embeds: [resultEmbed] });
        },
    },
    {
        name: 'slots',
        description: 'Play the slot machine. Bet on a win.',
        async execute(message, args) {
            const user = message.author;
            const bet = parseInt(args[0], 10);

            if (!bet || bet <= 0 || isNaN(bet)) {
                return message.reply('Please specify a valid bet amount.');
            }
            if (!economyData[user.id] || economyData[user.id].balance < bet) {
                return message.reply('You do not have enough coins to place that bet.');
            }

            const symbols = ['🍒', '🍊', '🔔', '💎', '💰'];
            const slots = [
                symbols[Math.floor(Math.random() * symbols.length)],
                symbols[Math.floor(Math.random() * symbols.length)],
                symbols[Math.floor(Math.random() * symbols.length)],
            ];

            const resultEmbed = new EmbedBuilder()
                .setTitle('Slot Machine')
                .setDescription(`[ ${slots.join(' | ')} ]`);

            if (slots[0] === slots[1] && slots[1] === slots[2]) {
                const winAmount = bet * 3;
                economyData[user.id].balance += winAmount;
                resultEmbed.setDescription(`[ ${slots.join(' | ')} ]\n\n**JACKPOT!** You won **${winAmount}** coins! Your new balance is ${economyData[user.id].balance}.`)
                    .setColor(0xffd700);
            } else if (slots[0] === slots[1] || slots[1] === slots[2] || slots[0] === slots[2]) {
                const winAmount = bet * 1.5;
                economyData[user.id].balance += winAmount;
                resultEmbed.setDescription(`[ ${slots.join(' | ')} ]\n\n**You won!** You won **${winAmount}** coins! Your new balance is ${economyData[user.id].balance}.`)
                    .setColor(0x2ecc71);
            } else {
                economyData[user.id].balance -= bet;
                resultEmbed.setDescription(`[ ${slots.join(' | ')} ]\n\n**You lost.** You lost **${bet}** coins. Your new balance is ${economyData[user.id].balance}.`)
                    .setColor(0xe74c3c);
            }
            await saveEconomy(economyData);
            message.reply({ embeds: [resultEmbed] });
        }
    },
    {
        name: 'fight',
        description: 'Challenge another user to a coin fight.',
        async execute(message, args) {
            const challengedUser = message.mentions.users.first();
            const bet = parseInt(args[1], 10);
            const challenger = message.author;

            if (!challengedUser || !bet || bet <= 0 || isNaN(bet)) {
                return message.reply('Please mention a user and specify a valid amount to bet.');
            }
            if (challengedUser.id === challenger.id) {
                return message.reply('You cannot fight yourself!');
            }
            if (!economyData[challenger.id] || economyData[challenger.id].balance < bet) {
                return message.reply('You do not have enough coins to make that bet.');
            }
            if (!economyData[challengedUser.id] || economyData[challengedUser.id].balance < bet) {
                return message.reply('The user you are challenging does not have enough coins.');
            }

            // Store the bet amount temporarily for the button interaction
            economyData[challenger.id].lastFightBet = bet;

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`fight_accept_${challenger.id}_${challengedUser.id}`)
                        .setLabel('Accept')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`fight_decline_${challenger.id}_${challengedUser.id}`)
                        .setLabel('Decline')
                        .setStyle(ButtonStyle.Danger),
                );

            const fightEmbed = new EmbedBuilder()
                .setTitle('Fight Challenge')
                .setDescription(`${challenger} has challenged ${challengedUser} to a fight for **${bet}** coins!`)
                .setColor(0x3498db);

            await message.reply({ content: `${challengedUser}`, embeds: [fightEmbed], components: [row] });
        }
    },
    {
        name: 'bet',
        description: 'Bet on a number between 1 and 10.',
        async execute(message, args) {
            const user = message.author;
            const betAmount = parseInt(args[0], 10);
            const betNumber = parseInt(args[1], 10);

            if (!betAmount || betAmount <= 0 || isNaN(betAmount)) {
                return message.reply('Please specify a valid bet amount.');
            }
            if (!betNumber || isNaN(betNumber) || betNumber < 1 || betNumber > 10) {
                return message.reply('Please bet on a number between 1 and 10.');
            }
            if (!economyData[user.id] || economyData[user.id].balance < betAmount) {
                return message.reply('You do not have enough coins to place that bet.');
            }

            const winningNumber = Math.floor(Math.random() * 10) + 1;
            const resultEmbed = new EmbedBuilder();

            if (betNumber === winningNumber) {
                const winnings = betAmount * 5;
                economyData[user.id].balance += winnings;
                resultEmbed.setTitle('You Won!')
                    .setDescription(`The winning number was **${winningNumber}**. You won **${winnings}** coins! Your new balance is ${economyData[user.id].balance}.`)
                    .setColor(0x2ecc71);
            } else {
                economyData[user.id].balance -= betAmount;
                resultEmbed.setTitle('You Lost!')
                    .setDescription(`The winning number was **${winningNumber}**. You lost **${betAmount}** coins. Your new balance is ${economyData[user.id].balance}.`)
                    .setColor(0xe74c3c);
            }
            await saveEconomy(economyData);
            message.reply({ embeds: [resultEmbed] });
        }
    },
    {
        name: 'pay',
        description: 'Pay another user.',
        async execute(message, args) {
            const userToPay = message.mentions.users.first();
            const amount = parseInt(args[1], 10);
            const sender = message.author;

            if (!userToPay || !amount || amount <= 0 || isNaN(amount)) {
                return message.reply('Please mention a user and specify a valid amount to pay.');
            }
            if (userToPay.id === sender.id) {
                return message.reply('You cannot pay yourself.');
            }
            if (!economyData[sender.id] || economyData[sender.id].balance < amount) {
                return message.reply('You do not have enough coins to make that payment.');
            }

            if (!economyData[userToPay.id]) {
                economyData[userToPay.id] = { balance: 0, lastDaily: 0, lastWork: 0 };
            }

            economyData[sender.id].balance -= amount;
            economyData[userToPay.id].balance += amount;

            await saveEconomy(economyData);

            const payEmbed = new EmbedBuilder()
                .setTitle('Payment Complete')
                .setDescription(`${sender} has successfully paid **${amount}** coins to ${userToPay}.`)
                .setColor(0x3498db);
            message.reply({ embeds: [payEmbed] });
        }
    }
];

// Slash Commands
const slashCommands = [
    {
        data: new SlashCommandBuilder()
            .setName('balance')
            .setDescription('Check your current balance.'),
        async execute(interaction) {
            const user = interaction.user;
            const balance = economyData[user.id] ? economyData[user.id].balance : 0;
            const embed = new EmbedBuilder()
                .setTitle(`${user.username}'s Balance`)
                .setDescription(`You currently have **${balance}** coins.`)
                .setColor(0x3498db);
            await interaction.reply({ embeds: [embed] });
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('daily')
            .setDescription('Claim your daily coins.'),
        async execute(interaction) {
            const user = interaction.user;
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            const lastDaily = economyData[user.id]?.lastDaily || 0;

            if (now - lastDaily < oneDay) {
                const timeLeft = oneDay - (now - lastDaily);
                const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
                return interaction.reply({ content: `You have already claimed your daily reward. Come back in ${hours}h ${minutes}m ${seconds}s.`, ephemeral: true });
            }

            const dailyReward = 100;
            if (!economyData[user.id]) {
                economyData[user.id] = { balance: 0, lastDaily: now, lastWork: 0 };
            }
            economyData[user.id].balance += dailyReward;
            economyData[user.id].lastDaily = now;

            await saveEconomy(economyData);
            const embed = new EmbedBuilder()
                .setTitle('Daily Reward Claimed')
                .setDescription(`You have claimed your daily reward of **${dailyReward}** coins! Your new balance is **${economyData[user.id].balance}** coins.`)
                .setColor(0x2ecc71);
            await interaction.reply({ embeds: [embed] });
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('work')
            .setDescription('Work to earn some coins.'),
        async execute(interaction) {
            const user = interaction.user;
            const now = Date.now();
            const oneHour = 60 * 60 * 1000;
            const lastWork = economyData[user.id]?.lastWork || 0;

            if (now - lastWork < oneHour) {
                const timeLeft = oneHour - (now - lastWork);
                const minutes = Math.floor(timeLeft / (1000 * 60));
                const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
                return interaction.reply({ content: `You have worked recently. Try again in ${minutes}m ${seconds}s.`, ephemeral: true });
            }

            const earnings = Math.floor(Math.random() * 50) + 1;
            if (!economyData[user.id]) {
                economyData[user.id] = { balance: 0, lastDaily: 0, lastWork: now };
            }
            economyData[user.id].balance += earnings;
            economyData[user.id].lastWork = now;

            await saveEconomy(economyData);
            const embed = new EmbedBuilder()
                .setTitle('Work Complete')
                .setDescription(`You worked hard and earned **${earnings}** coins! Your new balance is **${economyData[user.id].balance}** coins.`)
                .setColor(0xf1c40f);
            await interaction.reply({ embeds: [embed] });
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('cf')
            .setDescription('Coinflip. Bet on heads or tails.')
            .addIntegerOption(option =>
                option.setName('amount')
                    .setDescription('The amount of coins to bet.')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('choice')
                    .setDescription('Your choice of heads or tails.')
                    .setRequired(true)
                    .addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' })),
        async execute(interaction) {
            const user = interaction.user;
            const bet = interaction.options.getInteger('amount');
            const choice = interaction.options.getString('choice');

            if (!economyData[user.id] || economyData[user.id].balance < bet) {
                return interaction.reply({ content: 'You do not have enough coins to place that bet.', ephemeral: true });
            }

            const outcome = Math.random() < 0.5 ? 'heads' : 'tails';
            const resultEmbed = new EmbedBuilder();

            if (choice === outcome) {
                economyData[user.id].balance += bet;
                resultEmbed.setTitle('You Won!')
                    .setDescription(`The coin landed on **${outcome}**. You won **${bet}** coins. Your new balance is ${economyData[user.id].balance}.`)
                    .setColor(0x2ecc71);
            } else {
                economyData[user.id].balance -= bet;
                resultEmbed.setTitle('You Lost!')
                    .setDescription(`The coin landed on **${outcome}**. You lost **${bet}** coins. Your new balance is ${economyData[user.id].balance}.`)
                    .setColor(0xe74c3c);
            }
            await saveEconomy(economyData);
            await interaction.reply({ embeds: [resultEmbed] });
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('slots')
            .setDescription('Play the slot machine.')
            .addIntegerOption(option =>
                option.setName('amount')
                    .setDescription('The amount of coins to bet.')
                    .setRequired(true)),
        async execute(interaction) {
            const user = interaction.user;
            const bet = interaction.options.getInteger('amount');

            if (!economyData[user.id] || economyData[user.id].balance < bet) {
                return interaction.reply({ content: 'You do not have enough coins to place that bet.', ephemeral: true });
            }

            const symbols = ['🍒', '🍊', '🔔', '💎', '💰'];
            const slots = [
                symbols[Math.floor(Math.random() * symbols.length)],
                symbols[Math.floor(Math.random() * symbols.length)],
                symbols[Math.floor(Math.random() * symbols.length)],
            ];

            const resultEmbed = new EmbedBuilder()
                .setTitle('Slot Machine')
                .setDescription(`[ ${slots.join(' | ')} ]`);

            if (slots[0] === slots[1] && slots[1] === slots[2]) {
                const winAmount = bet * 3;
                economyData[user.id].balance += winAmount;
                resultEmbed.setDescription(`[ ${slots.join(' | ')} ]\n\n**JACKPOT!** You won **${winAmount}** coins! Your new balance is ${economyData[user.id].balance}.`)
                    .setColor(0xffd700);
            } else if (slots[0] === slots[1] || slots[1] === slots[2] || slots[0] === slots[2]) {
                const winAmount = bet * 1.5;
                economyData[user.id].balance += winAmount;
                resultEmbed.setDescription(`[ ${slots.join(' | ')} ]\n\n**You won!** You won **${winAmount}** coins! Your new balance is ${economyData[user.id].balance}.`)
                    .setColor(0x2ecc71);
            } else {
                economyData[user.id].balance -= bet;
                resultEmbed.setTitle('You Lost!')
                    .setDescription(`[ ${slots.join(' | ')} ]\n\n**You lost.** You lost **${bet}** coins. Your new balance is ${economyData[user.id].balance}.`)
                    .setColor(0xe74c3c);
            }
            await saveEconomy(economyData);
            await interaction.reply({ embeds: [resultEmbed] });
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('bet')
            .setDescription('Bet on a number between 1 and 10.')
            .addIntegerOption(option =>
                option.setName('amount')
                    .setDescription('The amount of coins to bet.')
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('number')
                    .setDescription('The number to bet on.')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(10)),
        async execute(interaction) {
            const user = interaction.user;
            const betAmount = interaction.options.getInteger('amount');
            const betNumber = interaction.options.getInteger('number');

            if (!economyData[user.id] || economyData[user.id].balance < betAmount) {
                return interaction.reply({ content: 'You do not have enough coins to place that bet.', ephemeral: true });
            }

            const winningNumber = Math.floor(Math.random() * 10) + 1;
            const resultEmbed = new EmbedBuilder();

            if (betNumber === winningNumber) {
                const winnings = betAmount * 5;
                economyData[user.id].balance += winnings;
                resultEmbed.setTitle('You Won!')
                    .setDescription(`The winning number was **${winningNumber}**. You won **${winnings}** coins! Your new balance is ${economyData[user.id].balance}.`)
                    .setColor(0x2ecc71);
            } else {
                economyData[user.id].balance -= betAmount;
                resultEmbed.setTitle('You Lost!')
                    .setDescription(`The winning number was **${winningNumber}**. You lost **${betAmount}** coins. Your new balance is ${economyData[user.id].balance}.`)
                    .setColor(0xe74c3c);
            }
            await saveEconomy(economyData);
            await interaction.reply({ embeds: [resultEmbed] });
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('pay')
            .setDescription('Pay another user.')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('The user to pay.')
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('amount')
                    .setDescription('The amount to pay.')
                    .setRequired(true)),
        async execute(interaction) {
            const userToPay = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');
            const sender = interaction.user;

            if (userToPay.id === sender.id) {
                return interaction.reply({ content: 'You cannot pay yourself.', ephemeral: true });
            }
            if (!economyData[sender.id] || economyData[sender.id].balance < amount) {
                return interaction.reply({ content: 'You do not have enough coins to make that payment.', ephemeral: true });
            }

            if (!economyData[userToPay.id]) {
                economyData[userToPay.id] = { balance: 0, lastDaily: 0, lastWork: 0 };
            }

            economyData[sender.id].balance -= amount;
            economyData[userToPay.id].balance += amount;

            await saveEconomy(economyData);

            const payEmbed = new EmbedBuilder()
                .setTitle('Payment Complete')
                .setDescription(`${sender} has successfully paid **${amount}** coins to ${userToPay}.`)
                .setColor(0x3498db);
            await interaction.reply({ embeds: [payEmbed] });
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('fight')
            .setDescription('Challenge another user to a coin fight.')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('The user to challenge.')
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('amount')
                    .setDescription('The amount of coins to bet.')
                    .setRequired(true)),
        async execute(interaction) {
            const challengedUser = interaction.options.getUser('user');
            const bet = interaction.options.getInteger('amount');
            const challenger = interaction.user;

            if (challengedUser.id === challenger.id) {
                return interaction.reply({ content: 'You cannot fight yourself!', ephemeral: true });
            }
            if (!economyData[challenger.id] || economyData[challenger.id].balance < bet) {
                return interaction.reply({ content: 'You do not have enough coins to make that bet.', ephemeral: true });
            }
            if (!economyData[challengedUser.id] || economyData[challengedUser.id].balance < bet) {
                return interaction.reply({ content: 'The user you are challenging does not have enough coins.', ephemeral: true });
            }

            economyData[challenger.id].lastFightBet = bet;

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`fight_accept_${challenger.id}_${challengedUser.id}`)
                        .setLabel('Accept')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`fight_decline_${challenger.id}_${challengedUser.id}`)
                        .setLabel('Decline')
                        .setStyle(ButtonStyle.Danger),
                );

            const fightEmbed = new EmbedBuilder()
                .setTitle('Fight Challenge')
                .setDescription(`${challenger} has challenged ${challengedUser} to a fight for **${bet}** coins!`)
                .setColor(0x3498db);

            await interaction.reply({ content: `${challengedUser}`, embeds: [fightEmbed], components: [row] });
        }
    },
];

module.exports = {
    loadEconomy,
    saveEconomy,
    legacyCommands,
    slashCommands,
};
