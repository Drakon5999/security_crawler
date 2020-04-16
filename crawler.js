GetEventListeners = function(element) {
  return element._client.send('DOMDebugger.getEventListeners', {
    objectId: element._remoteObject.objectId
  });
};

let customCrawl = async (page, crawl) => {
  // You can access the page object before requests
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.url().endsWith('/')) {
      request.continue();
    } else {
      request.abort();
    }
  });
  // The result contains options, links, cookies and etc.
  const result = await crawl();
  // You can access the page object after requests
  result.content =  await page.content();
  const elementHandles = await page.$$('*');
  result.evl = await elementHandles.reduce(async function(pre, dom) {
    let pre_sync = await pre;
    let eventListeners = await GetEventListeners(dom);

    let clicksListenersCnt = 0;
    if (eventListeners.listeners.length > 0) {
      clicksListenersCnt = eventListeners.listeners.reduce(function (num, listener) {
        return num + (listener.type === "click" ? 1 : 0);
      }, 0)
    }
    if (clicksListenersCnt > 0) {
      console.log(dom.toString());
    }
    pre_sync += clicksListenersCnt;
    return pre_sync
  }, 0);
  // You need to extend and return the crawled result
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