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

const express = require("express");
const fs = require("fs");
const path = require("path");

// =========================
// DISCORD
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// =========================
// SERVIDOR WEBHOOK
// =========================

const app = express();

app.use(express.json());

const WEBHOOK_PORT = process.env.PORT || 3000;

// =========================
// ARQUIVOS
// =========================

const CONFIG_FILE = path.join(__dirname, "config.json");
const PAGAMENTOS_FILE = path.join(__dirname, "pagamentos.json");

// =========================
// CONFIGURAÇÃO PADRÃO
// =========================

const configPadrao = {
  ticketsAtivos: true,

  categoria: "1547879820048990358",

  cargoADM: "",

  mensagemTicket:
    "🎫 **Ticket criado!**\n\n👤 **Cliente:** {usuario}\n\n📋 Explique o que você precisa e aguarde o atendimento.",

  cor: "#7A00FF",

  nomeBotao: "Abrir Ticket",

  mensagemAtendimento:
    "📋 **Atendimento**\n\nExplique o que você precisa e aguarde um membro da equipe.",

  pagamentosAtivos: true,

  webhookAtivo: true,

  portaWebhook: 3000
};

// =========================
// CARREGAR CONFIG
// =========================

function carregarConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      fs.writeFileSync(
        CONFIG_FILE,
        JSON.stringify(configPadrao, null, 2),
        "utf8"
      );

      return { ...configPadrao };
    }

    const arquivo = fs.readFileSync(CONFIG_FILE, "utf8");

    const configSalva = JSON.parse(arquivo);

    return {
      ...configPadrao,
      ...configSalva
    };
  } catch (erro) {
    console.error("❌ Erro ao carregar config.json:", erro);

    return { ...configPadrao };
  }
}

// =========================
// SALVAR CONFIG
// =========================

function salvarConfig() {
  try {
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify(config, null, 2),
      "utf8"
    );

    console.log("💾 Configuração salva.");
  } catch (erro) {
    console.error("❌ Erro ao salvar config.json:", erro);
  }
}

let config = carregarConfig();

// =========================
// PAGAMENTOS
// =========================

function carregarPagamentos() {
  try {
    if (!fs.existsSync(PAGAMENTOS_FILE)) {
      fs.writeFileSync(
        PAGAMENTOS_FILE,
        JSON.stringify({}, null, 2),
        "utf8"
      );

      return {};
    }

    const arquivo = fs.readFileSync(
      PAGAMENTOS_FILE,
      "utf8"
    );

    return JSON.parse(arquivo);
  } catch (erro) {
    console.error(
      "❌ Erro ao carregar pagamentos.json:",
      erro
    );

    return {};
  }
}

function salvarPagamentos() {
  try {
    fs.writeFileSync(
      PAGAMENTOS_FILE,
      JSON.stringify(pagamentos, null, 2),
      "utf8"
    );
  } catch (erro) {
    console.error(
      "❌ Erro ao salvar pagamentos:",
      erro
    );
  }
}

let pagamentos = carregarPagamentos();

// =========================
// GERAR ID DO PAGAMENTO
// =========================

function gerarIdPagamento() {
  return (
    "PAY-" +
    Date.now().toString(36).toUpperCase() +
    "-" +
    Math.random()
      .toString(36)
      .substring(2, 7)
      .toUpperCase()
  );
}

// =========================
// FORMATAR VALOR
// =========================

