import {endsWith, getRootPath} from '../utils/string';
import {MultiProgressHandler} from '../utils/progress';
import {getFileListFromDicomDir} from '../dicom/dicomElementsWrapper';
import {loaderList} from './loaderList';

// url content types
export const urlContentTypes = {
  Text: 0,
  ArrayBuffer: 1
};

/**
 * Urls loader.
 */
export class UrlsLoader {

  /**
   * Input data.
   *
   * @private
   * @type {Array}
   */
  #inputData = null;

  /**
   * Array of launched requests.
   *
   * @private
   * @type {Array}
   */
  #requests = [];

  /**
   * Data loader.
   *
   * @private
   * @type {object}
   */
  #runningLoader = null;

  /**
   * Number of loaded data.
   *
   * @private
   * @type {number}
   */
  #nLoad = 0;

  /**
   * Number of load end events.
   *
   * @private
   * @type {number}
   */
  #nLoadend = 0;

  /**
   * Flag to know if the load is aborting.
   *
   * @private
   * @type {boolean}
   */
  #aborting;

  /**
   * The default character set (optional).
   *
   * @private
   * @type {string}
   */
  #defaultCharacterSet;

  /**
   * Get the default character set.
   *
   * @returns {string} The default character set.
   */
  getDefaultCharacterSet() {
    return this.#defaultCharacterSet;
  }

  /**
   * Set the default character set.
   *
   * @param {string} characterSet The character set.
   */
  setDefaultCharacterSet(characterSet) {
    this.#defaultCharacterSet = characterSet;
  }

