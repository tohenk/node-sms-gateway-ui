/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2018-2023 Toha <tohenk@yahoo.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const moment = require('moment');

function getQueue(req, res, next) {
    const result = {};
    const term = req.app.term;
    const stor = term.Storage;
    const page = req.params.page || 1;
    const pageSize = 25;
    stor.GwQueue.count().then(count => {
        result.count = count;
        result.items = [];
        let offset = (page - 1) * pageSize;
        stor.GwQueue.findAll({
            order: [['time', 'DESC']],
            offset: offset,
            limit: pageSize
        })
        .then(results => {
            results.forEach(queue => {
                offset++;
                result.items.push({
                    nr: offset,
                    hash: queue.hash,
                    origin: queue.imsi,
                    type: queue.type,
                    address: queue.address,
                    data: queue.data,
                    processed: queue.processed,
                    status: queue.status,
                    time: moment(queue.time).format('DD MMM YYYY HH:mm')
                });
            });
            // create pagination
            result.pages = req.app.locals.pager(result.count, pageSize, page);
            // send content
            res.json(result);
        });
    });
}

function getMessage(req, res, next) {
    const result = {};
    const term = req.app.term;
    const stor = term.Storage;
    const page = req.params.page || 1;
    const pageSize = 25;
    stor.countRecents().then(count => {
        result.count = count.length ? count[0].count : 0;
        result.items = [];
        let offset = (page - 1) * pageSize;
        stor.getRecents(offset, pageSize).then(results => {
            results.forEach(queue => {
                offset++;
                result.items.push({
                    nr: offset,
                    hash: queue.hash,
                    origin: queue.imsi,
                    type: queue.type,
                    address: queue.address,
                    data: queue.data,
                    status: queue.status,
                    code: queue.code,
                    time: moment(queue.time).format('DD MMM YYYY HH:mm')
                });
            });
            // create pagination
            result.pages = req.app.locals.pager(result.count, pageSize, page);
            // send content
            res.json(result);
        });
    });
}

function readMessage(req, res, next) {
    const result = {};
    const term = req.app.term;
    const stor = term.Storage;
    stor.GwQueue.findAll({
        where: {
            address: req.params.number,
            type: {[stor.Sequelize.Op.in]: [stor.ACTIVITY_SMS, stor.ACTIVITY_INBOX]}
        },
        order: [['time', 'ASC']]
    })
    .then(results => {
        const messages = {};
        results.forEach(GwQueue => {
            messages[GwQueue.hash] = {
                imsi: GwQueue.imsi,
                operator: term.getNetworkOperator(GwQueue.imsi),
                hash: GwQueue.hash,
                type: GwQueue.type,
                message: GwQueue.data,
                processed: GwQueue.processed,
                status: GwQueue.status,
                code: null,
                time: GwQueue.time
            };
        });
        return messages;
    })
    .then(messages => {
        stor.GwLog.findAll({
            where: {
                address: req.params.number,
                type: stor.ACTIVITY_SMS
            }
        })
        .then(results => {
            results.forEach(GwLog => {
                messages[GwLog.hash].code = GwLog.code;
            });
            Object.values(messages).forEach(msg => {
                const time = moment(msg.time).format('DD MMM YYYY');
                if (!result[time]) result[time] = [];
                result[time].push(msg);
            });
            // send content
            res.json(result);
        });
    });
}

function getActivityLog(req, res, next) {
    const term = req.app.term;
    const result = {
        time: Date.now(),
        logs: fs.readFileSync(term.logfile).toString()
    }
    res.json(result);
}

function getParameters(data) {
    const result = {};
    const re = /(\]\[|\]|\[)/g;
    Object.keys(data).forEach(key => {
        let isarray = false;
        let str = key;
        if ('[]' == str.substr(-2)) {
            isarray = true;
            str = str.substr(0, str.length - 2);
        }
        str = str.replace(re, '.');
        if ('.' == str.substr(-1)) str = str.substr(0, str.length - 1);
        const paths = str.split('.');
        let top = result;
        for (let i = 0; i < paths.length; i++) {
            const p = paths[i];
            if (i == paths.length - 1) {
                let value = data[key];
                if (value == 'on' || value == 'true') value = true;
                if (value == 'off' || value == 'false') value = false;
                if (isarray) {
                    if (Array.isArray(value)) {
                        top[p] = value;
                    } else {
                        if (typeof top[p] == 'undefined') top[p] = [];
                        top[p].push(value);
                    }
                } else {
                    top[p] = value;
                }
            } else {
                if (typeof top[p] == 'undefined') top[p] = {};
                top = top[p];
            }
        }
    });
    return result;
}

/* GET home page. */
router.get('/', (req, res, next) => {
    res.render('index/index', {
        title: 'Dashboard',
        sockaddress: `${req.protocol}://${req.get('host')}/ui`
    });
});

router.get('/about', (req, res, next) => {
    let about;
    if (req.app.about) {
        about = req.app.about;
    } else {
        const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json')));
        about = {
            title: packageInfo.description,
            version: packageInfo.version,
            author: packageInfo.author.name ? packageInfo.author.name + ' <' + packageInfo.author.email + '>' : packageInfo.author,
            license: packageInfo.license
        }
    }
    res.json(about);
});