function formatarValor(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

// =========================
// CRIAR PAGAMENTO
// =========================

function criarPagamento({
  guildId,
  canalId,
  pagadorId,
  recebedorId,
  valor
}) {
  const id = gerarIdPagamento();

  pagamentos[id] = {
    id,

    guildId,

    canalId,

    pagadorId,

    recebedorId,

    valor: Number(valor),

    status: "PENDENTE",

    pagamentoConfirmado: false,

    pagadorConfirmou: false,

    recebedorConfirmou: false,

    criadoEm: new Date().toISOString(),

    confirmadoEm: null,

    provedor: null,

    transacaoId: null
  };

  salvarPagamentos();

  return pagamentos[id];
}

// =========================
// ATUALIZAR PAGAMENTO
// =========================

function atualizarPagamento(id, dados) {
  if (!pagamentos[id]) {
    return null;
  }

  pagamentos[id] = {
    ...pagamentos[id],
    ...dados
  };

  salvarPagamentos();

  return pagamentos[id];
}

// =========================
// VERIFICAR SE PODE FINALIZAR
// =========================

function verificarPagamentoFinalizado(id) {
  const pagamento = pagamentos[id];

  if (!pagamento) {
    return false;
  }

  if (
    pagamento.pagamentoConfirmado &&
    pagamento.pagadorConfirmou &&
    pagamento.recebedorConfirmou
  ) {
    pagamentos[id].status = "FINALIZADO";

    pagamentos[id].confirmadoEm =
      pagamentos[id].confirmadoEm ||
      new Date().toISOString();

    salvarPagamentos();

    return true;
  }

  return false;
}

// =========================
// ENVIAR ATUALIZAÇÃO NO DISCORD
// =========================

async function atualizarMensagemPagamento(id) {
  const pagamento = pagamentos[id];

  if (!pagamento) {
    return;
  }

  try {
    const guild =
      client.guilds.cache.get(
        pagamento.guildId
      );

    if (!guild) {
      return;
    }

    const canal =
      guild.channels.cache.get(
        pagamento.canalId
      );

    if (!canal) {
      return;
    }

    let statusPagamento;

    if (
      pagamento.status === "FINALIZADO"
    ) {
      statusPagamento =
        "🟢 **PAGAMENTO FINALIZADO**";
    } else if (
      pagamento.pagamentoConfirmado
    ) {
      statusPagamento =
        "🟡 **PAGAMENTO CONFIRMADO — AGUARDANDO CONFIRMAÇÕES**";
    } else {
      statusPagamento =
        "🟠 **AGUARDANDO CONFIRMAÇÃO DO PAGAMENTO**";
    }

    const embed =
      new EmbedBuilder()
        .setTitle("💰 Pagamento")
        .setColor(config.cor)
        .setDescription(
          `🆔 **ID:** \`${pagamento.id}\`\n\n` +

          `💵 **Valor:** ${formatarValor(
            pagamento.valor
          )}\n\n` +

          `📤 **Pagador:** <@${pagamento.pagadorId}>\n` +

          `📥 **Recebedor:** <@${pagamento.recebedorId}>\n\n` +

          `${statusPagamento}\n\n` +

          `📤 Pagador: ${
            pagamento.pagadorConfirmou
              ? "✅ Confirmou"
              : "⏳ Aguardando"
          }\n` +

          `📥 Recebedor: ${
            pagamento.recebedorConfirmou
              ? "✅ Confirmou"
              : "⏳ Aguardando"
          }`
        )
        .setFooter({
          text:
            "Automet • Sistema de pagamentos"
        });

    const botoes =
      new ActionRowBuilder().addComponents(

        new ButtonBuilder()
          .setCustomId(
            `pagamento_paguei_${id}`
          )
          .setLabel("Paguei")
          .setEmoji("📤")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId(
            `pagamento_recebi_${id}`
          )
          .setLabel("Recebi")
          .setEmoji("📥")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId(
            `pagamento_info_${id}`
          )
          .setLabel("Informações")
          .setEmoji("ℹ️")
          .setStyle(ButtonStyle.Secondary)
      );

    await canal.send({
      embeds: [embed],
      components: [botoes]
    });

  } catch (erro) {
    console.error(
      "❌ Erro ao atualizar pagamento:",
      erro
    );
  }
}

// =========================
// BOT ONLINE
// =========================

client.once("clientReady", async () => {

  console.log(
    `🤖 Automet online como ${client.user.tag}`
  );

  for (
    const guild of client.guilds.cache.values()
  ) {

    try {

      await guild.commands.create({
        name: "ticket",
        description:
          "Cria um ticket de atendimento"
      });

      await guild.commands.create({
        name: "painel",
        description:
          "Abre o painel de configuração do Automet"
      });

      await guild.commands.create({
        name: "pagamento",
        description:
          "Cria uma solicitação de pagamento"
      });

      console.log(
        `✅ Comandos registrados em: ${guild.name}`
      );

    } catch (erro) {

      console.error(
        "❌ Erro ao registrar comandos:",
        erro
      );
    }
  }
});

// =========================
// INTERAÇÕES
// =========================

client.on(
  "interactionCreate",
  async (interaction) => {

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
          content:
            "❌ Apenas administradores podem usar o painel.",
          ephemeral: true
        });
      }

      const embed =
        new EmbedBuilder()
          .setTitle("⚙️ Painel do Automet")
          .setDescription(

            "Configure o sistema abaixo.\n\n" +

            `🎫 **Tickets:** ${
              config.ticketsAtivos
                ? "🟢 Ativos"
                : "🔴 Desativados"
            }\n` +

            `💰 **Pagamentos:** ${
              config.pagamentosAtivos
                ? "🟢 Ativos"
                : "🔴 Desativados"
            }\n` +

            `📡 **Webhook:** ${
              config.webhookAtivo
                ? "🟢 Ativo"
                : "🔴 Desativado"
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

      const linha1 =
        new ActionRowBuilder()
          .addComponents(

            new ButtonBuilder()
              .setCustomId(
                "config_ticket"
              )
              .setLabel("Tickets")
              .setEmoji("🎫")
              .setStyle(
                config.ticketsAtivos
                  ? ButtonStyle.Success
                  : ButtonStyle.Danger
              ),

            new ButtonBuilder()
              .setCustomId(
                "config_categoria"
              )
              .setLabel("Categoria")
              .setEmoji("📁")
              .setStyle(
                ButtonStyle.Secondary
              ),

            new ButtonBuilder()
              .setCustomId(
                "config_cargo"
              )
              .setLabel("Cargo ADM")
              .setEmoji("👤")
              .setStyle(
                ButtonStyle.Secondary
              )
          );

      const linha2 =
        new ActionRowBuilder()
          .addComponents(

            new ButtonBuilder()
              .setCustomId(
                "config_mensagem"
              )
              .setLabel("Mensagem")
              .setEmoji("📝")
              .setStyle(
                ButtonStyle.Secondary
              ),

            new ButtonBuilder()
              .setCustomId(
                "config_cor"
              )
              .setLabel("Cor")
              .setEmoji("🎨")
              .setStyle(
                ButtonStyle.Secondary
              ),

            new ButtonBuilder()
              .setCustomId(
                "config_botao"
              )
              .setLabel("Botão")
              .setEmoji("🔘")
              .setStyle(
                ButtonStyle.Secondary
              )
          );

      const linha3 =
        new ActionRowBuilder()
          .addComponents(

            new ButtonBuilder()
              .setCustomId(
                "config_fechamento"
              )
              .setLabel(
                "Fechar Ticket"
              )
              .setEmoji("🗑️")
              .setStyle(
                ButtonStyle.Danger
              ),

            new ButtonBuilder()
              .setCustomId(
                "config_atendimento"
              )
              .setLabel(
                "Atendimento"
              )
              .setEmoji("📋")
              .setStyle(
                ButtonStyle.Secondary
              )
          );

      const linha4 =
        new ActionRowBuilder()
          .addComponents(

            new ButtonBuilder()
              .setCustomId(
                "config_pagamentos"
              )
              .setLabel(
                "Pagamentos"
              )
              .setEmoji("💰")
              .setStyle(
                config.pagamentosAtivos
                  ? ButtonStyle.Success
                  : ButtonStyle.Danger
              ),

            new ButtonBuilder()
              .setCustomId(
                "config_webhook"
              )
              .setLabel(
                "Webhook"
              )
              .setEmoji("📡")
              .setStyle(
                config.webhookAtivo
                  ? ButtonStyle.Success
                  : ButtonStyle.Danger
              )
          );

      return interaction.reply({
        embeds: [embed],
        components: [
          linha1,
          linha2,
          linha3,
          linha4
        ],
        ephemeral: true
      });
    }

    // =========================
    // /PAGAMENTO
    // =========================

    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "pagamento"
    ) {

      if (!config.pagamentosAtivos) {

        return interaction.reply({
          content:
            "❌ O sistema de pagamentos está desativado.",
          ephemeral: true
        });
      }

      if (
        !interaction.channel ||
        interaction.channel.parentId !== config.categoria
      ) {

        return interaction.reply({
          content:
            "❌ Use o comando `/pagamento` dentro de um ticket.",
          ephemeral: true
        });
      }

      const modal =
        new ModalBuilder()
          .setCustomId(
            "modal_pagamento"
          )
          .setTitle(
            "💰 Criar pagamento"
          );

      const recebedor =
        new TextInputBuilder()
          .setCustomId(
            "recebedor_id"
          )
          .setLabel(
            "ID do jogador que vai receber"
          )
          .setPlaceholder(
            "Ex: 123456789012345678"
          )
          .setStyle(
            TextInputStyle.Short
          )
          .setRequired(true);

      const valor =
        new TextInputBuilder()
          .setCustomId(
            "valor"
          )
          .setLabel(
            "Valor em reais"
          )
          .setPlaceholder(
            "Ex: 20.00"
          )
          .setStyle(
            TextInputStyle.Short
          )
          .setRequired(true);

      modal.addComponents(

        new ActionRowBuilder()
          .addComponents(recebedor),

        new ActionRowBuilder()
          .addComponents(valor)
      );

      return interaction.showModal(
        modal
      );
    }

    // =========================
    // BOTÕES
    // =========================

    if (interaction.isButton()) {

      // =========================
      // PAGAMENTO - PAGUEI
      // =========================

      if (
        interaction.customId.startsWith(
          "pagamento_paguei_"
        )
      ) {

        const id =
          interaction.customId.replace(
            "pagamento_paguei_",
            ""
          );

        const pagamento =
          pagamentos[id];

        if (!pagamento) {

          return interaction.reply({
            content:
              "❌ Pagamento não encontrado.",
            ephemeral: true
          });
        }

        if (
          interaction.user.id !==
          pagamento.pagadorId
        ) {

          return interaction.reply({
            content:
              "❌ Apenas o pagador pode confirmar que realizou o pagamento.",
            ephemeral: true
          });
        }

        if (
          pagamento.pagadorConfirmou
        ) {

          return interaction.reply({
            content:
              "⚠️ Você já confirmou este pagamento.",
            ephemeral: true
          });
        }

        atualizarPagamento(
          id,
          {
            pagadorConfirmou:
              true
          }
        );

        verificarPagamentoFinalizado(
          id
        );

        await interaction.reply({
          content:
            "✅ Você confirmou que realizou o pagamento.",
          ephemeral: true
        });

        return;
      }

      // =========================
      // PAGAMENTO - RECEBI
      // =========================

      if (
        interaction.customId.startsWith(
          "pagamento_recebi_"
        )
      ) {

        const id =
          interaction.customId.replace(
            "pagamento_recebi_",
            ""
          );

        const pagamento =
          pagamentos[id];

        if (!pagamento) {

          return interaction.reply({
            content:
              "❌ Pagamento não encontrado.",
            ephemeral: true
          });
        }

        if (
          interaction.user.id !==
          pagamento.recebedorId
        ) {

          return interaction.reply({
            content:
              "❌ Apenas o recebedor pode confirmar o recebimento.",
            ephemeral: true
          });
        }

        if (
          !pagamento.pagamentoConfirmado
        ) {

          return interaction.reply({
            content:
              "⏳ O pagamento ainda não foi confirmado pelo sistema.",
            ephemeral: true
          });
        }

        if (
          pagamento.recebedorConfirmou
        ) {

          return interaction.reply({
            content:
              "⚠️ Você já confirmou o recebimento.",
            ephemeral: true
          });
        }

        atualizarPagamento(
          id,
          {
            recebedorConfirmou:
              true
          }
        );

        const finalizado =
          verificarPagamentoFinalizado(
            id
          );

        await interaction.reply({
          content:
            finalizado
              ? "🎉 Pagamento finalizado! Os dois lados confirmaram."
              : "✅ Recebimento confirmado.",
          ephemeral: true
        });

        return;
      }

      // =========================
      // PAGAMENTO - INFO
      // =========================

      if (
        interaction.customId.startsWith(
          "pagamento_info_"
        )
      ) {

        const id =
          interaction.customId.replace(
            "pagamento_info_",
            ""
          );

        const pagamento =
          pagamentos[id];

        if (!pagamento) {

          return interaction.reply({
            content:
              "❌ Pagamento não encontrado.",
            ephemeral: true
          });
        }

        return interaction.reply({
          content:

            `💰 **Informações do pagamento**\n\n` +

            `🆔 ID: \`${pagamento.id}\`\n` +

            `💵 Valor: **${formatarValor(
              pagamento.valor
            )}**\n` +

            `📤 Pagador: <@${pagamento.pagadorId}>\n` +

            `📥 Recebedor: <@${pagamento.recebedorId}>\n\n` +

            `📡 Pagamento: ${
              pagamento.pagamentoConfirmado
                ? "✅ Confirmado"
                : "⏳ Pendente"
            }\n` +

            `📤 Pagador: ${
              pagamento.pagadorConfirmou
                ? "✅"
                : "⏳"
            }\n` +

            `📥 Recebedor: ${
              pagamento.recebedorConfirmou
                ? "✅"
                : "⏳"
            }`,

          ephemeral: true
        });
      }

      // =========================
      // CONFIG PAGAMENTOS
      // =========================

      if (
        interaction.customId ===
        "config_pagamentos"
      ) {

        config.pagamentosAtivos =
          !config.pagamentosAtivos;

        salvarConfig();

        return interaction.reply({
          content:
            config.pagamentosAtivos
              ? "🟢 Sistema de pagamentos ativado."
              : "🔴 Sistema de pagamentos desativado.",
          ephemeral: true
        });
      }

      // =========================
      // CONFIG WEBHOOK
      // =========================

      if (
        interaction.customId ===
        "config_webhook"
      ) {

        config.webhookAtivo =
          !config.webhookAtivo;

        salvarConfig();

        return interaction.reply({
          content:
            config.webhookAtivo
              ? "🟢 Webhook de pagamentos ativado."
              : "🔴 Webhook de pagamentos desativado.",
          ephemeral: true
        });
      }

      // =========================
      // TICKETS
      // =========================

      if (
        interaction.customId ===
        "config_ticket"
      ) {

        config.ticketsAtivos =
          !config.ticketsAtivos;

        salvarConfig();

        return interaction.reply({
          content:
            config.ticketsAtivos
              ? "🟢 Sistema de tickets ativado e salvo."
              : "🔴 Sistema de tickets desativado e salvo.",
          ephemeral: true
        });
      }

      // =========================
      // CATEGORIA
      // =========================

      if (
        interaction.customId ===
        "config_categoria"
      ) {

        const modal =
          new ModalBuilder()
            .setCustomId(
              "modal_categoria"
            )
            .setTitle(
              "📁 Configurar categoria"
            );

        const campo =
          new TextInputBuilder()
            .setCustomId(
              "categoria_id"
            )
            .setLabel(
              "ID da categoria"
            )
            .setPlaceholder(
              "Ex: 1547879820048990358"
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(true)
            .setValue(
              config.categoria
            );

        modal.addComponents(
          new ActionRowBuilder()
            .addComponents(campo)
        );

        return interaction.showModal(
          modal
        );
      }

      // =========================
      // CARGO
      // =========================

      if (
        interaction.customId ===
        "config_cargo"
      ) {

        const modal =
          new ModalBuilder()
            .setCustomId(
              "modal_cargo"
            )
            .setTitle(
              "👤 Configurar cargo ADM"
            );

        const campo =
          new TextInputBuilder()
            .setCustomId(
              "cargo_id"
            )
            .setLabel(
              "ID do cargo ADM"
            )
            .setPlaceholder(
              "Cole o ID do cargo"
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(true)
            .setValue(
              config.cargoADM || ""
            );

        modal.addComponents(
          new ActionRowBuilder()
            .addComponents(campo)
        );

        return interaction.showModal(
          modal
        );
      }

      // =========================
      // MENSAGEM
      // =========================

      if (
        interaction.customId ===
        "config_mensagem"
      ) {

        const modal =
          new ModalBuilder()
            .setCustomId(
              "modal_mensagem"
            )
            .setTitle(
              "📝 Mensagem do ticket"
            );

        const campo =
          new TextInputBuilder()
            .setCustomId(
              "mensagem"
            )
            .setLabel(
              "Mensagem"
            )
            .setPlaceholder(
              "Use {usuario} para mencionar o cliente"
            )
            .setStyle(
              TextInputStyle.Paragraph
            )
            .setRequired(true)
            .setValue(
              config.mensagemTicket
            );

        modal.addComponents(
          new ActionRowBuilder()
            .addComponents(campo)
        );

        return interaction.showModal(
          modal
        );
      }

      // =========================
      // COR
      // =========================

      if (
        interaction.customId ===
        "config_cor"
      ) {

        const modal =
          new ModalBuilder()
            .setCustomId(
              "modal_cor"
            )
            .setTitle(
              "🎨 Configurar cor"
            );

        const campo =
          new TextInputBuilder()
            .setCustomId(
              "cor"
            )
            .setLabel(
              "Cor HEX"
            )
            .setPlaceholder(
              "#7A00FF"
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(true)
            .setValue(
              config.cor
            );

        modal.addComponents(
          new ActionRowBuilder()
            .addComponents(campo)
        );

        return interaction.showModal(
          modal
        );
      }

      // =========================
      // BOTÃO
      // =========================

      if (
        interaction.customId ===
        "config_botao"
      ) {

        const modal =
          new ModalBuilder()
            .setCustomId(
              "modal_botao"
            )
            .setTitle(
              "🔘 Nome do botão"
            );

        const campo =
          new TextInputBuilder()
            .setCustomId(
              "nome_botao"
            )
            .setLabel(
              "Nome do botão"
            )
            .setPlaceholder(
              "Ex: Abrir Ticket"
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(true)
            .setValue(
              config.nomeBotao
            );

        modal.addComponents(
          new ActionRowBuilder()
            .addComponents(campo)
        );

        return interaction.showModal(
          modal
        );
      }

      // =========================
      // FECHAMENTO
      // =========================

      if (
        interaction.customId ===
        "config_fechamento"
      ) {

        return interaction.reply({
          content:
            "🗑️ **Fechamento de tickets**\n\n" +
            "O botão 🔒 **Fechar Ticket** já é adicionado automaticamente aos tickets.",
          ephemeral: true
        });
      }

      // =========================
      // ATENDIMENTO
      // =========================

      if (
        interaction.customId ===
        "config_atendimento"
      ) {

        const modal =
          new ModalBuilder()
            .setCustomId(
              "modal_atendimento"
            )
            .setTitle(
              "📋 Mensagem de atendimento"
            );

        const campo =
          new TextInputBuilder()
            .setCustomId(
              "atendimento"
            )
            .setLabel(
              "Mensagem"
            )
            .setStyle(
              TextInputStyle.Paragraph
            )
            .setRequired(true)
            .setValue(
              config.mensagemAtendimento
            );

        modal.addComponents(
          new ActionRowBuilder()
            .addComponents(campo)
        );

        return interaction.showModal(
          modal
        );
      }

      // =========================
      // FECHAR TICKET
      // =========================

      if (
        interaction.customId ===
        "fechar_ticket"
      ) {

        if (
          !interaction.channel ||
          !interaction.channel.name.startsWith(
            "ticket-"
          )
        ) {

          return interaction.reply({
            content:
              "❌ Este canal não é um ticket.",
            ephemeral: true
          });
        }

        await interaction.reply({
          content:
            "🔒 Fechando o ticket...",
          ephemeral: true
        });

        setTimeout(
          async () => {

            try {

              await interaction.channel.delete();

            } catch (erro) {

              console.error(
                "❌ Erro ao fechar ticket:",
                erro
              );
            }

          },
          2000
        );

        return;
      }
    }

    // =========================
    // MODAIS
    // =========================

    if (interaction.isModalSubmit()) {

      // =========================
      // PAGAMENTO
      // =========================

      if (
        interaction.customId ===
        "modal_pagamento"
      ) {

        const recebedorId =
          interaction.fields
            .getTextInputValue(
              "recebedor_id"
            )
            .trim();

        const valorTexto =
          interaction.fields
            .getTextInputValue(
              "valor"
            )
            .trim()
            .replace(",", ".");

        const valor =
          Number(valorTexto);

        if (
          !/^\d{17,20}$/.test(
            recebedorId
          )
        ) {

          return interaction.reply({
            content:
              "❌ ID do Discord inválido.",
            ephemeral: true
          });
        }

        if (
          !Number.isFinite(valor) ||
          valor <= 0
        ) {

          return interaction.reply({
            content:
              "❌ Valor inválido.",
            ephemeral: true
          });
        }

        if (
          recebedorId ===
          interaction.user.id
        ) {

          return interaction.reply({
            content:
              "❌ O pagador e o recebedor não podem ser a mesma pessoa.",
            ephemeral: true
          });
        }

        const membroRecebedor =
          await interaction.guild.members
            .fetch(recebedorId)
            .catch(() => null);

        if (!membroRecebedor) {

          return interaction.reply({
            content:
              "❌ Não encontrei esse jogador neste servidor.",
            ephemeral: true
          });
        }

        const pagamento =
          criarPagamento({
            guildId:
              interaction.guild.id,

            canalId:
              interaction.channel.id,

            pagadorId:
              interaction.user.id,

            recebedorId,

            valor
          });

        const embed =
          new EmbedBuilder()
            .setTitle(
              "💰 NOVO PAGAMENTO"
            )
            .setColor(config.cor)
            .setDescription(

              `🆔 **ID:** \`${pagamento.id}\`\n\n` +

              `📤 **Quem paga:** <@${pagamento.pagadorId}>\n` +

              `📥 **Quem recebe:** <@${pagamento.recebedorId}>\n\n` +

              `💵 **Valor:** ${formatarValor(
                pagamento.valor
              )}\n\n` +

              `🟠 **Aguardando confirmação do pagamento**\n\n` +

              `Depois do pagamento, o sistema poderá receber a confirmação do provedor através do webhook.`
            )
            .setFooter({
              text:
                "Automet • Pagamento"
            });

        const botoes =
          new ActionRowBuilder()
            .addComponents(

              new ButtonBuilder()
                .setCustomId(
                  `pagamento_paguei_${pagamento.id}`
                )
                .setLabel(
                  "Paguei"
                )
                .setEmoji("📤")
                .setStyle(
                  ButtonStyle.Success
                ),

              new ButtonBuilder()
                .setCustomId(
                  `pagamento_recebi_${pagamento.id}`
                )
                .setLabel(
                  "Recebi"
                )
                .setEmoji("📥")
                .setStyle(
                  ButtonStyle.Primary
                ),

              new ButtonBuilder()
                .setCustomId(
                  `pagamento_info_${pagamento.id}`
                )
                .setLabel(
                  "Informações"
                )
                .setEmoji("ℹ️")
                .setStyle(
                  ButtonStyle.Secondary
                )
            );

        await interaction.reply({
          embeds: [embed],
          components: [botoes]
        });

        return;
      }

      // =========================
      // CATEGORIA
      // =========================

      if (
        interaction.customId ===
        "modal_categoria"
      ) {

        const categoria =
          interaction.fields
            .getTextInputValue(
              "categoria_id"
            )
            .trim();

        const canal =
          interaction.guild.channels.cache.get(
            categoria
          );

        if (
          !canal ||
          canal.type !==
            ChannelType.GuildCategory
        ) {

          return interaction.reply({
            content:
              "❌ Esse ID não corresponde a uma categoria válida.",
            ephemeral: true
          });
        }

        config.categoria =
          categoria;

        salvarConfig();

        return interaction.reply({
          content:
            `✅ Categoria salva!\n\n📁 ${canal.name}`,
          ephemeral: true
        });
      }

      // =========================
      // CARGO
      // =========================

      if (
        interaction.customId ===
        "modal_cargo"
      ) {

        const cargo =
          interaction.guild.roles.cache.get(
            interaction.fields
              .getTextInputValue(
                "cargo_id"
              )
              .trim()
          );

        if (!cargo) {

          return interaction.reply({
            content:
              "❌ Cargo não encontrado. Verifique o ID.",
            ephemeral: true
          });
        }

        config.cargoADM =
          cargo.id;

        salvarConfig();

        return interaction.reply({
          content:
            `✅ Cargo ADM salvo!\n\n👤 ${cargo}`,
          ephemeral: true
        });
      }

      // =========================
      // MENSAGEM
      // =========================

      if (
        interaction.customId ===
        "modal_mensagem"
      ) {

        config.mensagemTicket =
          interaction.fields
            .getTextInputValue(
              "mensagem"
            );

        salvarConfig();

        return interaction.reply({
          content:
            "✅ Mensagem do ticket salva.",
          ephemeral: true
        });
      }

      // =========================
      // COR
      // =========================

      if (
        interaction.customId ===
        "modal_cor"
      ) {

        const novaCor =
          interaction.fields
            .getTextInputValue(
              "cor"
            )
            .trim();

        if (
          !/^#[0-9A-Fa-f]{6}$/.test(
            novaCor
          )
        ) {

          return interaction.reply({
            content:
              "❌ Cor inválida. Use o formato `#7A00FF`.",
            ephemeral: true
          });
        }

        config.cor =
          novaCor;

        salvarConfig();

        return interaction.reply({
          content:
            `✅ Cor salva: **${novaCor}**`,
          ephemeral: true
        });
      }

      // =========================
      // BOTÃO
      // =========================

      if (
        interaction.customId ===
        "modal_botao"
      ) {

        config.nomeBotao =
          interaction.fields
            .getTextInputValue(
              "nome_botao"
            )
            .trim();

        salvarConfig();

        return interaction.reply({
          content:
            `✅ Nome do botão salvo: **${config.nomeBotao}**`,
          ephemeral: true
        });
      }

      // =========================
      // ATENDIMENTO
      // =========================

      if (
        interaction.customId ===
        "modal_atendimento"
      ) {

        config.mensagemAtendimento =
          interaction.fields
            .getTextInputValue(
              "atendimento"
            );

        salvarConfig();

        return interaction.reply({
          content:
            "✅ Mensagem de atendimento salva.",
          ephemeral: true
        });
      }
    }
  }
);