  /**
   * Store the current input.
   *
   * @param {object} data The input data.
   * @private
   */
  #storeInputData(data) {
    this.#inputData = data;
    // reset counters
    this.#nLoad = 0;
    this.#nLoadend = 0;
    // reset flag
    this.#aborting = false;
    // clear storage
    this.#clearStoredRequests();
    this.#clearStoredLoader();
  }

  /**
   * Store a launched request.
   *
   * @param {object} request The launched request.
   * @private
   */
  #storeRequest(request) {
    this.#requests.push(request);
  }

  /**
   * Clear the stored requests.
   *
   * @private
   */
  #clearStoredRequests() {
    this.#requests = [];
  }

  /**
   * Store the launched loader.
   *
   * @param {object} loader The launched loader.
   * @private
   */
  #storeLoader(loader) {
    this.#runningLoader = loader;
  }

  /**
   * Clear the stored loader.
   *
   * @private
   */
  #clearStoredLoader() {
    this.#runningLoader = null;
  }

  /**
   * Launch a load item event and call addLoad.
   *
   * @param {object} event The load data event.
   * @private
   */
  #addLoadItem = (event) => {
    this.onloaditem(event);
    this.#addLoad();
  };

  /**
   * Increment the number of loaded data
   *   and call onload if loaded all data.
   *
   * @param {object} _event The load data event.
   * @private
   */
  #addLoad = (_event) => {
    this.#nLoad++;
    // call onload when all is loaded
    // (not using the input event since it is not the
    //   general load)
    if (this.#nLoad === this.#inputData.length) {
      this.onload({
        source: this.#inputData
      });
    }
  };

  /**
   * Increment the counter of load end events
   *   and run callbacks when all done, erroneus or not.
   *
   * @param {object} _event The load end event.
   * @private
   */
  #addLoadend = (_event) => {
    this.#nLoadend++;
    // call onloadend when all is run
    // (not using the input event since it is not the
    //   general load end)
    // x2 to count for request + load
    if (this.#nLoadend === 2 * this.#inputData.length) {
      this.onloadend({
        source: this.#inputData
      });
    }
  };

  /**
   * Augment a callback event with a srouce.
   *
   * @param {object} callback The callback to augment its event.
   * @param {object} source The source to add to the event.
   * @returns {Function} The augmented callback.
   * @private
   */
  #augmentCallbackEvent(callback, source) {
    return (event) => {
      event.source = source;
      callback(event);
    };
  }

  /**
   * Load a list of URLs or a DICOMDIR.
   *
   * @param {Array} data The list of urls to load.
   * @param {object} options Load options.
   */
  load(data, options) {
    // send start event
    this.onloadstart({
      source: data
    });

    // check if DICOMDIR case
    if (data.length === 1 &&
      (endsWith(data[0], 'DICOMDIR') ||
      endsWith(data[0], '.dcmdir'))) {
      this.#loadDicomDir(data[0], options);
    } else {
      this.#loadUrls(data, options);
    }
  }

  /**
   * Load a list of urls.
   *
   * @param {Array} data The list of urls to load.
   * @param {object} options The options object, can contain:
   *  - requestHeaders: an array of {name, value} to use as request headers
   *  - withCredentials: boolean xhr.withCredentials flag to pass
   *    to the request
   *  - batchSize: the size of the request url batch
   * @private
   */
  #loadUrls(data, options) {
    // check input
    if (typeof data === 'undefined' || data.length === 0) {
      return;
    }
    this.#storeInputData(data);

    // create prgress handler
    const mproghandler = new MultiProgressHandler(this.onprogress);
    mproghandler.setNToLoad(data.length);

    // create loaders
    const loaders = [];
    for (let m = 0; m < loaderList.length; ++m) {
      loaders.push(new loaderList[m]());
    }

    // find an appropriate loader
    let dataElement = data[0];
    let loader = null;
    let foundLoader = false;
    for (let l = 0; l < loaders.length; ++l) {
      loader = loaders[l];
      if (loader.canLoadUrl(dataElement, options)) {
        foundLoader = true;
        // load options
        loader.setOptions({
          numberOfFiles: data.length,
          defaultCharacterSet: this.getDefaultCharacterSet()
        });
        // set loader callbacks
        // loader.onloadstart: nothing to do
        loader.onprogress = mproghandler.getUndefinedMonoProgressHandler(1);
        if (typeof loader.onloaditem === 'undefined') {
          // handle loaditem locally
          loader.onload = this.#addLoadItem;
        } else {
          loader.onloaditem = this.onloaditem;
          loader.onload = this.#addLoad;
        }
        loader.onloadend = this.#addLoadend;
        loader.onerror = this.onerror;
        loader.onabort = this.onabort;

        // store loader
        this.#storeLoader(loader);
        // exit
        break;
      }
    }
    if (!foundLoader) {
      throw new Error('No loader found for url: ' + dataElement);
    }

    const getLoadHandler = function (loader, dataElement, i) {
      return (event) => {
        // check response status
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Response_codes
        // status 200: "OK"; status 0: "debug"
        const status = event.target.status;
        if (status !== 200 && status !== 0) {
          this.onerror({
            source: dataElement,
            error: 'GET ' + event.target.responseURL +
              ' ' + event.target.status +
              ' (' + event.target.statusText + ')',
            target: event.target
          });
          this.#addLoadend();
        } else {
          loader.load(event.target.response, dataElement, i);
        }
      };
    };

    // store last run request index
    let lastRunRequestIndex = 0;
    const requestOnLoadEnd = () => {
      this.#addLoadend();
      // launch next in queue
      if (lastRunRequestIndex < this.#requests.length - 1 && !this.#aborting) {
        ++lastRunRequestIndex;
        this.#requests[lastRunRequestIndex].send(null);
      }
    };

    // loop on I/O elements
    for (let i = 0; i < data.length; ++i) {
      dataElement = data[i];

      // check loader
      if (!loader.canLoadUrl(dataElement, options)) {
        throw new Error('Input url of different type: ' + dataElement);
      }
      /**
       * The http request.
       *
       * @external XMLHttpRequest
       * @see https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
       */
      const request = new XMLHttpRequest();
      request.open('GET', dataElement, true);

      // request options
      if (typeof options !== 'undefined') {
        // optional request headers
        if (typeof options.requestHeaders !== 'undefined') {
          const requestHeaders = options.requestHeaders;
          for (let j = 0; j < requestHeaders.length; ++j) {
            if (typeof requestHeaders[j].name !== 'undefined' &&
              typeof requestHeaders[j].value !== 'undefined') {
              request.setRequestHeader(
                requestHeaders[j].name, requestHeaders[j].value);
            }
          }
        }
        // optional withCredentials
        // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/withCredentials
        if (typeof options.withCredentials !== 'undefined') {
          request.withCredentials = options.withCredentials;
        }
      }

      // set request callbacks
      // request.onloadstart: nothing to do
      request.onprogress = this.#augmentCallbackEvent(
        mproghandler.getMonoProgressHandler(i, 0), dataElement);
      request.onload = getLoadHandler(loader, dataElement, i);
      request.onloadend = requestOnLoadEnd;
      request.onerror = this.#augmentCallbackEvent(this.onerror, dataElement);
      request.onabort = this.#augmentCallbackEvent(this.onabort, dataElement);
      // response type (default is 'text')
      if (loader.loadUrlAs() === urlContentTypes.ArrayBuffer) {
        request.responseType = 'arraybuffer';
      }

      // store request
      this.#storeRequest(request);
    }

    // launch requests in batch
    let batchSize = this.#requests.length;
    if (typeof options !== 'undefined') {
      // optional request batch size
      if (typeof options.batchSize !== 'undefined' && batchSize !== 0) {
        batchSize = Math.min(options.batchSize, this.#requests.length);
      }
    }
    for (let r = 0; r < batchSize; ++r) {
      if (!this.#aborting) {
        lastRunRequestIndex = r;
        this.#requests[lastRunRequestIndex].send(null);
      }
    }
  }

  /**
   * Load a DICOMDIR.
   *
   * @param {string} dicomDirUrl The DICOMDIR url.
   * @param {object} options Load options.
   * @private
   */
  #loadDicomDir(dicomDirUrl, options) {
    // read DICOMDIR
    const request = new XMLHttpRequest();
    request.open('GET', dicomDirUrl, true);
    request.responseType = 'arraybuffer';
    // request.onloadstart: nothing to do
    request.onload = (event) => {
      // check status
      const status = event.target.status;
      if (status !== 200 && status !== 0) {
        this.onerror({
          source: dicomDirUrl,
          error: 'GET ' + event.target.responseURL +
                        ' ' + event.target.status +
                        ' (' + event.target.statusText + ')',
          target: event.target
        });
        this.onloadend({});
        return;
      }
      // get the file list
      const list = getFileListFromDicomDir(event.target.response);
      // use the first list
      const urls = list[0][0];
      // append root url
      const rootUrl = getRootPath(dicomDirUrl);
      const fullUrls = [];
      for (let i = 0; i < urls.length; ++i) {
        fullUrls.push(rootUrl + '/' + urls[i]);
      }
      // load urls
      this.#loadUrls(fullUrls, options);
    };
    request.onerror = (event) => {
      this.#augmentCallbackEvent(this.onerror, dicomDirUrl)(event);
      this.onloadend({});
    };
    request.onabort = (event) => {
      this.#augmentCallbackEvent(this.onabort, dicomDirUrl)(event);
      this.onloadend({});
    };
    // request.onloadend: nothing to do
    // send request
    request.send(null);
  }

  /**
   * Abort a load.
   */
  abort() {
    this.#aborting = true;
    // abort non finished requests
    for (let i = 0; i < this.#requests.length; ++i) {
      // 0: UNSENT, 1: OPENED, 2: HEADERS_RECEIVED (send()), 3: LOADING, 4: DONE
      if (this.#requests[i].readyState !== 4) {
        this.#requests[i].abort();
      }
    }
    // abort loader
    if (this.#runningLoader && this.#runningLoader.isLoading()) {
      this.#runningLoader.abort();
    }
  }

  /**
   * Handle a load start event.
   * Default does nothing.
   *
   * @param {object} _event The load start event.
   */
  onloadstart(_event) {}

  /**
   * Handle a load progress event.
   * Default does nothing.
   *
   * @param {object} _event The progress event.
   */
  onprogress(_event) {}

  /**
   * Handle a load item event.
   * Default does nothing.
   *
   * @param {object} _event The load item event fired
   *   when a file item has been loaded successfully.
   */
  onloaditem(_event) {}

  /**
   * Handle a load event.
   * Default does nothing.
   *
   * @param {object} _event The load event fired
   *   when a file has been loaded successfully.
   */
  onload(_event) {}

  /**
   * Handle a load end event.
   * Default does nothing.
   *
   * @param {object} _event The load end event fired
   *  when a file load has completed, successfully or not.
   */
  onloadend(_event) {}

  /**
   * Handle an error event.
   * Default does nothing.
   *
   * @param {object} _event The error event.
   */
  onerror(_event) {}

  /**
   * Handle an abort event.
   * Default does nothing.
   *
   * @param {object} _event The abort event.
   */
  onabort(_event) {}

} // class UrlsLoader
