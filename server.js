"use strict";
let io = require('socket.io').listen(8855);
let CrawlerOptions = require('./crawler')
let DisabledCache = require('./disabled_cache')
const HCCrawler = require('headless-chrome-crawler');

// Навешиваем обработчик на подключение нового клиента
io.sockets.on('connection', async function (socket) {
    let crawler = await HCCrawler.launch({
        customCrawl: CrawlerOptions.customCrawl,
        onSuccess: result => {
            socket.emit("complete", {'result': result, 'url': result.options.url});
            console.log(`Complete ${result.options.url}.`);
            console.timeEnd(result.options.url);
        },
        onError: err => {
            socket.emit("error");
            console.log(err);
        },
        waitUntil: CrawlerOptions.waitUntil,
        jQuery: false,
        retryCount: 0,
        cache: new DisabledCache(),
        obeyRobotsTxt: false
    });

    // let ID = (socket.id).toString().substr(0, 5);
    socket.on('new_task', async function (task) {
        try {
            console.time(task.url);
        } catch (err) {
            console.log("timer already exist")
        }
        console.log('new_task')
        await crawler.queue({
            url: task.url
        });
    });

    socket.emit("ready", {});
    // При отключении клиента - уведомляем остальных
    socket.on('disconnect', async function() {
        console.log('loose connection')
        // await crawler.onIdle();
        await crawler.close();
    });
});
