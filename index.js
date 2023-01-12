const Nightmare = require("nightmare");
const express = require("express");
const { log } = require("./utils/helpers");

const app = express();
const PORT = process.env.PORT || 3000;
const base_url = "https://www.amazon.es";

const singleton = {}; 
singleton.data = {};

const getMeTheAmazonProductData = async (
  asin,
  with_variations,
  with_all_variations
) => {
  try {
    
const nightmare = Nightmare({
  /*
  openDevTools: {
    mode: "atach",
  },
  show: true,
  */
  executionTimeout: 1000 * 60 * 20, // in ms
});
    singleton.with_variations = with_variations;
    singleton.with_all_variations = with_all_variations;
    return await nightmare
      .goto(`${base_url}/gp/product/${asin}`)
      /*
  .evaluate(() => {
      //solve captcha if appears
      const catpchaSolver = (urlImage) => {
        var myHeaders = new Headers();
        myHeaders.append("apikey", "pkNZ6YtTC23MMR9Uocq9gf6C7somGiMk");

        var requestOptions = {
          method: "GET",
          redirect: "follow",
          headers: myHeaders,
        };

        fetch(
          "https://api.apilayer.com/image_to_text/url?url=" +
            encodeURIComponent(urlImage),
          requestOptions
        )
          .then((response) => response.json())
          .then((result) => {
            document.querySelector(
              'form[action="/errors/validateCaptcha"] input[name=field-keywords]'
            ).value = result.all_text;
            document.querySelector('form[action="/errors/validateCaptcha"]').submit();
          })
          .catch((error) => log(error, "error"));
      };

      let captcha = document.querySelector(
        'form[action="/errors/validateCaptcha"] img'
      )?.src;

      if (captcha) {
        catpchaSolver(captcha);
      }
      return captcha;
  })
  */
      //.wait(1600)
      //.select("#native_dropdown_selected_size_name", "0,B09RBVJGPH")
      .evaluate(async (singleton, done) => {
        "use strict";
        /** helpers.j **/
        const log = console.log;
        function ValidURL(str) {
          var pattern = new RegExp(
            "^(https?:\\/\\/)?" + // protocol
              "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|" + // domain name
              "((\\d{1,3}\\.){3}\\d{1,3}))" + // OR ip (v4) address
              "(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" + // port and path
              "(\\?[;&a-z\\d%_.~+=-]*)?" + // query string
              "(\\#[-a-z\\d_]*)?$",
            "i"
          ); // fragment locator
          return !!pattern.test(str);
        }

        function isImageURL(url) {
          return url.match(/\.(jpeg|jpg|gif|png)$/) != null;
        }

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
                stock = "AGOTADO"
              };
            } catch (err) {
              console.log(err);
            }

            if (!stock) stock = 1;

            //images preload
            const images = [];
            /*
      const __images = findAll("#altImages img").map((item) => {
        let uri = item.src.substr(item.src.lastIndexOf("/") + 1);
        return uri.substr(0, uri.indexOf("."));
      });

      const images = find("body").innerHTML.match(/(?<="hiRes":")([^"]+)(?=")/gi)
        .map((v) => {
          return decodeURIComponent(v);
        })
        .filter((v, i, s) => {
          return s.indexOf(v) === i;
        })
        .filter((v, i, s) => {
          return ValidURL(v) && isImageURL(v);
        })
        .filter((v, i, s) => {
          let uri = v.substr(v.lastIndexOf("/") + 1);
          let uni = uri.substr(0, uri.indexOf("."));
          return __images.includes(uni);
        });
        */
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
            
        console.log("singleton.with_all_variations", singleton.with_all_variations);
        console.log("hasVariations", hasVariations);

        if (!!singleton.with_all_variations && hasVariations >= 2) {
          try {
            console.log("Get all combinations of variations")
            await walkThroughVariations(
              selectors.mainVariations,
              async (o) => {
                hasBeenClicked = false;

                title = o.querySelector(".swatch-title-text-display")
                  ? o.querySelector(".swatch-title-text-display")
                      .innerText.trim()+ " "
                  : "";
                console.log("getting combinations for variation "+ title)
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
            const variations = Array.from(document.querySelectorAll(
              selectors.variationsContainers
            ));
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
                title: title +" "+ opt
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
      .catch(console.log);
  } catch (err) {
    log(err);
  }
};

app.use(express.json());

app.get("/", (req, res) => {
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