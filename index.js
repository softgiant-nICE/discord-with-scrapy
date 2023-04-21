const {
  webhookURL,
  content,
  username,
  avatarURL,
} = require("./config/discord.json");
const { EmbedBuilder, WebhookClient } = require("discord.js");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const { scrapeTresBien } = require("./scrapy/tres-bien.js");
const { scrapeOpiumparis } = require("./scrapy/opiumparis.js");
const { scrapeVooberlin } = require("./scrapy/vooberlin.js");

function sendMessage({ title, link, image, price, sizes }) {
  const webhookClient = new WebhookClient({ url: webhookURL });

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setURL(link)
    .setThumbnail(image)
    .setColor(0xff0000)
    .addFields(
      { name: "Price", value: price },
      { name: "Sizes", value: sizes.length > 0 ? sizes.join("\n"): 'None' }
    );

  webhookClient.send({
    content,
    username,
    avatarURL,
    embeds: [embed],
  });
}

function scrape1() {
  scrapeTresBien().then(async (data) => {
    if (data && Array.isArray(data)) {
      await runDB(data);
    }
  });
}
function scrape2() {
  scrapeVooberlin().then(async (data) => {
    if (data && Array.isArray(data)) {
      await runDB(data);
    }
  });
}
function scrape3() {
  scrapeOpiumparis().then(async (data) => {
    if (data && Array.isArray(data)) {
      await runDB(data);
    }
  });
}

async function runDB(items = []) {
  const db = await open({
    filename: "./shoes.db",
    driver: sqlite3.Database,
  });

  await db.run(
    "CREATE TABLE IF NOT EXISTS links(id INTEGER PRIMARY KEY, link TEXT NOT NULL)"
  );

  await Promise.all(
    items.map((item) =>
      db
        .get("SELECT id, link FROM links WHERE link = ?", item?.link)
        .then((row) => {
          if (!row) {
            db.run("INSERT INTO links(link) VALUES(?)", [item?.link]).then(
              () => {
                console.log("New sent:::", item.title);
                sendMessage(item);
              }
            );
          } else {
            console.log("Already sent:::", item.title);
          }
        })
    )
  );
  // items.forEach(async (item) => {
  //   const row = await db.get(
  //     "SELECT id, link FROM links WHERE link = ?",
  //     item?.link
  //   );
  //   if (!row) {
  //     await db.run("INSERT INTO links(link) VALUES(?)", [item?.link]);
  //     sendMessage(item);
  //     console.log("Item was added.");
  //   } else {
  //     console.log("Item was already sent.");
  //   }
  // });

  db.close();
}

async function main() {
  // scrape1();
  scrape2();
  // scrape3();

  // setInterval(() => {
  //   scrape1();
  //   scrape2();
  //   scrape3();
  // }, 1000 * 60 * 5);
}

main();
