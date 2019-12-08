/**
 MIT License

 Copyright (c) 2019 박찬솔

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.

 */

const request = require("request");
const cheerio = require("cheerio");
const fs = require("fs");

const root = "https://codeup.kr/";

const auth = require("./auth");

const replace = {
    "C": "c",
    "C++": "cpp",
    "Python": "py",
    "Java": "java"
};

deleteFolderRecursive = function (path) {
    let files = [];
    if (fs.existsSync(path)) {
        files = fs.readdirSync(path);
        files.forEach(function (file) {
            var curPath = path + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};

if (fs.existsSync(__dirname + "/code/")) {
    deleteFolderRecursive(__dirname + "/code");
}
fs.mkdirSync(__dirname + "/code/");

request.post(`${root}/login.php`, {
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `user_id=${auth.id}&password=${auth.password}`
}, (err, res, body) => {
    if (err) {
        console.log(err);
        return;
    }

    let cookie = res.headers["set-cookie"].shift();
    //console.log(cookie)
    let login_token = cookie.substr("PHPSESSID=".length, cookie.indexOf(";") - "PHPSESSID=".length);

    request.get(`${root}userinfo.php?user=chansol`, {
        headers: {
            "cookie": [`PHPSESSID=${login_token}`]
        }
    }, async (e, r, b) => {
        var $ = cheerio.load(b);
        let solved = $(".jumbotron > small")[0].children;
        console.log(`푼 문제 수 : ${Math.floor(solved.length / 2)}`);
        let num = 0;
        for (let p of solved) {
            if (p.attribs !== undefined && p.attribs.href !== undefined) {
                if (!fs.existsSync(__dirname + "/code/" + p.children[0].data)) {
                    fs.mkdirSync(__dirname + "/code/" + p.children[0].data);
                }
                console.log(`${p.children[0].data}번 조회 중... (${Math.round(++num / Math.floor(solved.length / 2) * 100)}% 완료)`);
                await new Promise(res => {
                    request(root + p.attribs.href, {
                        headers: {
                            "cookie": [`PHPSESSID=${login_token}`]
                        }
                    }, async (e, r, b) => {
                        var $ = cheerio.load(b);
                        let list = Object.values($(".card-header > a.btn.btn-sm.btn-primary")), i = 1;
                        for (let p of list) {
                            if (p.attribs === undefined || p.attribs.href === undefined) continue;
                            await new Promise(res1 => {
                                request.post(root + p.attribs.href, {
                                    headers: {
                                        "cookie": [`PHPSESSID=${login_token}`]
                                    }
                                }, async (e, r, b) => {
                                    var $ = cheerio.load(b);
                                    let status = $(".alert.alert-info.mt-1.pb-0 > p").text().split("/");
                                    fs.writeFileSync(
                                        `${__dirname}/code/${parseInt(status[0])}/${parseInt(status[0])}_${i++}.${replace[status[2].trim()]}`,
                                        "/**************************************************************\n" +
                                        status.map(v => v.trim()).join("\n") +
                                        "\n****************************************************************/\n\n\n" +
                                        $("#source").text());
                                    res1();
                                })
                            });
                        }
                        res();
                    });
                });
            }
        }
    })
});