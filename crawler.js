const Utils = require('./utils')
const uniq = require('lodash/uniq');
const helper = require('headless-chrome-crawler/lib/helper');

GetEventListeners = function(element) {
  return element._client.send('DOMDebugger.getEventListeners', {
    objectId: element._remoteObject.objectId
  });
};

async function* ElementHandelGenerator(ArrayJsHandle, page) {
  let arrayLen = await page.evaluate(a => a.length, ArrayJsHandle);
  for (let i = 0; i < arrayLen; i++) {
    yield await page.evaluateHandle(function (arr, i) {
      return arr[i];
    }, ArrayJsHandle, i)
  }
}

async function GetLinks(page) {
  const current_url = page.url()
  const JsArrayHandle = await page.evaluateHandle(Utils.collectAllElementsDeep,'a');

  const elementHandlesGenerator = await ElementHandelGenerator(JsArrayHandle, page);
  const elementHandles = [];
  for await (let dom of elementHandlesGenerator) {
    elementHandles.push(dom);
  }

  const propertyJsHandles = await Promise.all(
      elementHandles.map(handle => handle.getProperty('href'))
  );
  const hrefs = await Promise.all(
      propertyJsHandles.map(handle => handle.jsonValue())
  );

  let filtered = hrefs.filter(function (el) {
    return el != null && el != "";
  });
  let resultUrls = filtered.map(href => helper.resolveUrl(href, current_url))
  return uniq(resultUrls);
}


let customCrawl = async (page, crawl) => {
  let requestedUrls = [];
  await page.setRequestInterception(true);
  let RequestHandlerBeforeLoad = function (request) {
    let url = request.url();
    requestedUrls.push(request.url());

    if (['image', 'stylesheet', 'font'].indexOf(request.resourceType()) !== -1) {
      request.abort();
    } else {
      request.continue();
    }
  }
  let RequestHandlerAfterLoad = function (request) {
    let url = request.url();
    requestedUrls.push(request.url());

    if (['image', 'stylesheet', 'font'].indexOf(request.resourceType()) !== -1 || request.isNavigationRequest()) {
      request.abort();
    } else {
      request.continue();
    }
  }
  page.on('request', RequestHandlerBeforeLoad);

  const result = await crawl();
  result.content = await page.content();
  console.log(requestedUrls)
  let jsArrayHandle = await page.evaluateHandle(Utils.collectAllElementsDeep);
  let eventHandlersMap = new Map();
  let ElementsHandle = await ElementHandelGenerator(jsArrayHandle, page);

  for await (let dom of ElementsHandle) {
    let eventListeners = await GetEventListeners(dom);

    if (eventListeners.listeners.length > 0) {
      eventHandlersMap.set(dom, eventListeners.listeners);
    }
  }

  result.urlChanges = []
  // prevent changing page url
  page.removeListener('request', RequestHandlerBeforeLoad);
  page.on('request', RequestHandlerAfterLoad);

  for (let dom of eventHandlersMap.keys()) {
    let usedEvents = new Set();
    for (let listener of eventHandlersMap.get(dom)) {
      if (usedEvents.has(listener.type)) {
        continue;
      }
      let currPageUrl = page.url()
      // TODO: use trusted Puppeteer events
      usedEvents.add(listener.type);
      await page.evaluate(function (element, eventType) {
        let event = new Event(eventType);
        element.dispatchEvent(event);
        return element.innerHTML;
      }, dom, listener.type);
      if (page.url() !== currPageUrl) {
        result.urlChanges.push(page.url());
      }
    }
  }

  // we may find not all links. Try again for the same case
  result.links = uniq(result.links.concat(await GetLinks(page)))

  result.requestedUrls = requestedUrls;
  return result;
}

module.exports = {
  'customCrawl': customCrawl,
  'waitUntil': 'networkidle2',
  onSuccess: result => {
    console.log(`Got ${result.evl} for ${result.options.url}.`);
  },
  onError: err => {
    console.log(err);
  },
}