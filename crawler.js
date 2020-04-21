GetEventListeners = function(element) {
  return element._client.send('DOMDebugger.getEventListeners', {
    objectId: element._remoteObject.objectId
  });
};

let customCrawl = async (page, crawl) => {
  let requestedUrls = [];
  await page.setRequestInterception(true);
  RequestHandlerBeforeLoad = function (request) {
    let url = request.url();
    requestedUrls.push(request.url());

    if (['image', 'stylesheet', 'font'].indexOf(request.resourceType()) !== -1) {
      request.abort();
    } else {
      request.continue();
    }
  }
  RequestHandlerAfterLoad = function (request) {
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
  const elementHandles = await page.$$('*');
  let eventHandlersMap = new Map();
  result.evl = await elementHandles.reduce(async function(pre, dom) {
    let pre_sync = await pre;
    let eventListeners = await GetEventListeners(dom);

    if (eventListeners.listeners.length > 0) {
      eventHandlersMap.set(dom, eventListeners.listeners);
    }
    return pre_sync
  }, 0);

  // prevent changing page url
  page.removeListener('request', RequestHandlerBeforeLoad);
  page.on('request', RequestHandlerAfterLoad);

  for (let dom of eventHandlersMap.keys()) {
    let usedEvents = new Set();
    for (let listener of eventHandlersMap.get(dom)) {
      if (usedEvents.has(listener.type)) {
        continue;
      }

      // TODO: use trusted Puppeteer events
      usedEvents.add(listener.type);
      let text = await page.evaluate(function (element, eventType) {
        let event = new Event(eventType);
        element.dispatchEvent(event);
        return element.innerHTML;
      }, dom, listener.type);
    }
  }


  result.requestedUrls = requestedUrls;
  return result;
}

module.exports = {
  'customCrawl': customCrawl,
  'waitUntil': 'networkidle0',
  onSuccess: result => {
    console.log(`Got ${result.evl} for ${result.options.url}.`);
  },
  onError: err => {
    console.log(err);
  },
}