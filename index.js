const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ID da categoria dos tickets
const CATEGORIA_TICKET = "1547879820048990358";

client.once("ready", () => {
  console.log(`🤖 Automet online como ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ticket") {
    const guild = interaction.guild;
    const user = interaction.user;

    // Verifica se já existe ticket do usuário
    const ticketExistente = guild.channels.cache.find(
      channel =>
        channel.type === ChannelType.GuildText &&
        channel.topic === `ticket-${user.id}`
    );

    if (ticketExistente) {
      return interaction.reply({
        content: `❌ Você já possui um ticket aberto: ${ticketExistente}`,
        ephemeral: true
      });
    }

    try {
      const canal = await guild.channels.create({
        name: `ticket-${user.username}`.toLowerCase(),
        type: ChannelType.GuildText,
        parent: CATEGORIA_TICKET,
        topic: `ticket-${user.id}`,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          },
          {
            id: client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels
            ]
          }
        ]
      });

      await canal.send(
        `🎫 **Ticket criado!**\n\n` +
        `👤 **Cliente:** ${user}\n` +
        `📋 Explique o que você precisa e aguarde o atendimento.`
      );

      await interaction.reply({
        content: `✅ Seu ticket foi criado: ${canal}`,
        ephemeral: true
      });

    } catch (erro) {
      console.error(erro);

      await interaction.reply({
        content:
          "❌ Não consegui criar o ticket. Verifique as permissões do bot e o ID da categoria.",
        ephemeral: true
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
