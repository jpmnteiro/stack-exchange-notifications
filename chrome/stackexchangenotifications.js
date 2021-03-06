/*
 * StackExchangeNotifications 0.0.5
 * Copyright (c) 2016 Guilherme Nascimento (brcontainer@yahoo.com.br)
 * Released under the MIT license
 *
 * https://github.com/brcontainer/stack-exchange-notification
 */

(function() {
    "use strict";

    var delay = 60; //In seconds

    var unreadCountsURI = "http://stackexchange.com/topbar/get-unread-counts",
        achievementsURI = "http://stackexchange.com/topbar/achievements",
        inboxURI        = "http://stackexchange.com/topbar/inbox";

    var inbox = 0,
        score = 0;

    var doneCallback = null,
        cssCallback = null,
        isRunning = false,
        timer = null;

    var tmpDom      = document.createElement("div");
    var validAttrs = [ "class", "id", "href" ];
    var cssList = [];

    var utils = {
        "meta": function() {
            var u;

            if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest) {
                var meta = chrome.runtime.getManifest();
                return {
                    "appname": meta.name,
                    "version": meta.version
                };
            }

            return {
                "appname": u,
                "version": u
            }
        },
        "convertResult": function(size) {
            if (size === 0) {
                return "";
            } else if (size < 1000) {
                return String(size);
            }

            return "+1k";
        },
        "removeInvalidAttributes": function(target) {
            var attrs = target.attributes, currentAttr;

            for (var i = attrs.length - 1; i >= 0; i--) {
                currentAttr = attrs[i].name;

                if (attrs[i].specified && validAttrs.indexOf(currentAttr) === -1) {
                    target.removeAttribute(currentAttr);
                }

                if (
                    currentAttr === "href" &&
                    /^(#|javascript[:])/gi.test(target.getAttribute("href"))
                ) {
                    target.parentNode.removeChild(currentAttr);
                }
            }
        },
        "cleanDomString": function(data) {
            tmpDom = (new DOMParser).parseFromString(data, "text/html").body;

            var list, current, currentHref;

            list = tmpDom.querySelectorAll("script,img");

            for (var i = list.length - 1; i >= 0; i--) {
                current = list[i];
                current.parentNode.removeChild(current);
            }

            if (cssCallback !== null) {
                list = tmpDom.querySelectorAll("link[rel=stylesheet]");

                for (i = list.length - 1; i >= 0; i--) {
                    current = list[i];
                    currentHref = current.href;

                    if (currentHref && cssList.indexOf(currentHref) === -1) {
                        cssCallback(currentHref);
                        cssList.push(currentHref);
                    }

                    current.parentNode.removeChild(current);
                }
            }

            list = tmpDom.getElementsByTagName("*");

            for (i = list.length - 1; i >= 0; i--) {
                utils.removeInvalidAttributes(list[i]);
            }

            return tmpDom.innerHTML;
        }
    };

    var noCacheURI = function(uri) {
        return [ uri, "?_=", new Date().getTime() ].join("");
    };

    var headersXhrJson = function(xhr) {
        var headersStr = String(xhr.getAllResponseHeaders()).trim(),
            headersLines = headersStr.split(/\n/),
            current,
            headers = {},
            re = /^([a-z0-9\-]+[:])[\s\S]+$/gi;

        for (var i = headersLines.length - 1; i >= 0; i--) {
            current = headersLines[i];
            headers[ current.replace(/:[\s\S]+$/, "") ] =
                                    current.replace(/^[^:]+:/, "").trim();
        }

        return headers;
    };

    var quickXhr = function(uri, callback) {
        var xhr, completed, isAborted, headers;

        xhr       = new XMLHttpRequest();
        isAborted = false;
        completed = false;

        uri = noCacheURI(uri);

        xhr.open("GET", uri, true);

        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && isAborted === false) {

                completed = true;

                headers = headersXhrJson(xhr);

                if (xhr.status === 0) {
                    setTimeout(function() {
                        callback({ "error": 0 }, headers);
                    }, 200);
                } else {
                    callback(xhr.status === 200 ? xhr.responseText : { "error": xhr.status },
                                headers);
                }

                setTimeout(function() {
                    callback = null;
                    xhr = null;
                }, 1000);
            }
        };

        xhr.send(null);

        return {
            "abort": function() {
                if (completed === false) {
                    isAborted = true;
                    try {
                        xhr.abort();
                    } catch (ee) {}
                }
            }
        };
    };

    var retrieveData = function() {
        quickXhr(unreadCountsURI, trigger);
    };

    var getResult = function(target) {
        var el, result = 0;

        if (target.length > 0) {
            el = target[0];
            if (el.display !== "none") {
                result = parseInt(el.innerHTML);
            }
        }

        return isNaN(result) ? 0 : result;
    };

    var trigger = function(response) {
        var currentDelay = 1000 * delay;

        if (typeof response === "string") {
            var data;

            try {
                data = JSON.parse(response);
            } catch (ee) {}

            if (typeof data.UnreadRepCount !== "undefined") {

                score = parseInt(data.UnreadRepCount);
                inbox = parseInt(data.UnreadInboxCount);

                if (doneCallback !== null) {
                    doneCallback({
                        "score": score,
                        "inbox": inbox
                    });
                }
            }
        } else if (response.error === 0) {
            /*
             * If the internet access fails uses a smaller delay
             */
            currentDelay = 1000;
        }

        timer = setTimeout(retrieveData, currentDelay);
    };

    window.StackExchangeNotifications = {
        "style": function(callback) {
            if (typeof callback === "function") {
                cssCallback = callback;
            }
        },
        "pushs": function(callback) {
            if (false === isRunning && typeof callback === "function") {
                isRunning     = true;
                doneCallback  = callback;
                retrieveData();
            }
        },
        "achievements": function(callback) {
            if (typeof callback === "function") {
                return quickXhr(achievementsURI, callback);
            }
            return null;
        },
        "inbox": function(callback) {
            if (typeof callback === "function") {
                return quickXhr(inboxURI, callback);
            }
            return null;
        },
        "setScore": function(size) {
            if (size % 1 === 0) {
                score = size;
            }
        },
        "setInbox": function(size) {
            if (size > -1 && size % 1 === 0) {
                inbox = size;
            }
        },
        "getScore": function() {
            return score;
        },
        "getInbox": function() {
            return inbox;
        },
        "update": function(reload) {
            if (false === isRunning) {
                return;
            }

            if (reload === true) {
                if (timer !== false) {
                    clearTimeout(timer);
                }

                setTimeout(retrieveData, 1);
            } else if (doneCallback !== null) {
                doneCallback({
                    "score": score,
                    "inbox": inbox
                });
            }
        },
        "saveState": function(key, data) {
            return localStorage.setItem(key, data);
        },
        "restoreState": function(key) {
            var data = localStorage.getItem(key);

            if (data) {
                return data;
            }

            return false;
        },
        "utils": utils
    };
}());
