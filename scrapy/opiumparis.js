const vanillaPuppeteer = require("puppeteer");
const { addExtra } = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const puppeteer = addExtra(vanillaPuppeteer);
puppeteer.use(StealthPlugin());
// const puppeteer = require('puppeteer-extension');

const { keywords, options, timeout } = require("../config/scrape.json");
const url = "https://www.opiumparis.com/en/16-new-arrivals";

async function scrape() {
  const context = await puppeteer.launch(options);
  const browser = await context.createIncognitoBrowserContext();
  try {
    console.log("opiumparis::start");
    const page = await browser.newPage();

    await page.goto(url, { timeout });

    const paginationSelector =
      "#js-product-list > nav > div > ul > li:last-child";
    await page.waitForSelector(paginationSelector, { timeout });

    const lastPageNameSelector =
      "#js-product-list > nav > div > ul > li:nth-last-child(2) > a";
    const pages = await page.$eval(
      lastPageNameSelector,
      (el) => el.textContent
    );

    const results = await Promise.all(
      [...Array(parseInt(pages)).keys()].map(async (p) => {
        let newPage = await browser.newPage();

        await newPage.goto(`${url}?page=${p + 1}`, { timeout });
        const selector = "#js-product-list > div > article:last-child > div";
        await newPage.waitForSelector(selector, { timeout });

        const items = await newPage.$$eval(
          "#js-product-list > div > article > div",
          (elements, keywords) => {
            return elements
              // .filter((element) => {
              //   const sold = element.querySelector(
              //     "a.product-thumbnail > span.btn"
              //   );
              //   return sold ? false : true;
              // })
              .map((ele) => {
                const title = ele.querySelector(
                  "div.product-description > h1 > a"
                ).textContent;

                let matched = false;
                keywords.forEach((keyword) => {
                  if (title.toLowerCase().includes(keyword)) {
                    matched = true;
                  }
                });
                if (matched) {
                  const link = ele
                    .querySelector("a.product-thumbnail")
                    .getAttribute("href");
                  const price = ele.querySelector(
                    "div.product-description > div.product-price-and-shipping > div.price"
                  ).textContent;
                  const image = ele
                    .querySelector("a.product-thumbnail>img")
                    .getAttribute("src");
                  const sizes = [];
                  ele
                    .querySelectorAll(
                      "div.product-description > div.product-sizes > ul.list-sizes>li>a"
                    )
                    .forEach((node) => {
                      sizes.push(node.textContent.replace(',', '.'));
                    });
                  return { title, link, price, image, sizes };
                } else {
                  return null;
                }
              });
          },
          keywords
        );

        return items.filter((item) => item != null);
      })
    );
    const items = [];
    results.forEach((ele) =>
      ele.forEach((item) => {
        items.push(item);
      })
    );

    // console.log(items);
    const data = await Promise.all(
      items.map(async (item) => {
        let newPage = await browser.newPage();
        await newPage.goto(item.link, { timeout });

        const titleSelector = "h1[itemprop='name']";
        await newPage.waitForSelector(titleSelector, { timeout });

        const title = await newPage.$eval(
          titleSelector,
          (el) => el.textContent
        );

        return { ...item, title };
      })
    );
    browser.close();
    console.log("opiumparis::end");
    return data;
  } catch (error) {
    browser.close();
    console.log("opiumparis::fail");
    // console.log(error);
    return [];
  }
}

module.exports = {
  scrapeOpiumparis: scrape,
};
