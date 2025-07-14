import axios from "axios";
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ComponentType, EmbedBuilder,
  StringSelectMenuBuilder
} from "discord.js";

import { Precommand, PyPIPackage } from "@typings/modules/discord";

const commandPyPI: Precommand = {
  name: "pypi",
  description: "Get detailed information about a Python package from PyPI",
  examples: ["pypi <package-name>", "pypi requests", "pypi numpy"],
  nsfw: false,
  category: "Utilities",
  owner: false,
  aliases: ["pypi-info", "python-package", "pip-package"],
  botpermissions: ["SendMessages", "EmbedLinks"],
  permissions: ["SendMessages"],
  async execute(client, message, args, prefix) {
    if (!message.guild || !message.channel || message.channel.type !== ChannelType.GuildText) return;

    if (!args[0]) {
      return message.reply({
        embeds: [
          {
            title: client.t("discord:pypi.errorTitle", { lng: message.guild.preferredLocale }),
            description: [
              `${client.getEmoji(message.guild.id, "error")} ${client.t("discord:pypi.noPackage", { prefix, lng: message.guild.preferredLocale })}`,
              client.t("discord:pypi.usage", { prefix, command: this.name, lng: message.guild.preferredLocale }),
            ].join("\n"),
          },
        ],
      });
    }

    const packageName = args[0];
    let pkgData: PyPIPackage;

    try {
      const response = await axios.get(`https://pypi.org/pypi/${packageName}/json`);
      pkgData = response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          return message.reply({
            embeds: [
              {
                title: client.t("discord:pypi.errorTitle", { lng: message.guild.preferredLocale }),
                description: [
                  `${client.getEmoji(message.guild.id, "error")} ${client.t("discord:pypi.notFound", { lng: message.guild.preferredLocale })}`,
                  client.t("discord:pypi.checkName", { lng: message.guild.preferredLocale }),
                ].join("\n"),
              },
            ],
          });
        }
      }
      console.error("Error fetching PyPI package:", error);
      return message.reply({
        embeds: [
          {
            title: client.t("discord:pypi.errorTitle", { lng: message.guild.preferredLocale }),
            description: [
              `${client.getEmoji(message.guild.id, "error")} ${client.t("discord:pypi.fetchError", { lng: message.guild.preferredLocale })}`,
              client.t("discord:pypi.tryAgain", { lng: message.guild.preferredLocale }),
            ].join("\n"),
          },
        ],
      });
    }

    // Main embed with basic info
    const mainEmbed = new EmbedBuilder()
      .setTitle(client.t("discord:pypi.title", { name: pkgData.info.name, lng: message.guild.preferredLocale }))
      .setColor(0x3776ab) // PyPI blue color
      .setDescription(
        pkgData.info.summary || client.t("discord:pypi.noSummary", { lng: message.guild.preferredLocale }),
      )
      .addFields(
        {
          name: client.t("discord:pypi.latestVersion", { lng: message.guild.preferredLocale }),
          value: pkgData.info.version,
          inline: true,
        },
        {
          name: client.t("discord:pypi.license", { lng: message.guild.preferredLocale }),
          value: pkgData.info.license || client.t("discord:pypi.unknown", { lng: message.guild.preferredLocale }),
          inline: true,
        },
        {
          name: client.t("discord:pypi.author", { lng: message.guild.preferredLocale }),
          value:
            pkgData.info.author ||
            pkgData.info.author_email ||
            client.t("discord:pypi.unknown", { lng: message.guild.preferredLocale }),
          inline: true,
        },
      );

    // Add homepage if available
    if (pkgData.info.home_page) {
      mainEmbed.addFields({
        name: client.t("discord:pypi.homepage", { lng: message.guild.preferredLocale }),
        value: `[${client.t("discord:pypi.visitWebsite", { lng: message.guild.preferredLocale })}](${pkgData.info.home_page})`,
        inline: true,
      });
    }

    // Add project URLs if available
    if (pkgData.info.project_urls) {
      const urls = Object.entries(pkgData.info.project_urls)
        .map(([name, url]) => `[${name}](${url})`)
        .join(" • ");

      mainEmbed.addFields({
        name: client.t("discord:pypi.projectLinks", { lng: message.guild.preferredLocale }),
        value: urls,
      });
    }

    // Add Python version requirement if specified
    if (pkgData.info.requires_python) {
      mainEmbed.addFields({
        name: "Python Version",
        value: pkgData.info.requires_python,
        inline: true,
      });
    }

    // Create buttons
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("View on PyPI")
        .setURL(`https://pypi.org/project/${pkgData.info.name}/`)
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder().setLabel("View Dependencies").setCustomId("view_deps").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setLabel("View Versions").setCustomId("view_versions").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setLabel("View Classifiers").setCustomId("view_classifiers").setStyle(ButtonStyle.Secondary),
    );

    // Create versions select menu
    const versions = Object.keys(pkgData.releases || {})
      .sort((a, b) => {
        const aParts = a.split(".").map(Number);
        const bParts = b.split(".").map(Number);
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
          const aVal = aParts[i] || 0;
          const bVal = bParts[i] || 0;
          if (aVal !== bVal) return bVal - aVal;
        }
        return 0;
      })
      .slice(0, 25);

    const versionSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("select_version")
        .setPlaceholder("Select a version to view details")
        .addOptions(
          versions.map((version) => ({
            label: version,
            value: version,
            description: `${pkgData.releases[version]?.length || 0} release files`,
            default: version === pkgData.info.version,
          })),
        ),
    );

    // Send initial message
    const msg = await message.reply({
      embeds: [mainEmbed],
      components: [buttons, versionSelect],
    });

    // Collector for button interactions
    const collector = msg.createMessageComponentCollector({
      time: 60000, // 1 minute
      componentType: ComponentType.Button,
    });

    collector.on(
      "collect",
      async (interaction: {
        isButton: () => any;
        deferUpdate: () => any;
        customId: any;
        editReply: (arg0: { embeds: EmbedBuilder[] }) => any;
      }) => {
        if (!interaction.isButton()) return;

        await interaction.deferUpdate();

        switch (interaction.customId) {
          case "view_deps": {
            const dependencies = pkgData.info.requires_dist || [];

            const depsEmbed = new EmbedBuilder().setTitle(`Dependencies for ${pkgData.info.name}`).setColor(0x3776ab);

            if (dependencies.length > 0) {
              // Group dependencies by type (required vs optional)
              const requiredDeps = dependencies.filter((d) => !d.includes("extra =="));
              const optionalDeps = dependencies.filter((d) => d.includes("extra =="));

              if (requiredDeps.length > 0) {
                depsEmbed.addFields({
                  name: "Required Dependencies",
                  value: requiredDeps
                    .map((dep) => {
                      // Clean up version specifications
                      return dep
                        .replace(/[;].*$/, "") // Remove environment markers
                        .replace(/\s*\(.*?\)\s*/g, " ") // Remove parentheses with spaces
                        .trim();
                    })
                    .map((dep) => `• ${dep}`)
                    .join("\n"),
                });
              }

              if (optionalDeps.length > 0) {
                // Group optional dependencies by their extra name
                const extrasMap = new Map<string, string[]>();

                optionalDeps.forEach((dep) => {
                  const extraMatch = dep.match(/extra == ['"](.*?)['"]/);
                  if (extraMatch) {
                    const extraName = extraMatch[1];
                    const cleanDep = dep.replace(/;\s*extra == ['"].*?['"]/, "");

                    if (!extrasMap.has(extraName)) {
                      extrasMap.set(extraName, []);
                    }
                    extrasMap.get(extraName)?.push(cleanDep);
                  }
                });

                extrasMap.forEach((deps, extraName) => {
                  depsEmbed.addFields({
                    name: `Optional: ${extraName}`,
                    value: deps.map((dep) => `• ${dep}`).join("\n"),
                  });
                });
              }
            } else {
              depsEmbed.setDescription("This package has no dependencies.");
            }

            await interaction.editReply({ embeds: [mainEmbed, depsEmbed] });
            break;
          }

          case "view_versions": {
            const versionsEmbed = new EmbedBuilder()
              .setTitle(`Available Versions for ${pkgData.info.name}`)
              .setColor(0x3776ab)
              .setDescription(
                versions
                  .map((version) => `• ${version} (${pkgData.releases[version]?.length || 0} files)`)
                  .join("\n")
                  .slice(0, 2000), // Discord embed limit
              );

            await interaction.editReply({ embeds: [mainEmbed, versionsEmbed] });
            break;
          }

          case "view_classifiers": {
            const classifiers = pkgData.info.classifiers || [];

            const classifiersEmbed = new EmbedBuilder()
              .setTitle(`Classifiers for ${pkgData.info.name}`)
              .setColor(0x3776ab);

            if (classifiers.length > 0) {
              // Group classifiers by type
              const classifierGroups: Record<string, string[]> = {};

              classifiers.forEach((classifier) => {
                const [type, ...rest] = classifier.split(" :: ");
                if (!classifierGroups[type]) {
                  classifierGroups[type] = [];
                }
                classifierGroups[type].push(rest.join(" :: "));
              });

              for (const [type, items] of Object.entries(classifierGroups)) {
                classifiersEmbed.addFields({
                  name: type,
                  value: items.map((item) => `• ${item}`).join("\n"),
                });
              }
            } else {
              classifiersEmbed.setDescription("No classifiers available for this package.");
            }

            await interaction.editReply({ embeds: [mainEmbed, classifiersEmbed] });
            break;
          }
        }
      },
    );

    // Handle version selection
    const selectCollector = msg.createMessageComponentCollector({
      time: 60000,
      componentType: ComponentType.StringSelect,
    });

    selectCollector.on(
      "collect",
      async (interaction: {
        isStringSelectMenu: () => any;
        deferUpdate: () => any;
        values: any[];
        editReply: (arg0: { embeds: EmbedBuilder[] }) => any;
      }) => {
        if (!interaction.isStringSelectMenu()) return;

        await interaction.deferUpdate();

        const selectedVersion = interaction.values[0];
        const releaseFiles = pkgData.releases?.[selectedVersion] || [];

        const versionEmbed = new EmbedBuilder()
          .setTitle(`Version ${selectedVersion} of ${pkgData.info.name}`)
          .setColor(0x3776ab)
          .addFields({
            name: "Release Files",
            value:
              releaseFiles.length > 0
                ? releaseFiles
                    .map((file) => `• [${file.filename}](${file.url}) (${file.size} bytes)`)
                    .join("\n")
                    .slice(0, 1024)
                : "No files available for this version",
          });

        await interaction.editReply({ embeds: [mainEmbed, versionEmbed] });
      },
    );

    // Clean up when collector ends
    collector.on("end", () => {
      msg.edit({ components: [] }).catch(console.error);
    });

    selectCollector.on("end", () => {
      msg.edit({ components: [] }).catch(console.error);
    });

    return;
  },
};

export default commandPyPI;
