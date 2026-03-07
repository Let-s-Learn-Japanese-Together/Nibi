// Minimal XMLHttpRequest polyfill for environments like Cloudflare Workers
// where `fetch` is available but `XMLHttpRequest` is not.  Kuromoji's browser
// dictionary loader relies on XHR when the package is bundled using the
// "browser" field, which Wrangler/esbuild does for Workers builds.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (globalThis as any).XMLHttpRequest === "undefined") {
  class XHR {
    onload: (() => void) | null = null;
    onerror: ((err: any) => void) | null = null;
    status = 0;
    responseType = "";
    response: any = null;
    private _method = "GET";
    private _url = "";

    open(method: string, url: string) {
      this._method = method;
      this._url = url;
    }

    setRequestHeader(_name: string, _value: string) {
      // no-op; headers are not needed for dictionary downloads
    }

    send(body?: any) {
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
          if (this.onload) this.onload();
        })
        .catch((err) => {
          if (this.onerror) this.onerror(err);
        });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).XMLHttpRequest = XHR as any;
}
