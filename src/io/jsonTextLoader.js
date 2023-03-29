import {startsWith, getFileExtension} from '../utils/string';
import {getUrlFromUri} from '../utils/uri';
import {fileContentTypes} from './filesLoader';
import {urlContentTypes} from './urlsLoader';

/**
 * JSON text loader.
 *
 * @class
 */
export class JSONTextLoader {

  /**
   * Loading flag.
   *
   * @private
   * @type {boolean}
   */
  #isLoading = false;

  /**
   * Set the loader options.
   *
   * @param {object} _opt The input options.
   */
  setOptions(_opt) {
    // does nothing
  }

  /**
   * Is the load ongoing?
   *
   * @returns {boolean} True if loading.
   */
  isLoading() {
    return this.#isLoading;
  }

  /**
   * Load data.
   *
   * @param {object} text The input text.
   * @param {string} origin The data origin.
   * @param {number} index The data index.
   */
  load(text, origin, index) {
    // set loading flag
    this.#isLoading = true;
    this.onloadstart({
      source: origin
    });

    try {
      this.onprogress({
        lengthComputable: true,
        loaded: 100,
        total: 100,
        index: index,
        source: origin
      });
      this.onload({
        data: text,
        source: origin
      });
    } catch (error) {
      this.onerror({
        error: error,
        source: origin
      });
    } finally {
      // reset loading flag
      this.#isLoading = false;
      this.onloadend({
        source: origin
      });
    }
  }

  /**
   * Abort load: pass to listeners.
   */
  abort() {
    // reset loading flag
    this.#isLoading = false;
    // call listeners
    this.onabort({});
    this.onloadend({});
  }

  /**
   * Check if the loader can load the provided file.
   *
   * @param {object} file The file to check.
   * @returns {boolean} True if the file can be loaded.
   */
  canLoadFile(file) {
    const ext = getFileExtension(file.name);
    return (ext === 'json');
  }

  /**
   * Check if the loader can load the provided url.
   *
   * @param {string} url The url to check.
   * @param {object} options Optional url request options.
   * @returns {boolean} True if the url can be loaded.
   */
  canLoadUrl(url, options) {
    // if there are options.requestHeader, just base check on them
    if (typeof options !== 'undefined' &&
      typeof options.requestHeaders !== 'undefined') {
      // starts with 'application/json' or 'application/dicom+json
      const isJson = function (element) {
        return element.name === 'Accept' &&
          startsWith(element.value, 'application/json') &&
          startsWith(element.value, 'application/dicom+json');
      };
      return typeof options.requestHeaders.find(isJson) !== 'undefined';
    }

    const urlObjext = getUrlFromUri(url);
    const ext = getFileExtension(urlObjext.pathname);
    return (ext === 'json');
  }

  /**
   * Check if the loader can load the provided memory object.
   *
   * @param {object} mem The memory object.
   * @returns {boolean} True if the object can be loaded.
   */
  canLoadMemory(mem) {
    if (typeof mem['Content-Type'] !== 'undefined') {
      if (mem['Content-Type'].includes('json')) {
        return true;
      }
    }
    if (typeof mem.filename !== 'undefined') {
      return this.canLoadFile({name: mem.filename});
    }
    return false;
  }

  /**
   * Get the file content type needed by the loader.
   *
   * @returns {number} One of the 'fileContentTypes'.
   */
  loadFileAs() {
    return fileContentTypes.Text;
  }

  /**
   * Get the url content type needed by the loader.
   *
   * @returns {number} One of the 'urlContentTypes'.
   */
  loadUrlAs() {
    return urlContentTypes.Text;
  }

  /**
   * Handle a load start event.
   * Default does nothing.
   *
   * @param {object} _event The load start event.
   */
  onloadstart(_event) {}

  /**
   * Handle a progress event.
   * Default does nothing.
   *
   * @param {object} _event The load progress event.
   */
  onprogress(_event) {}

  /**
   * Handle a load event.
   * Default does nothing.
   *
   * @param {object} _event The load event fired
   *   when a file has been loaded successfully.
   */
  onload(_event) {}

  /**
   * Handle an load end event.
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

} // class JSONTextLoader
