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

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const logger = require('morgan');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const { Helper, Security, Factory } = require('@ntlab/express-middleware');
const { ScriptManager, ScriptAsset } = require('@ntlab/ntjs');
const { Assets, CDN } = require('@ntlab/ntjs-assets');

class ExpressApp {

    app = express()

    initialize(options) {
        options = options || {};

        this.app.factory = Factory.SemanticUI;

        // view engine setup
        this.app.set('views', path.join(__dirname, 'views'));
        this.app.set('view engine', 'ejs');

        this.app.use(logger('dev'));
        this.app.use(express.json());
        this.app.use(express.urlencoded({extended: false}));
        this.app.use(express.static(path.join(__dirname, 'public')));
        this.app.use(express.static(Assets));

        // session
        let sessiondir = options.sessiondir || path.join(__dirname, 'sessions');
        let secret = options.sessionsecret || 'nt-sms-gateway';
        this.app.use(session({
                name: 'smsgw',
                store: new FileStore({path: sessiondir}),
                secret: secret,
                resave: false,
                saveUninitialized: false,
                cookie: {
                    maxAge: 3600000
                }
            })
        );

        // security
        this.app.use(Security.core());

        // app helpers
        this.app.use(Helper.core());
        this.app.use(Helper.menu());
        this.app.use(Helper.pager());

        // routes
        this.app.use('/', require('./routes/index'));
        this.app.use('/', require('./routes/security'));
        this.app.use('/', require('./routes/plugin'));

        // catch 404 and forward to error handler
        this.app.use((req, res, next) => {
            next(createError(404));
        });

        // error handler
        this.app.use((err, req, res, next) => {
            // set locals, only providing error in development
            res.locals.message = err.message;
            res.locals.error = req.app.get('env') === 'development' ? err : {};

            // render the error page
            res.status(err.status || 500);
            res.render('error/error');
        });

        ScriptManager.addDefault('SemanticUI');
        ScriptManager.addDefaultAsset(ScriptAsset.STYLESHEET, 'app.css');
        let useCdn = options.useCdn || false;
        if (useCdn) {
            ScriptManager.parseCdn(CDN);
        }

        // relative from layout
        this.app.slots = {
            mainmenu: {
                view: '../slot/mainmenu'
            },
            addons: {
                view: '../slot/addons'
            }
        }
    }

}

let app = null;

function run(options) {
    if (app == null) {
        app = new ExpressApp();
        app.initialize(options);
    }
    return app.app;
}

module.exports = run;