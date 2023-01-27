const Nightmare = require("nightmare");
const Xvfb = require("xvfb");
const express = require("express");
const { log } = require("./utils/helpers");

main().catch(console.error);

// main function
async function main() {
  const close = await xvfb()
  const nightmare = Nightmare()

  const [err, title] = await poss(run(nightmare))
  if (err) {
    // cleanup properly
    await nightmare.end()
    await close()
    throw err
  }

  console.log(title)

  // shut'er down
  await nightmare.end()
  await close()
}

// run nightmare
//
// put all your nightmare commands in here
async function run(nightmare) {
  await nightmare.goto('https://google.com')
  const title = await nightmare.title()
  return title
}

// xvfb wrapper
function xvfb(options) {
  var xvfb = new Xvfb(options)

  function close() {
    return new Promise((resolve, reject) => {
      xvfb.stop(err => (err ? reject(err) : resolve()))
    })
  }

  return new Promise((resolve, reject) => {
    xvfb.start(err => (err ? reject(err) : resolve(close)))
  })
}

// try/catch helper
async function poss(promise) {
  try {
    const result = await promise
    return [null, result]
  } catch (err) {
    return [err, null]
  }
}
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

    const nightmare = Nightmare({
      /*
      openDevTools: {
        mode: "atach",
      },
      show: true,
      */
      executionTimeout: 1000 * 60 * 20, // in ms
    });

    log("Starting ", nightmare);

    singleton.with_variations = with_variations;
    singleton.with_all_variations = with_all_variations;

    nightmare
      .goto(`${base_url}/gp/product/${asin}`)
      .evaluate(async (singleton, done) => {
        "use strict";
        /** helpers.j **/

        /*#####################################################################*/
        /*#####################################################################*/
        /*#####################################################################*/

        let selectors = {};

        //define selectors
        selectors.variationsContainers =
          "[id^=inline-twister-expander-content] ul";
        selectors.variationsContainer =
          "[id^=inline-twister-expander-content] li";
        selectors.mainVariations = "dimension-value-list-item-square-image";
        selectors.secondaryVariations = "swatch-list-item-text";
        selectors.variationClickable = "span[id]";
        selectors.price = ".priceToPay .a-offscreen";

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
        const sleep = (ms) =>
          new Promise((r) => setTimeout(r, (ms || 1) * 1000));
        //logger

        //dom helpers
        const find = (selector) => document.querySelector(selector);
        const findAll = (selector) =>
          Array.from(document.querySelectorAll(selector));
        /*#####################################################################*/
        /*#####################################################################*/
        /*#####################################################################*/

        //get variations
        function getVariations(selector, toInclude = []) {
          let results = [];
          const selectVariations = document.querySelectorAll(`${selector}`);
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
          let price = document.querySelector(`${selectors.price}`);
          console.log({ price });
          if (!!price) {
            return price.innerText.replace(/[^0-9\.,]/gi, "");
          } else {
            return 0;
          }
        };

        function getProductData() {
          const asinEl = document.querySelector("#ASIN");
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
              stock = find("#availability")
                .innerText.replace(/\D/gi, "")
                .trim();
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

        const hasVariations = document.querySelectorAll(
          selectors.variationsContainers
        ).length;

        console.log(
          "singleton.with_all_variations",
          singleton.with_all_variations
        );
        console.log("hasVariations", hasVariations);

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
        } else if (!!singleton.with_variations && false) {
          try {
            await walkThroughVariations(
              selectors.secondaryVariations,
              async (opt) => {
                console.log(opt);
                if (!hasBeenClicked) {
                  hasBeenClicked = true;
                  opt.click();
                  await sleep(3);
                }

                const variation = {
                  asin: find("#ASIN").value,
                  title: opt
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
              },
              true
            );
          } catch (err) {
            console.log(err);
          }
        } else if (!!singleton.with_variations) {
          try {
            const variations = Array.from(
              document.querySelectorAll(selectors.variationsContainers)
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
        console.log(singleton.data);
        done(null, singleton);
        return singleton;
      }, singleton)
      //.end()
      .then((resp) => {
        log({ resp });
        return resp;
      })
      .catch(console.log);

    let tm = 1;
    setInterval(() => {
      log(`Has passed ${tm} seconds`);
      tm++;
    }, 1000);
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
