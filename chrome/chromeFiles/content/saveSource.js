function SaveSourceWorker(responseId) {
  this.responseId = responseId;
  this.progressListener = new ProgressListener();

  var worker = this;
  this.progressListener.onStateChange = function(progress, request, state, status) {
    LOG("view source state change: state=" + state + ", status = " + status);
    if ((state & JBExtension.Services.nsIWebProgressListener.STATE_STOP) && status == 0) {
      worker.onLoadingFinished();
      LOG("contentSaved");
    }
    return 0;
  };

  this.progressListener.onProgressChange = function(progress, request, selfProgress, maxSelfProgress, curTotalProgress, maxTotalProgress) {
    LOG("view source progress change: " + selfProgress + " of " + maxSelfProgress);
    return 0;
  };
}

SaveSourceWorker.prototype.onLoadingFinished = function() {
  if (this.docShell) {
    var webNavigation = this.docShell.QueryInterface(Components.interfaces.nsIWebNavigation);
    var fileOutput = JBExtension.Services.createFileOutputStream();
    fileOutput.init(this.targetFile, 0x02 | 0x08 | 0x20, 0664, 0);
    var converterOutput = JBExtension.Services.createConverterOutputStream();
    converterOutput.init(fileOutput, this.docCharset, 0, null);
    converterOutput.writeString(webNavigation.document.body.textContent);
    converterOutput.close();
    fileOutput.close();
  }

  JBExtension.JBConnector.sendContentSavedResponse(this.responseId, this.contentType);
}

SaveSourceWorker.prototype.saveSource = function(targetPath) {
  LOG("saveSource");
  var browser = JBExtension.Browser.getWebBrowser();
  var webNavigation = browser.webNavigation;
  this.targetFile = JBExtension.Services.createFile(targetPath);
  this.contentType = webNavigation.document.contentType;
  this.docCharset = webNavigation.document.characterSet;

  try {
    var pageDescriptor = webNavigation.QueryInterface(JBExtension.Services.nsIWebPageDescriptor).currentDescriptor;
  }
  catch(e) {
    LOG("saveSource: cannod get descriptor. " + e);
  }

  var sourceURI = browser.currentURI;
  if (!pageDescriptor) {
    LOG("page descriptor not found, loading by uri");
    var persist = JBExtension.Services.createWebBrowserPersist(this.progressListener);
    persist.persistFlags |= JBExtension.Services.nsIWebBrowserPersist.PERSIST_FLAGS_FROM_CACHE;
    persist.saveURI(sourceURI, null, null, null, "", this.targetFile);
  }
  else {
    LOG("saving source by descriptor");
    this.docShell = JBExtension.Services.createDocShell();
    this.docShell.QueryInterface(JBExtension.Services.nsIWebProgress).addProgressListener(this.progressListener,
        JBExtension.Services.nsIWebProgress.NOTIFY_STATE_DOCUMENT);
    var pageLoader = this.docShell.QueryInterface(JBExtension.Services.nsIWebPageDescriptor);
    pageLoader.loadPage(pageDescriptor, JBExtension.Services.nsIWebPageDescriptor.DISPLAY_AS_SOURCE);
  }
}