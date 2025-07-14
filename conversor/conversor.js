/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import {
	ActionRowBuilder, ChannelType, Interaction, StringSelectMenuBuilder,
	StringSelectMenuInteraction, StringSelectMenuOptionBuilder, TextChannel
} from "discord.js";

import currency from "@config/json/coins.json";
import { EmbedCorrect, ErrorEmbed } from "@shared/utils/extends/discord/embeds.extends";
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Precommand } from "@typings/modules/discord";

const precommandConversor = {
  name: "conversor",
  nameLocalizations: {
    "es-ES": "conversor",
    "en-US": "converter",
  },
  description: "Converts a currency to another currency",
  descriptionLocalizations: {
    "es-ES": "Convierte una moneda a otra moneda",
    "en-US": "Converts a currency to another currency",
  },
  examples: ["conversor 100"],
  nsfw: false,
  owner: false,
  cooldown: 5,
  category: "Utilities",
  aliases: ["converter", "currency"],
  botpermissions: ["SendMessages"],
  permissions: ["SendMessages"],
  async execute(client, message, args, prefix) {
    if (!message.guild || !message.channel || message.channel.type !== ChannelType.GuildText || !client.user) return;
    const structure =
      "__How to use the command:__ `" +
      prefix +
      "converter [number]`\n" +
      "```js\n" +
      "[] -> Required\n" +
      "() -> Optional\n" +
      "{} -> Clarification\n" +
      "```";

    const moneda = args.join(" ");
    if (!moneda || isNaN(Number(moneda)))
      return message.channel.send({
        embeds: [
          new ErrorEmbed()
            .setTitle("Error - Missing Arguments")
            .setDescription(
              [
                `${client.getEmoji(message.guild.id, "error")} Please provide an amount to convert.`,
                `**Usage:** \`${prefix}conversor <amount>\`\n`,
                structure,
              ].join("\n"),
            ),
        ],
      });

    const monedas = currency;

    // Validate that currencies are configured
    if (!monedas || Object.keys(monedas).length === 0) {
      return message.channel.send({
        embeds: [
          new ErrorEmbed()
            .setTitle("Error - No currencies available")
            .setDescription("No currencies are configured in the system. Please contact an administrator."),
        ],
      });
    }

    const panel1 = new EmbedCorrect()
      .setTitle(`💶 **Currency converter** 💵`)
      .setDescription(`What is the source currency of your money?\nSelect the currency you want to convert from.`)
      .setColor(`#F7F9F7`)
      .setTimestamp();

    const menu = new StringSelectMenuBuilder()
      .setCustomId("menu-conversor1")
      .setPlaceholder(`💷 Choose the source currency:`);

    for (const i in monedas)
      menu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setValue(`${i}`)
          .setLabel(`${monedas[i][1]} (${i})`)
          .setDescription(`${monedas[i][0]}`)
          .setEmoji(`${monedas[i][2]}`),
      );

    const menu1 = new ActionRowBuilder().addComponents(menu);
    const msg1 = await message.channel.send({ embeds: [panel1], components: [menu1] });
    const respuesta1 = await new Promise((resolve) => {
      const filter1 = (menu1) => menu1.user.id === message.author.id;
      const collector1 = msg1.createMessageComponentCollector({ filter: filter1, time: 60000 });
      collector1.on("collect", async (menu1) => {
        const eleccion = menu1.values[0];
        resolve(eleccion);
        menu1.deferUpdate();
        collector1.stop();
      });
      collector1.on("end", (_collected, reason) => {
        if (reason === "time") resolve("timeout");
        else resolve(null);
      });
    });

    if (!respuesta1 || respuesta1 === "timeout") {
      await msg1.edit({
        embeds: [panel1.setDescription("⏰ The time to select the source currency has expired. Please try again.")],
        components: [],
      });
      return;
    }

    // Validate that the source currency exists
    if (!monedas[respuesta1]) {
      return message.channel.send({
        embeds: [
          new ErrorEmbed().setDescription(
            [
              `${client.getEmoji(message.guild.id, "error")} The selected source currency does not exist.`,
              `Please select a valid currency.`,
            ].join("\n"),
          ),
        ],
      });
    }

    // RESPONSE 2
    const panel2 = new EmbedCorrect()
      .setDescription(`To which currency do you want to convert your money?\nSelect the target currency.`)
      .setColor(`#F7F9F7`)
      .setTimestamp();

    const menu_2 = new StringSelectMenuBuilder()
      .setCustomId("menu-conversor2")
      .setPlaceholder(`💴 Choose the target currency:`);
    for (const i in monedas)
      menu_2.addOptions(
        new StringSelectMenuOptionBuilder()
          .setValue(`${i}`)
          .setLabel(`${monedas[i][1]} (${i})`)
          .setDescription(`${monedas[i][0]}`)
          .setEmoji(`${monedas[i][2]}`),
      );

    const menu2 = new ActionRowBuilder().addComponents(menu_2);
    const msg2 = await message.channel.send({ embeds: [panel2], components: [menu2] });
    const respuesta2 = await new Promise((resolve, _reject) => {
      const filter2 = (menu2) => menu2.user.id === message.author.id;
      const collector2 = msg2.createMessageComponentCollector({ filter: filter2, time: 60000 });
      collector2.on("collect", async (menu2) => {
        if (!message.guild) return;
        const eleccion = menu2.values[0];
        if (eleccion === respuesta1)
          return (message.channel).send({
            embeds: [
              new ErrorEmbed()
                .setDescription(
                  [
                    `${client.getEmoji(message.guild.id, "error")} You cannot convert the same currency to itself...`,
                    `Please choose another target currency.`,
                  ].join("\n"),
                )
                .setColor(`#F7F9F7`),
            ],
          });
        else {
          resolve(eleccion);
          collector2.stop();
        }
        menu2.deferUpdate();
        return;
      });
      collector2.on("end", (_collected, reason) => {
        if (reason === "time") resolve("timeout");
        else resolve(null);
      });
    });

    if (!respuesta2 || respuesta2 === "timeout") {
      await msg2.edit({
        embeds: [panel2.setDescription("⏰ The time to select the target currency has expired. Please try again.")],
        components: [],
      });
      return;
    }

    // Validate that the target currency exists
    if (!monedas[respuesta2]) {
      return message.channel.send({
        embeds: [
          new ErrorEmbed().setDescription(
            [
              `${client.getEmoji(message.guild.id, "error")} The selected target currency does not exist.`,
              `Please select a valid currency.`,
            ].join("\n"),
          ),
        ],
      });
    }

    // API request with error handling
    let json;
    try {
      json = await axios({
        method: "GET",
        url: `http://www.floatrates.com/daily/${respuesta1}.json`,
        timeout: 10000,
      });
    } catch (err) {
      return message.channel.send({
        embeds: [
          new ErrorEmbed()
            .setTitle("Connection error")
            .setDescription(
              [
                `${client.getEmoji(message.guild.id, "error")} Could not retrieve the exchange rate.`,
                `Check your connection or try again later.`,
                err.code ? `\`Error: ${err.code}\`` : "",
              ]
                .filter(Boolean)
                .join("\n"),
            ),
        ],
      });
    }

    if (!json || json.status !== 200) {
      return message.channel.send({
        embeds: [
          new ErrorEmbed().setDescription(
            [
              `${client.getEmoji(message.guild.id, "error")} Could not retrieve the exchange rate.`,
              `The conversion API did not respond correctly.`,
            ].join("\n"),
          ),
        ],
      });
    }
    // Convert the json to an object
    const data = JSON.parse(JSON.stringify(json.data));

    const currencyData = data[respuesta2.toLowerCase()];
    if (!currencyData || currencyData.rate === false) {
      return message.channel.send({
        embeds: [
          new ErrorEmbed()
            .setDescription(
              [
                `${client.getEmoji(message.guild.id, "error")} The target currency is not available in the API.`,
                `Please choose another currency.`,
              ].join("\n"),
            )
            .setColor(`#F7F9F7`),
        ],
      });
    }

    await message.channel.send({
      embeds: [
        new EmbedCorrect()
          .setTitle(`${monedas[respuesta1][2]} ⇌ ${monedas[respuesta2][2]}`)
          .setDescription(
            [
              `💱 **${moneda} ${monedas[respuesta1][1]}** equals:`,
              `**${((moneda) * data[respuesta2.toLowerCase()].rate).toFixed(2)} ${monedas[respuesta2][1]}**`,
              `\n_Exchange rate updated automatically._`,
            ].join("\n"),
          ),
      ],
    });

    return;
  },
};
export default precommandConversor;