router.get('/queue', (req, res, next) => {
    getQueue(req, res, next);
});

router.get('/queue/:page', (req, res, next) => {
    getQueue(req, res, next);
});

router.get('/message', (req, res, next) => {
    getMessage(req, res, next);
});

router.get('/message/:page', (req, res, next) => {
    getMessage(req, res, next);
});

router.get('/read/:number', (req, res, next) => {
    readMessage(req, res, next);
});

router.get('/activity-log', (req, res, next) => {
    getActivityLog(req, res, next);
});

router.get('/client', (req, res, next) => {
    const result = [];
    const term = req.app.term;
    let nr = 0;
    term.gwclients.forEach(socket => {
        const info = {
            nr: ++nr,
            id: socket.id,
            address: socket.handshake.address,
            time: socket.time ? moment(socket.time).format('DD MMM YYYY HH:mm') : null,
            group: socket.group
        }
        result.push(info);
    });
    res.json({count: result.length, items: result});
});

router.post('/send-message', (req, res, next) => {
    const result = {};
    const term = req.app.term;
    const stor = term.Storage;
    if (req.body.number && req.body.message) {
        term.dispatcher.add({
            type: stor.ACTIVITY_SMS,
            address: req.body.number,
            data: req.body.message
        }, null, queue => {
            result.success = queue ? true : false;
            if (result.success) {
                result.notice = 'Your message has successfully queued as ' + queue.hash + '.';
            } else {
                result.error = 'Can\'t sent message.';
            }
            res.json(result);
        });
    } else {
        next();
    }
});

router.post('/:imsi/apply', (req, res, next) => {
    const term = req.app.term;
    const terminal = term.get(req.params.imsi);
    if (terminal) {
        const parameters = getParameters(req.body);
        const result = {};
        if (isNaN(parameters.term.priority)) {
            result.success = false;
        } else {
            // check boolean operators
            const options = terminal.defaultOptions();
            Object.keys(options).forEach(opt => {
                if (typeof options[opt] == 'boolean' && !parameters.term[opt]) {
                    parameters.term[opt] = false;
                }
            });
            parameters.term.priority = parseInt(parameters.term.priority);
            if (!parameters.term.operators) parameters.term.operators = [];
            terminal.readOptions(parameters.term);
            result.success = true;
            result.notice = 'Your changes has been successfuly applied.';
        }
        res.json(result);
    } else {
        next();
    }
});

router.get('/:imsi/config', (req, res, next) => {
    const term = req.app.term;
    const terminal = term.get(req.params.imsi);
    if (terminal) {
        res.json(terminal.options);
    } else {
        next();
    }
});

router.post('/:imsi/dial', (req, res, next) => {
    const result = {};
    const term = req.app.term;
    const terminal = term.get(req.params.imsi);
    if (terminal && req.body.number) {
        terminal.addCallQueue(req.body.number, queue => {
            result.success = queue ? true : false;
            if (result.success) {
                result.notice = 'Your call has successfully queued as ' + queue.hash + '.';
            } else {
                result.error = 'Can\'t place call queue.';
            }
            res.json(result);
        });
    } else {
        next();
    }
});

router.post('/:imsi/message', (req, res, next) => {
    const result = {};
    const term = req.app.term;
    const terminal = term.get(req.params.imsi);
    if (terminal && req.body.number && req.body.message) {
        terminal.addMessageQueue(req.body.number, req.body.message, queue => {
            result.success = queue ? true : false;
            if (result.success) {
                result.notice = 'Your message has successfully queued as ' + queue.hash + '.';
            } else {
                result.error = 'Can\'t place message queue.';
            }
            res.json(result);
        });
    } else {
        next();
    }
});

router.post('/:imsi/ussd', (req, res, next) => {
    const result = {};
    const term = req.app.term;
    const terminal = term.get(req.params.imsi);
    if (terminal && req.body.service) {
        terminal.addUssdQueue(req.body.service, queue => {
            result.success = queue ? true : false;
            if (result.success) {
                result.notice = 'Your USSD has successfully queued as ' + queue.hash + '.';
            } else {
                result.error = 'Can\'t place USSD queue.';
            }
            res.json(result);
        });
    } else {
        next();
    }
});

router.post('/tasks/:name', (req, res, next) => {
    const result = {
        success: false
    }
    const term = req.app.term;
    switch (req.params.name) {
        case 'readmsg':
            if (req.body.type) {
                term.pools.forEach(pool => {
                    if (pool.con) pool.con.emit('check-message', req.body.type);
                });
                result.success = term.pools.length ? true : false;
            }
            break;
        case 'resendmsg':
            if (req.body.since) {
                term.pools.forEach(pool => {
                    if (pool.con) pool.con.emit('resend-message', req.body.since);
                });
                result.success = term.pools.length ? true : false;
            }
            break;
        case 'report':
            if (req.body.since) {
                term.pools.forEach(pool => {
                    if (pool.con) pool.con.emit('check-report', req.body.since);
                });
                result.success = term.pools.length ? true : false;
            }
            break;
    }
    res.json(result);
});

module.exports = router;
