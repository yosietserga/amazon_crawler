import puppeteer from "puppeteer";
import express from "express";

const app = express();
const PORT = process.env.PORT ?? 3000;
const base_url = "https://www.amazon.es";

const singleton = {};
singleton.data = {};

const getMeTheAmazonProductData = async (
  asin,
  with_variations,
  with_all_variations
) => {
  try {
    const log = console.log;

    singleton.with_variations = with_variations;
    singleton.with_all_variations = with_all_variations;

    const browser = await puppeteer.launch({
      headless: false,
      /*
      args: [
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-setuid-sandbox",
        "--no-sandbox",
      ],
      */
    });
    
    const page = await browser.newPage();
    page.on("console", (msg) => log("Browser Logs:", msg.text()));

    await page.goto(`${base_url}/gp/product/${asin}`);

    const resp = await page.evaluate(async (singleton) => {
      ("use strict");
      /** helpers.j **/
      const log = console.log;
      let selectors = {};

      //define selectors
      selectors.variationsContainersNoJS = "[id=twister] > div";
      selectors.variationsContainers = "[id^=inline-twister-expander-content] ul";
      selectors.variationsContainer = "[id^=inline-twister-expander-content] li";
      selectors.mainVariations = "dimension-value-list-item-square-image";
      selectors.secondaryVariations = "swatch-list-item-text";
      selectors.variationClickable = "span[id]";
      selectors.price = ".priceToPay .a-offscreen";
      log({selectors});
      //triggers mouse events
      const evMouse = (el, etype) => {
        var evt = document.createEvent("MouseEvents");
        evt.initMouseEvent(etype, true, true, window, 1);
        el.dispatchEvent(evt);
      };

      //triggers ui and kb events
      const evUI = (el, etype) => {
        var evt = document.createEvent("UIEvents");
        evt.initUIEvent(etype, true, true, window, 1);
        el.dispatchEvent(evt);
      };

      //sleep by ms
      const sleep = (ms) => new Promise((r) => setTimeout(r, (ms || 1) * 1000));
      //logger

      //dom helpers
      const find = (selector) => document.querySelector(selector);
      const findAll = (selector) =>
        Array.from(document.querySelectorAll(selector));
      /*#####################################################################*/
      /*#####################################################################*/
      /*#####################################################################*/

      /*#####################################################################*/
      /*#####################################################################*/
      /*#####################################################################*/

      //get variations
      function getVariations(selector, toInclude = []) {
        let results = [];
        const selectVariations = findAll(`${selector}`);
        if (
          Array.isArray(Array.from(selectVariations)) &&
          selectVariations.length > 0
        ) {
          let classListControl = null;
          Array.from(selectVariations).forEach((item) => {
            let keepGoing = false;
            if (
              toInclude.includes(item.classList[0]) &&
              classListControl === null
            ) {
              classListControl = item.classList[0];
              keepGoing = true;
            }
            keepGoing = classListControl === item.classList[0];
            if (keepGoing) {
              results.push(item);
            }
          });
        }
        return results;
      }

      const __getPrice = () => {
        let price = find(`${selectors.price}`);
        console.log({ price });
        if (!!price) {
          return price.innerText.replace(/[^0-9\.,]/gi, "");
        } else {
          return 0;
        }
      };

      function getProductData() {
        const asinEl = find("#ASIN");
        const asin = asinEl.value;
        if (!asin) return false;

        try {
          let title = unescape(find("#productTitle").innerText.trim())
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

          let specs = "";

          findAll("#feature-bullets li").forEach(function (item) {
            if (!!item.innerText) specs += item.innerText.trim() + "  ";
          });

          specs = unescape(specs)
            .normalize("NFD")
            .replace(/[\u0300-\u036f|\u00aa]/g, "");

          const price = __getPrice();
          let stock = 0;

          try {
            stock = find("#availability").innerText.replace(/\D/gi, "").trim();
          } catch (err) {
            console.log(err);
          }

          try {
            if (find("#outOfStock")) {
              stock = "AGOTADO";
            }
          } catch (err) {
            console.log(err);
          }

          if (!stock) stock = 1;

          //images preload
          const images = [];
          const image = find(".imgTagWrapper img").src;

          return {
            asin,
            url: window.location.href,
            title,
            price,
            stock,
            image,
            images,
            specs,
          };
        } catch (err) {
          console.log(err);
        }
      }

      const walkThroughVariations = async (
        selector,
        asyncCallback,
        makeClick = false
      ) => {
        const results = [];
        //get variations, if it has
        let selectVariations = getVariations(selectors.variationsContainer, [
          selector,
        ]);

        //walk thorugh
        for (let i in selectVariations) {
          if (isNaN(i)) continue;

          const opt = selectVariations[i].querySelector(
            selectors.variationClickable
          );

          if (
            !makeClick &&
            Array.from(opt.classList).join(" ").indexOf("unavailable") !== -1
          ) {
            continue;
          }

          //triggers click on variation
          if (makeClick) {
            evMouse(opt, "click");
            //just wait for a second
            await sleep(2);
          }

          results.push(opt);

          if (typeof asyncCallback === "function") {
            await asyncCallback(opt, results);
          }
        }

        return results;
      };

      //let's start
      if (!!singleton.with_variations || !!singleton.with_all_variations)
        await sleep();

      if (find("#sp-cc-accept")) {
        find("#sp-cc-accept").click();
      }

      log("wait until web is loaded");
      let lastAsin = null;
      let hasBeenClicked = false;
      let title = null;

      let hasVariations = findAll(selectors.variationsContainers).length;
      let noJS = false;
      //try with the other selector 
      if (
        (!!singleton.with_variations || !!singleton.with_all_variations) &&
        hasVariations === 0
      ) {
        hasVariations = findAll(selectors.variationsContainersNoJS).length;
        noJS = true;
      }
        console.log(
          "singleton.with_all_variations",
          singleton.with_all_variations
        );
      console.log("hasVariations", hasVariations);

      if (!noJS) {
        if (!!singleton.with_all_variations && hasVariations >= 2) {
          try {
            console.log("Get all combinations of variations");
            await walkThroughVariations(
              selectors.mainVariations,
              async (o) => {
                hasBeenClicked = false;

                title = o.querySelector(".swatch-title-text-display")
                  ? o
                      .querySelector(".swatch-title-text-display")
                      .innerText.trim() + " "
                  : "";
                console.log("getting combinations for variation " + title);
                return await walkThroughVariations(
                  selectors.secondaryVariations,
                  async (opt) => {
                    if (!hasBeenClicked) {
                      hasBeenClicked = true;
                      opt.click();
                      await sleep(2);
                    }

                    //make sure has loaded
                    if (!!lastAsin || lastAsin !== find("#ASIN").value) {
                      lastAsin = find("#ASIN").value;
                      await sleep();
                    }
                    console.log(lastAsin, find("#ASIN").value);

                    //get variation
                    const variation = {
                      asin: find("#ASIN").value,
                      title:
                        title +
                        opt
                          .querySelector(".swatch-title-text-display")
                          .innerText.trim(),
                    };

                    if (opt.querySelector(".twister_swatch_price")) {
                      let priceText = opt.querySelector(
                        ".twister_swatch_price"
                      ).innerText;
                      if (priceText.indexOf("a partir")) {
                        variation.price = priceText
                          .substr(priceText.indexOf("a partir"))
                          .replace(/[^0-9\.,]/gi, "");
                      } else {
                        variation.price = priceText.replace(/[^0-9\.,]/gi, "");
                      }
                    }
                    console.log(
                      lastAsin,
                      find("#ASIN").value,
                      __getPrice(),
                      variation
                    );

                    //get all needed data and dispatch done
                    if (!variation.price) variation.price = __getPrice();
                    const data = getProductData();
                    if (!!variation.price)
                      singleton.data[variation.asin] = {
                        ...data,
                        ...variation,
                      };
                    console.log(singleton.data[variation.asin], singleton.data);
                  },
                  true
                );
              },
              true
            );
          } catch (err) {
            console.log(err);
          }
        } else if (!!singleton.with_variations) {
          try {
            const variations = Array.from(
              findAll(selectors.variationsContainers)
            );
            variations.shift();
            console.log(variations);

            for (let i in variations[0].children) {
              if (isNaN(i)) continue;

              const opt = variations[0].children[i].querySelector(
                selectors.variationClickable
              );

              opt.click();
              await sleep(2);

              let title = unescape(find("#productTitle").innerText.trim())
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");

              const variation = {
                asin: find("#ASIN").value,
                title:
                  title +
                  " " +
                  opt
                    .querySelector(".swatch-title-text-display")
                    .innerText.trim(),
              };

              if (opt.querySelector(".twister_swatch_price")) {
                let priceText = opt.querySelector(
                  ".twister_swatch_price"
                ).innerText;
                if (priceText.indexOf("a partir")) {
                  variation.price = priceText
                    .substr(priceText.indexOf("a partir"))
                    .replace(/[^0-9\.,]/gi, "");
                } else {
                  variation.price = priceText.replace(/[^0-9\.,]/gi, "");
                }
              }

              //get all needed data and dispatch done
              if (!variation.price) variation.price = __getPrice();
              const data = getProductData();
              if (!!variation.price)
                singleton.data[variation.asin] = { ...data, ...variation };
              console.log(singleton.data[variation.asin], singleton.data);
            }
          } catch (err) {
            console.log(err);
          }
        } else {
          const data = getProductData();
          singleton.data[data.asin] = data;
        }
      } else {

        if (!!singleton.with_all_variations && hasVariations >= 2) {
          try {
            console.log("Get all combinations of variations");
            
            const lis = findAll("[id^=twister] ul li");
            for (let j in lis) {
              if (isNaN(j)) continue;
              let li = lis[j];
        
                li.click();
                await sleep(2);
                
                    //make sure has loaded
                    if (!!lastAsin || lastAsin !== find("#ASIN").value) {
                      lastAsin = find("#ASIN").value;
                      await sleep();
                    }

              let opts = findAll("[id^=twister] select option");

              for (let i in opts) {
                if (isNaN(i) || i == 0) continue;
                let opt = opts[i];

                if (
                  Array.from(opt.classList)
                    .join(" ")
                    .toLowerCase()
                    .indexOf("unavailable") !== -1
                ) {
                  continue;
                }

                if (!hasBeenClicked) {
                  hasBeenClicked = true;
                  let select_ = find("[id^=twister] select");
                  select_.click();
                  opt.selected = "selected";
                  select_.value = opt.value;
                  evUI(select_, "change");
                  await sleep(3);
                }

                    //make sure has loaded
                    if (!!lastAsin || lastAsin !== find("#ASIN").value) {
                      lastAsin = find("#ASIN").value;
                      await sleep();
                    }

                let title = unescape(find("#productTitle")?.innerText?.trim())
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "");

                const variation = {
                  asin: find("#ASIN").value,
                  title: title + " " + opt.innerText.trim(),
                };

                if (opt.querySelector(".twister_swatch_price")) {
                  let priceText = opt.querySelector(
                    ".twister_swatch_price"
                  )?.innerText;

                  if (priceText.indexOf("a partir")) {
                    variation.price = priceText
                      .substr(priceText.indexOf("a partir"))
                      .replace(/[^0-9\.,]/gi, "");
                  } else {
                    variation.price = priceText.replace(/[^0-9\.,]/gi, "");
                  }
                }

                //get all needed data and dispatch done
                if (!variation.price) variation.price = __getPrice();

                const data = getProductData();

                if (!!variation.price)
                  singleton.data[variation.asin] = { ...data, ...variation };

                console.log(singleton.data[variation.asin], singleton.data);

                hasBeenClicked = false;
              }
            }
          } catch (err) {
            console.log(err);
          }
        } else if (!!singleton.with_variations) {
          try {

            let opts = findAll("[id^=twister] select option");

            for (let i in opts) {
              if (isNaN(i) || i == 0) continue;
              let opt = opts[i];

              if (
                Array.from(opt.classList)
                  .join(" ")
                  .toLowerCase()
                  .indexOf("unavailable") !== -1
              ) {
                continue;
              }

              if (!hasBeenClicked) {
                hasBeenClicked = true;
                let select_ = find("[id^=twister] select");
                select_.click();
                opt.selected = "selected";
                select_.value = opt.value;
                evUI(select_, "change");
                await sleep(3);
              }
              
              let title = unescape(find("#productTitle")?.innerText?.trim())
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");

              const variation = {
                asin: find("#ASIN").value,
                title:
                  title +
                  " " +
                  opt.innerText.trim(),
              };

              if (opt.querySelector(".twister_swatch_price")) {
                let priceText = opt.querySelector(
                  ".twister_swatch_price"
                )?.innerText;

                if (priceText.indexOf("a partir")) {
                  variation.price = priceText
                    .substr(priceText.indexOf("a partir"))
                    .replace(/[^0-9\.,]/gi, "");
                } else {
                  variation.price = priceText.replace(/[^0-9\.,]/gi, "");
                }
              }

              //get all needed data and dispatch done
              if (!variation.price) variation.price = __getPrice();

              const data = getProductData();
              
              if (!!variation.price)
                singleton.data[variation.asin] = { ...data, ...variation };
              
                console.log(singleton.data[variation.asin], singleton.data);

              hasBeenClicked = false;
            }
          } catch (err) {
            console.log(err);
          }
        } else {
          const data = getProductData();
          singleton.data[data.asin] = data;
        }
      }

      console.log(singleton.data);
      return singleton;
    }, singleton);

    console.log(resp);
    await browser.close();
    return resp;
  } catch (err) {
    log(err);
  }
};

app.use(express.json());

app.get("/", (req, res) => {
  console.log("logging at home...");
  res.send("Welcome to Amazon Scraper API");
});

//GET product details
app.get("/products/:asin", async (req, res) => {
  const { asin } = req.params;
  const { with_variations, with_all_variations } = req.query;

  try {
    console.log(
      "searching product with asin " +
        asin +
        " and get the variations " +
        (with_variations ?? with_all_variations)
    );
    const body = await getMeTheAmazonProductData(
      asin,
      with_variations,
      with_all_variations
    );
    res.json(body);
  } catch (error) {
    res.json(error);
  }
});

app.listen(PORT, () => {
  console.log(`Amazon crawler as API is online on port ${PORT}!`);
});
