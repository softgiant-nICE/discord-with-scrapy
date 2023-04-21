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
const url = "https://www.vooberlin.com/sneakers/new-in";

async function scrape() {
  const browser = await puppeteer.launch(options);
  try {
    console.log("vooberlin::start");
    const page = await browser.newPage();

    await page.goto(url, { timeout });

    const paginationSelector =
      "div.listing--bottom-paging>div.listing--paging.panel--paging> a:last-child";
    await page.waitForSelector(paginationSelector, { timeout });

    const lastPageNameSelector =
      "div.listing--bottom-paging>div.listing--paging.panel--paging> a:nth-last-child(2)";
    const pages = await page.$eval(
      lastPageNameSelector,
      (el) => el.textContent
    );

    const results = await Promise.all(
      [...Array(parseInt(pages)).keys()].map(async (p) => {
        let newPage = await browser.newPage();
        await newPage.goto(`${url}/?p=${p + 1}`, { timeout });

        const selector = "div.listing--bottom-paging";
        // const selector =
        //   "div.product--box:nth-child(48)>div.box--content>div.product--info>a.product--image > span.image--element > span > div > picture >img";
        await newPage.waitForSelector(selector, { timeout });

        const items = await newPage.$$eval(
          "div.listing > div.product--box > div.box--content > div.product--info",
          (elements, keywords) => {
            return (
              elements
                // .filter((element) => {
                //   const sold = element.querySelector("div > div.w_instockBadge");
                //   return sold ? false : true;
                // })
                .map((ele) => {
                  const title =
                    ele.querySelector(
                      "div.w_product--infos>span.w_suppliername"
                    ).textContent +
                    " " +
                    ele.querySelector("div>span>a").getAttribute("title");

                  let matched = false;
                  keywords.forEach((keyword) => {
                    if (title.toLowerCase().includes(keyword)) {
                      matched = true;
                    }
                  });

                  if (matched) {
                    const link = ele
                      .querySelector("div>span>a")
                      .getAttribute("href");
                    let price = "None";
                    // const price_ele = ele.querySelector(
                    //   "div>div.product--price-info>div.product--price-outer>div.product--price>span"
                    // );
                    // if (price_ele) {
                    //   price_ele.textContent.replaceAll("\n", "");
                    // }

                    // const image = ele
                    //   .querySelector(
                    //     "a.product--image > span.image--element > span > div > picture >img"
                    //   )
                    //   .getAttribute("srcset");
                    return { title, link, price };
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

        const sizeSelector = "div.select-field>select>option:last-child";
        const imgSelector =
          "div.image-slider--slide>div.image-slider--item:first-child>span.image--element";
        await newPage.waitForSelector(imgSelector, { timeout });

        const image = await newPage.$eval(
          "div.image-slider--slide>div.image-slider--item:first-child>span.image--element",
          (ele) => ele.getAttribute("data-img-original")
        );

        const selector =
          "div.product--configurator>form>div.select-field>select>option";
        const sizes = await newPage.$$eval(
          selector,
          (options, sizeGuide) => {
            let euSizes = [];
            options.forEach((option) => {
              if (!option.innerHTML.includes("no stock")) {
                const usSize = parseFloat(
                  option.innerHTML.match(/-?(?:\d+(?:\.\d*)?|\.\d+)/)[0]
                );
                euSizes.push(sizeGuide[usSize]);
              }
            });
            return euSizes;
          },
          sizeGuide
        );

        const price = await newPage.$eval(
          "meta[itemprop='price']",
          (ele) => "€" + ele.getAttribute("content")
        );

        return { ...item, sizes, image, price };
      })
    );
    browser.close();
    console.log("vooberlin::end");
    return data;
  } catch (error) {
    console.log("vooberlin::fail");
    // console.log(error);
    browser.close();
    return [];
  }
}

module.exports = {
  scrapeVooberlin: scrape,
};
