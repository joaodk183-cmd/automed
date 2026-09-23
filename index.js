const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// =========================
// CONFIGURAÇÃO PADRÃO
// =========================

let config = {
  ticketsAtivos: true,
  categoria: "1547879820048990358",
  cargoADM: "",
  mensagemTicket:
    "🎫 **Ticket criado!**\n\n👤 **Cliente:** {usuario}\n\n📋 Explique o que você precisa e aguarde o atendimento.",
  cor: "#7A00FF",
  nomeBotao: "Abrir Ticket",
  mensagemAtendimento:
    "📋 **Atendimento**\n\nExplique o que você precisa e aguarde um membro da equipe."
};

// =========================
// BOT ONLINE
// =========================

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

// =========================
// INTERAÇÕES
// =========================

client.on("interactionCreate", async (interaction) => {

  // =========================
  // /PAINEL
  // =========================

  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === "painel"
  ) {

    if (
      !interaction.member.permissions.has(
        PermissionFlagsBits.Administrator
      )
    ) {
      return interaction.reply({
        content: "❌ Apenas administradores podem usar o painel.",
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("⚙️ Painel do Automet")
      .setDescription(
        "Configure o sistema de atendimento abaixo.\n\n" +
        `🎫 **Tickets:** ${
          config.ticketsAtivos ? "🟢 Ativos" : "🔴 Desativados"
        }\n` +
        `📁 **Categoria:** ${
          config.categoria
            ? `<#${config.categoria}>`
            : "Não configurada"
        }\n` +
        `👤 **Cargo ADM:** ${
          config.cargoADM
            ? `<@&${config.cargoADM}>`
            : "Não configurado"
        }\n` +
        `🎨 **Cor:** ${config.cor}\n` +
        `🔘 **Botão:** ${config.nomeBotao}`
      )
      .setColor(config.cor);

    const linha1 = new ActionRowBuilder().addComponents(

      new ButtonBuilder()
        .setCustomId("config_ticket")
        .setLabel("Tickets")
        .setEmoji("🎫")
        .setStyle(
          config.ticketsAtivos
            ? ButtonStyle.Success
            : ButtonStyle.Danger
        ),

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
        .setCustomId("config_fechamento")
        .setLabel("Fechar Ticket")
        .setEmoji("🗑️")
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId("config_atendimento")
        .setLabel("Atendimento")
        .setEmoji("📋")
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({
      embeds: [embed],
      components: [linha1, linha2, linha3],
      ephemeral: true
    });
  }

  // =========================
  // /TICKET
  // =========================

  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === "ticket"
  ) {

    if (!config.ticketsAtivos) {
      return interaction.reply({
        content: "❌ O sistema de tickets está desativado.",
        ephemeral: true
      });
    }

    const guild = interaction.guild;
    const user = interaction.user;

    const ticketExistente = guild.channels.cache.find(
      channel =>
        channel.type === ChannelType.GuildText &&
        channel.topic === `ticket-${user.id}`
    );

    if (ticketExistente) {
      return interaction.reply({
        content:
          `❌ Você já possui um ticket aberto: ${ticketExistente}`,
        ephemeral: true
      });
    }

    try {

      const permissoes = [
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
      ];

      // Adiciona o cargo ADM se estiver configurado
      if (config.cargoADM) {
        permissoes.push({
          id: config.cargoADM,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        });
      }

      const canal = await guild.channels.create({
        name: `ticket-${user.username}`.toLowerCase(),
        type: ChannelType.GuildText,
        parent: config.categoria,
        topic: `ticket-${user.id}`,
        permissionOverwrites: permissoes
      });

      const fechar = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("fechar_ticket")
          .setLabel("Fechar Ticket")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger)
      );

      const mensagem = config.mensagemTicket
        .replaceAll("{usuario}", `${user}`)
        .replaceAll("{nome}", user.username);

      await canal.send({
        content: mensagem,
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
            "❌ Não consegui criar o ticket. Verifique as permissões do bot e a categoria configurada.",
          ephemeral: true
        });
      }
    }

    return;
  }

  // =========================
  // BOTÕES DO PAINEL
  // =========================

  if (interaction.isButton()) {

    // ATIVAR / DESATIVAR TICKETS
    if (interaction.customId === "config_ticket") {

      config.ticketsAtivos = !config.ticketsAtivos;

      return interaction.reply({
        content:
          config.ticketsAtivos
            ? "🟢 Sistema de tickets **ativado**."
            : "🔴 Sistema de tickets **desativado**.",
        ephemeral: true
      });
    }

    // CATEGORIA
    if (interaction.customId === "config_categoria") {

      const modal = new ModalBuilder()
        .setCustomId("modal_categoria")
        .setTitle("📁 Configurar categoria");

      const campo = new TextInputBuilder()
        .setCustomId("categoria_id")
        .setLabel("ID da categoria")
        .setPlaceholder("Ex: 1547879820048990358")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(config.categoria);

      modal.addComponents(
        new ActionRowBuilder().addComponents(campo)
      );

      return interaction.showModal(modal);
    }

    // CARGO ADM
    if (interaction.customId === "config_cargo") {

      const modal = new ModalBuilder()
        .setCustomId("modal_cargo")
        .setTitle("👤 Configurar cargo ADM");

      const campo = new TextInputBuilder()
        .setCustomId("cargo_id")
        .setLabel("ID do cargo ADM")
        .setPlaceholder("Cole o ID do cargo")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(config.cargoADM || "");

      modal.addComponents(
        new ActionRowBuilder().addComponents(campo)
      );

      return interaction.showModal(modal);
    }

    // MENSAGEM DO TICKET
    if (interaction.customId === "config_mensagem") {

      const modal = new ModalBuilder()
        .setCustomId("modal_mensagem")
        .setTitle("📝 Mensagem do ticket");

      const campo = new TextInputBuilder()
        .setCustomId("mensagem")
        .setLabel("Mensagem")
        .setPlaceholder("Use {usuario} para mencionar o cliente")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setValue(config.mensagemTicket);

      modal.addComponents(
        new ActionRowBuilder().addComponents(campo)
      );

      return interaction.showModal(modal);
    }

    // COR
    if (interaction.customId === "config_cor") {

      const modal = new ModalBuilder()
        .setCustomId("modal_cor")
        .setTitle("🎨 Configurar cor");

      const campo = new TextInputBuilder()
        .setCustomId("cor")
        .setLabel("Cor HEX")
        .setPlaceholder("#7A00FF")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(config.cor);

      modal.addComponents(
        new ActionRowBuilder().addComponents(campo)
      );

      return interaction.showModal(modal);
    }

    // BOTÃO
    if (interaction.customId === "config_botao") {

      const modal = new ModalBuilder()
        .setCustomId("modal_botao")
        .setTitle("🔘 Nome do botão");

      const campo = new TextInputBuilder()
        .setCustomId("nome_botao")
        .setLabel("Nome do botão")
        .setPlaceholder("Ex: Abrir Ticket")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(config.nomeBotao);

      modal.addComponents(
        new ActionRowBuilder().addComponents(campo)
      );

      return interaction.showModal(modal);
    }

    // FECHAMENTO
    if (interaction.customId === "config_fechamento") {

      return interaction.reply({
        content:
          "🗑️ **Fechamento de tickets**\n\n" +
          "O botão 🔒 **Fechar Ticket** já é adicionado automaticamente aos tickets.",
        ephemeral: true
      });
    }

    // ATENDIMENTO
    if (interaction.customId === "config_atendimento") {

      const modal = new ModalBuilder()
        .setCustomId("modal_atendimento")
        .setTitle("📋 Mensagem de atendimento");

      const campo = new TextInputBuilder()
        .setCustomId("atendimento")
        .setLabel("Mensagem")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setValue(config.mensagemAtendimento);

      modal.addComponents(
        new ActionRowBuilder().addComponents(campo)
      );

      return interaction.showModal(modal);
    }

    // =========================
    // FECHAR TICKET
    // =========================

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

      return;
    }
  }

  // =========================
  // MODAIS
  // =========================

  if (interaction.isModalSubmit()) {

    // CATEGORIA
    if (interaction.customId === "modal_categoria") {

      config.categoria =
        interaction.fields.getTextInputValue("categoria_id").trim();

      return interaction.reply({
        content:
          `✅ Categoria configurada!\n\n📁 <#${config.categoria}>`,
        ephemeral: true
      });
    }

    // CARGO
    if (interaction.customId === "modal_cargo") {

      config.cargoADM =
        interaction.fields.getTextInputValue("cargo_id").trim();

      return interaction.reply({
        content:
          `✅ Cargo ADM configurado!\n\n👤 <@&${config.cargoADM}>`,
        ephemeral: true
      });
    }

    // MENSAGEM
    if (interaction.customId === "modal_mensagem") {

      config.mensagemTicket =
        interaction.fields.getTextInputValue("mensagem");

      return interaction.reply({
        content: "✅ Mensagem do ticket atualizada!",
        ephemeral: true
      });
    }

    // COR
    if (interaction.customId === "modal_cor") {

      const novaCor =
        interaction.fields.getTextInputValue("cor").trim();

      if (!/^#[0-9A-Fa-f]{6}$/.test(novaCor)) {
        return interaction.reply({
          content:
            "❌ Cor inválida. Use o formato `#7A00FF`.",
          ephemeral: true
        });
      }

      config.cor = novaCor;

      return interaction.reply({
        content: `✅ Cor alterada para **${novaCor}**.`,
        ephemeral: true
      });
    }

    // BOTÃO
    if (interaction.customId === "modal_botao") {

      config.nomeBotao =
        interaction.fields.getTextInputValue("nome_botao").trim();

      return interaction.reply({
        content:
          `✅ Nome do botão alterado para **${config.nomeBotao}**.`,
        ephemeral: true
      });
    }

    // ATENDIMENTO
    if (interaction.customId === "modal_atendimento") {

      config.mensagemAtendimento =
        interaction.fields.getTextInputValue("atendimento");

      return interaction.reply({
        content: "✅ Mensagem de atendimento atualizada!",
        ephemeral: true
      });
    }
  }
});

// =========================
// LOGIN
// =========================

client.login(process.env.DISCORD_TOKEN);