// =========================
// WEBHOOK DE PAGAMENTO
// =========================
//
// Este endpoint é GENÉRICO.
//
// Depois vamos adaptar para o banco/provedor escolhido.
//
// Exemplo de dados esperados:
//
// {
//   "paymentId": "PAY-ABC123",
//   "status": "PAID",
//   "amount": 20,
//   "transactionId": "123456"
// }
//
// =========================

app.post(
  "/webhook/pagamento",
  async (req, res) => {

    try {

      if (!config.webhookAtivo) {

        return res.status(403).json({
          sucesso: false,
          mensagem:
            "Webhook desativado."
        });
      }

      const {
        paymentId,
        status,
        amount,
        transactionId,
        provider
      } = req.body;

      if (!paymentId) {

        return res.status(400).json({
          sucesso: false,
          mensagem:
            "paymentId é obrigatório."
        });
      }

      const pagamento =
        pagamentos[paymentId];

      if (!pagamento) {

        return res.status(404).json({
          sucesso: false,
          mensagem:
            "Pagamento não encontrado."
        });
      }

      const statusNormalizado =
        String(status || "")
          .toUpperCase();

      if (
        statusNormalizado !==
        "PAID"
      ) {

        atualizarPagamento(
          paymentId,
          {
            status:
              statusNormalizado ||
              "PENDENTE",

            provedor:
              provider || null,

            transacaoId:
              transactionId || null
          }
        );

        return res.json({
          sucesso: true,
          confirmado: false,
          mensagem:
            "Pagamento ainda não está confirmado."
        });
      }

      // =========================
      // CONFERIR VALOR
      // =========================

      if (
        amount !== undefined &&
        Number(amount) !==
          Number(pagamento.valor)
      ) {

        console.log(
          `⚠️ Valor diferente no pagamento ${paymentId}`
        );

        return res.status(400).json({
          sucesso: false,
          confirmado: false,
          mensagem:
            "O valor recebido não corresponde ao valor esperado."
        });
      }

      // =========================
      // CONFIRMAR
      // =========================

      atualizarPagamento(
        paymentId,
        {
          pagamentoConfirmado:
            true,

          status:
            "PAGO",

          provedor:
            provider || null,

          transacaoId:
            transactionId || null,

          confirmadoEm:
            new Date().toISOString()
        }
      );

      const finalizado =
        verificarPagamentoFinalizado(
          paymentId
        );

      await atualizarMensagemPagamento(
        paymentId
      );

      console.log(
        `✅ Pagamento confirmado: ${paymentId}`
      );

      return res.json({
        sucesso: true,

        confirmado: true,

        finalizado,

        paymentId
      });

    } catch (erro) {

      console.error(
        "❌ Erro no webhook:",
        erro
      );

      return res.status(500).json({
        sucesso: false,
        mensagem:
          "Erro interno."
      });
    }
  }
);

// =========================
// STATUS DO WEBHOOK
// =========================

app.get(
  "/webhook/status",
  (req, res) => {

    res.json({
      online: true,

      webhook:
        config.webhookAtivo,

      pagamentos:
        config.pagamentosAtivos,

      bot:
        client.isReady(),

      timestamp:
        new Date().toISOString()
    });
  }
);

// =========================
// INICIAR SERVIDOR WEB
// =========================

app.listen(
  WEBHOOK_PORT,
  () => {

    console.log(
      `🌐 Webhook iniciado na porta ${WEBHOOK_PORT}`
    );

    console.log(
      `📡 Endpoint: /webhook/pagamento`
    );
  }
);

// =========================
// LOGIN DISCORD
// =========================

client.login(
  process.env.DISCORD_TOKEN
);
