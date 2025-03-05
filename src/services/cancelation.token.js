class CancelationToken {
  constructor(cancelCallback) {
    this._cancel = false;
    this.cancelCallback = cancelCallback;
  }

  cancel() {
    this._cancel = true;
    this.cancelCallback();
  }

  isCanceled() {
    if (this._cancel) {
      this.cancelCallback();
    }

    return this._cancel;
  }
}

module.exports = CancelationToken;
