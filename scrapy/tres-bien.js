const vanillaPuppeteer = require("puppeteer");
const { addExtra } = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const puppeteer = addExtra(vanillaPuppeteer);
puppeteer.use(StealthPlugin());

const {
  keywords,
  options,
  sizeGuide,
  timeout,
} = require("../config/scrape.json");
const url = "https://tres-bien.com";

async function scrape() {
  const browser = await puppeteer.launch(options);
  try {
    console.log("tres-bien::start");
    const page = await browser.newPage();

    await page.goto(url, { timeout });
    await page.goto(url + "/new-footwear", { timeout });

    const paginationSelector = "div.pages>ul.pages-items";
    await page.waitForSelector(paginationSelector, { timeout });

    const lastPageNameSelector =
      "div.pages>ul.pages-items> li:nth-last-child(2) > a > span.value";
    const pages = await page.$eval(
      lastPageNameSelector,
      (el) => el.textContent
    );

    const results = await Promise.all(
      [...Array(parseInt(pages)).keys()].map(async (p) => {
        let newPage = await browser.newPage();
        await newPage.goto(`${url}/new-footwear?p=${p + 1}`, { timeout });
        const selector = "ul.product-items>li:last-child>article";
        await newPage.waitForSelector(selector, { timeout });

        const items = await newPage.$$eval(
          "ul.product-items>li>article",
          (elements, keywords) => {
            return (
              elements
                // .filter((element) => {
                //   const sold = element.querySelector(
                //     "div.product-item-details > div.product-item-extra-info >span"
                //   );
                //   return sold ? false : true;
                // })
                .map((ele) => {
                  const title = ele.querySelector(
                    "div.product-item-details > div.product-item-name > a"
                  ).textContent;

                  let matched = false;
                  keywords.forEach((keyword) => {
                    if (title.toLowerCase().includes(keyword)) {
                      matched = true;
                    }
                  });
                  if (matched) {
                    const link = ele
                      .querySelector(
                        "div.product-item-details > div.product-item-name > a"
                      )
                      .getAttribute("href");
                    const price = ele.querySelector(
                      "div.product-item-details > div.price-box >span.price-container>span.price-wrapper>span"
                    ).textContent;
                    const image = ele
                      .querySelector(
                        "div.product-item-photo-wrapper > a > div>img"
                      )
                      .getAttribute("src");
                    return { title, link, price, image };
                  } else {
                    return null;
                  }
                })
            );
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

        let sizes = [];
        const sizeSelector = "div.pdp__info-accordion-wrapper";
        await newPage.waitForSelector(sizeSelector, { timeout });
        const selector = "div.select-wrapper>select>option:not(:first-child)";
        sizes = await newPage.$$eval(
          selector,
          (options, sizeGuide) => {
            let euSizes = [];
            options.forEach((option) => {
              const usSize = parseFloat(
                option.innerHTML
                  .replace(",", ".")
                  .match(/-?(?:\d+(?:\.\d*)?|\.\d+)/)[0]
              );
              euSizes.push(sizeGuide[usSize]);
            });
            return euSizes;
          },
          sizeGuide
        );

        return { ...item, sizes };
      })
    );
    browser.close();
    console.log("tres-bien::end");
    return data;
  } catch (error) {
    browser.close();
    console.log("tres-bien::fail");
    // console.log(error);
    return [];
  }
}

module.exports = {
  scrapeTresBien: scrape,
};
