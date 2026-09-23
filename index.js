const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const CATEGORIA_TICKET = "1547879820048990358";

client.once("clientReady", async () => {
  console.log(`🤖 Automet online como ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    try {
      await guild.commands.create({
        name: "ticket",
        description: "Cria um ticket de atendimento"
      });

      await guild.commands.create({
        name: "painel",
        description: "Abre o painel de configuração do Automet"
      });

      console.log(`✅ Comandos registrados em: ${guild.name}`);
    } catch (erro) {
      console.error(erro);
    }
  }
});

client.on("interactionCreate", async (interaction) => {

  // =========================
  // COMANDO /PAINEL
  // =========================

  if (interaction.isChatInputCommand() && interaction.commandName === "painel") {

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: "❌ Apenas administradores podem usar o painel.",
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("⚙️ Painel do Automet")
      .setDescription(
        "**Configurações disponíveis:**\n\n" +
        "🎫 Sistema de tickets\n" +
        "📁 Categoria dos tickets\n" +
        "👤 Cargo da equipe/ADM\n" +
        "📝 Mensagem do ticket\n" +
        "🎨 Cor do painel\n" +
        "🔘 Botão Abrir Ticket\n" +
        "🗑️ Fechar ticket\n" +
        "📋 Mensagem de atendimento"
      )
      .setColor(0x7A00FF);

    const linha1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("config_ticket")
        .setLabel("Tickets")
        .setEmoji("🎫")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("config_categoria")
        .setLabel("Categoria")
        .setEmoji("📁")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("config_cargo")
        .setLabel("Cargo ADM")
        .setEmoji("👤")
        .setStyle(ButtonStyle.Secondary)
    );

    const linha2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("config_mensagem")
        .setLabel("Mensagem")
        .setEmoji("📝")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("config_cor")
        .setLabel("Cor")
        .setEmoji("🎨")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("config_botao")
        .setLabel("Botão")
        .setEmoji("🔘")
        .setStyle(ButtonStyle.Secondary)
    );

    const linha3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("fechar_ticket")
        .setLabel("Fechar Ticket")
        .setEmoji("🗑️")
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId("mensagem_atendimento")
        .setLabel("Atendimento")
        .setEmoji("📋")
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [embed],
      components: [linha1, linha2, linha3],
      ephemeral: true
    });

    return;
  }

  // =========================
  // COMANDO /TICKET
  // =========================

  if (interaction.isChatInputCommand() && interaction.commandName === "ticket") {

    const guild = interaction.guild;
    const user = interaction.user;

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
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageChannels
            ]
          }
        ]
      });

      const fechar = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("fechar_ticket")
          .setLabel("Fechar Ticket")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger)
      );

      await canal.send({
        content:
          `🎫 **Ticket criado!**\n\n` +
          `👤 **Cliente:** ${user}\n\n` +
          `📋 Explique o que você precisa e aguarde o atendimento.`,
        components: [fechar]
      });

      await interaction.reply({
        content: `✅ Seu ticket foi criado: ${canal}`,
        ephemeral: true
      });

    } catch (erro) {

      console.error(erro);

      if (!interaction.replied) {
        await interaction.reply({
          content:
            "❌ Não consegui criar o ticket. Verifique as permissões do bot e o ID da categoria.",
          ephemeral: true
        });
      }
    }

    return;
  }

  // =========================
  // BOTÕES
  // =========================

  if (interaction.isButton()) {

    if (
      interaction.customId === "config_ticket" ||
      interaction.customId === "config_categoria" ||
      interaction.customId === "config_cargo" ||
      interaction.customId === "config_mensagem" ||
      interaction.customId === "config_cor" ||
      interaction.customId === "config_botao" ||
      interaction.customId === "mensagem_atendimento"
    ) {

      return interaction.reply({
        content:
          `⚙️ **${interaction.component.label}**\n\n` +
          `Essa configuração será adicionada na próxima etapa do painel.`,
        ephemeral: true
      });
    }

    if (interaction.customId === "fechar_ticket") {

      if (!interaction.channel.name.startsWith("ticket-")) {
        return interaction.reply({
          content: "❌ Este canal não é um ticket.",
          ephemeral: true
        });
      }

      await interaction.reply({
        content: "🔒 Fechando o ticket...",
        ephemeral: true
      });

      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch (erro) {
          console.error(erro);
        }
      }, 2000);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
