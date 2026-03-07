"use strict";
/* eslint-disable @typescript-eslint/no-unused-vars */
// Minimal XMLHttpRequest polyfill for environments like Cloudflare Workers
// where `fetch` is available but `XMLHttpRequest` is not.  Kuromoji's browser
// dictionary loader relies on XHR when the package is bundled using the
// "browser" field, which Wrangler/esbuild does for Workers builds.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof globalThis.XMLHttpRequest === "undefined") {
    class XHR {
        constructor() {
            this.onload = null;
            this.onerror = null;
            this.status = 0;
            this.responseType = "";
            this.response = null;
            this._method = "GET";
            this._url = "";
        }
        open(method, url) {
            this._method = method;
            this._url = url;
        }
        setRequestHeader(_name, _value) {
            // no-op; headers are not needed for dictionary downloads
        }
        send(body) {
            fetch(this._url, { method: this._method, body })
                .then(async (res) => {
                this.status = res.status;
                if (this.responseType === "arraybuffer") {
                    return res.arrayBuffer();
                }
                if (this.responseType === "blob") {
                    return res.blob();
                }
                return res.text();
            })
                .then((data) => {
                this.response = data;
                if (this.onload)
                    this.onload();
            })
                .catch((err) => {
                if (this.onerror)
                    this.onerror(err);
            });
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.XMLHttpRequest = XHR;
}
