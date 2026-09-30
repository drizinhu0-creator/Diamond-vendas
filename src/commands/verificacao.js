const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Config = require('../models/Config');
const MembroVerificado = require('../models/MembroVerificado');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verificacao')
    .setDescription('Sistema de verificação do servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Cria o painel de verificação no canal atual')
        .addStringOption((opt) =>
          opt
            .setName('mensagem')
            .setDescription('Mensagem personalizada para o painel')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('verificar')
        .setDescription('Verifica manualmente um membro')
        .addUserOption((opt) =>
          opt.setName('membro').setDescription('Membro a ser verificado').setRequired(true)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const config = await Config.findOne({ guildId });
    
    if (!config?.cargoVerificacaoId) {
      return interaction.reply({
        content: '❌ Primeiro configure o cargo de verificação usando `/config cargo-verificacao`.',
        ephemeral: true,
      });
    }

    if (sub === 'setup') {
      const mensagemPadrao = `
**📋 Sistema de Verificação**

Clique no botão abaixo para se verificar e obter acesso aos canais do servidor!

⚠️ **Regras:**
• Você concorda em seguir as regras do servidor
• Não use múltiplas contas
• Mantenha um comportamento respeitoso

**Após a verificação você receberá o cargo: <@&${config.cargoVerificacaoId}>**
      `.trim();

      const mensagemPersonalizada = interaction.options.getString('mensagem') || mensagemPadrao;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📋 Sistema de Verificação')
        .setDescription(mensagemPersonalizada)
        .setFooter({ text: 'Clique no botão abaixo para se verificar' })
        .setTimestamp();

      const botao = new ButtonBuilder()
        .setCustomId('verificar_membro')
        .setLabel('✅ Verificar-me')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅');

      const row = new ActionRowBuilder().addComponents(botao);

      await interaction.channel.send({
        embeds: [embed],
        components: [row],
      });

      return interaction.reply({
        content: '✅ Painel de verificação criado com sucesso!',
        ephemeral: true,
      });
    }

    if (sub === 'verificar') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.reply({
          content: '❌ Você precisa da permissão **Gerenciar Cargos** para usar este comando.',
          ephemeral: true,
        });
      }

      const membro = interaction.options.getMember('membro');
      
      try {
        const cargo = await interaction.guild.roles.fetch(config.cargoVerificacaoId);
        if (!cargo) {
          return interaction.reply({
            content: '❌ O cargo de verificação não existe mais. Configure um novo cargo.',
            ephemeral: true,
          });
        }

        await membro.roles.add(cargo);

        await MembroVerificado.findOneAndUpdate(
          { guildId, userId: membro.id },
          { 
            guildId, 
            userId: membro.id, 
            cargoVerificacaoId: config.cargoVerificacaoId,
            verificadoPor: userId 
          },
          { upsert: true, new: true }
        );

        return interaction.reply({
          content: `✅ ${membro} foi verificado com sucesso e recebeu o cargo ${cargo}!`,
          ephemeral: true,
        });
      } catch (error) {
        console.error('Erro ao verificar membro:', error);
        return interaction.reply({
          content: `❌ Erro ao verificar membro: ${error.message}`,
          ephemeral: true,
        });
      }
    }
  },
};