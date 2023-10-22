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

router.get('/login', (req, res, next) => {
    let redir;
    if (req.params.r) {
        redir = req.params.r;
    } else if (req.query.r) {
        redir = req.query.r;
    }
    res.app.slots.mainmenu.enabled = false;
    res.render('security/login', {redirect: redir ? redir : '/'});
});

router.post('/login', (req, res, next) => {
    const result = {
        success: false
    }
    if (req.user.authenticate(req.body.username, req.body.password)) {
        req.user.login();
        result.success = true;
        result.url = req.body.continue ? req.body.continue : '/';
    } else {
        result.error = 'Invalid username and/or password';
    }
    res.json(result);
});

router.get('/logout', (req, res, next) => {
    if (req.user) {
        req.user.logout();
    }
    res.redirect('/');
});

module.exports = router;
