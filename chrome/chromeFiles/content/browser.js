JBExtension.Browser = {
  openedWindowCount: 0,
  closeBlankTab: false,
  progressListeners: {},

  onWindowLoaded: function() {
    if (this.windowLoaded) return;
    this.windowLoaded = true;
    var browser = this.getWebBrowser();
    LOG("browser = " + browser);
    if (this.urlToOpen) {
      if (browser) {
        LOG("opening url: " + this.urlToOpen);
        browser.loadURI(this.urlToOpen, null, null);
        this.urlToOpen = null;
      }
    }
    if (JBExtension.JBConnector.connected) {
      this.registerListeners();
    }
  },

  onWindowUnloaded: function() {
    if (!this.windowLoaded) return;
    this.unregisterListeners();
    this.windowLoaded = false;
  },

  registerListeners: function() {
    if (!this.windowLoaded) return;

    var browser = this.getWebBrowser();
    if (!browser || browser in this.progressListeners) return;

    var progressListener = new ProgressListener();
    progressListener.onLocationChange = function(webProgress, request, location) {
      if (location) {
        LOG("location changed: " + location.spec);
        if (JBExtension.JBConnector.connected) {
          JBExtension.JBConnector.sendLocationChangedResponse(location.spec);
        }
      }
      return 0;
    };

    browser.addProgressListener(progressListener,
        JBExtension.Services.nsIWebProgress.NOTIFY_LOCATION | JBExtension.Services.nsIWebProgress.NOTIFY_STATE_DOCUMENT);
    this.progressListeners[browser] = progressListener;
    LOG("listener registered in " + browser);
  },

  unregisterListeners: function() {
    if (this.windowLoaded) {
      for (var browser in this.progressListeners) {
        if (browser && browser.removeProgressListener) {
          browser.removeProgressListener(this.progressListeners[browser]);
          LOG("listener unregistered from " + browser);
        }
      }
      this.progressListeners = {};
    }
  },

  getWebBrowser: function() {
    return JBExtension.Services.getWebBrowser();
  },

  open: function(url) {
    if (this.windowLoaded) {
      LOG("open: window loaded, opening url " + url);
      try {
        var browser = this.getWebBrowser();
        browser.loadURI(url, null, null);
      }
      catch(e) {
        this.urlToOpen = url;
        LOG("doOpen:" + e);
      }
    }
    else {
      LOG("open: window not loaded");
      this.urlToOpen = url;
    }
  },

  openTab: function(url) {
    var browser = this.getWebBrowser();
    browser.addTab(url);
  },

  getCurrentUrl: function() {
    var browser = this.getWebBrowser();
    return browser.currentURI.spec;
  },

  reload: function() {
    var browser = this.getWebBrowser();
    browser.reload();
  },

  openSource: function() {
    if (JBExtension.JBConnector.connected) {
      var browser = this.getWebBrowser();
      if (browser && browser.currentURI) {
        JBExtension.JBConnector.sendOpenSourceResponse(browser.currentURI.spec);
      }
    }
  },

  saveContent: function(id, targetPath) {
    new SaveSourceWorker(id).saveSource(targetPath);
  },

  reloadOrOpen: function(url) {
    var windowMediator = JBExtension.Services.getWindowMediator();
    var browserEnumerator = windowMediator.getEnumerator("navigator:browser");

    while (browserEnumerator.hasMoreElements()) {
      var browserWin = browserEnumerator.getNext();
      var tabBrowser = browserWin.gBrowser;

      var numTabs = tabBrowser.browsers.length;
      for (var index = 0; index < numTabs; index++) {
        var currentBrowser = tabBrowser.getBrowserAtIndex(index);
        if (url == currentBrowser.currentURI.spec) {
          LOG("reloadOrOpen: reloading tab for " + url)
          tabBrowser.selectedTab = tabBrowser.tabContainer.childNodes[index];
          currentBrowser.reload();
          browserWin.focus();
          return;
        }
      }
    }

    this.open(url);
  }
};

function ProgressListener() {
}

ProgressListener.prototype = {
  QueryInterface: function(aIID) {
    if (aIID.equals(JBExtension.Services.nsIWebProgressListener) ||
        aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
        aIID.equals(JBExtension.Services.nsISupports))
      return this;
    throw Components.results.NS_NOINTERFACE;
  },
  onLocationChange: function() {return 0;},
  onStateChange: function() { return 0; },
  onProgressChange: function() { return 0; },
  onStatusChange: function() { return 0; },
  onSecurityChange: function() { return 0; },
  onLinkIconAvailable: function() { return 0; }
}