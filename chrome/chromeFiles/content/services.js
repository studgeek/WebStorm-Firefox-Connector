JBExtension.isLoggingEnabled = true;
JBExtension.isProcessingLogMessage = false;

JBExtension.Services = {
  nsITransport: Components.interfaces.nsITransport,
  transportServiceInterface: Components.interfaces.nsISocketTransportService,
  jsdIDebuggerService: Components.interfaces.jsdIDebuggerService,
  jsdIExecutionHook: Components.interfaces.jsdIExecutionHook,
  jsdICallHook: Components.interfaces.jsdICallHook,
  jsdIScript: Components.interfaces.jsdIScript,
  jsdIValue: Components.interfaces.jsdIValue,
  jsdIFilter: Components.interfaces.jsdIFilter,
  nsISupports: Components.interfaces.nsISupports,
  nsICategoryManager: Components.interfaces.nsICategoryManager,
  nsIComponentRegistrar: Components.interfaces.nsIComponentRegistrar,
  nsIFactory: Components.interfaces.nsIFactory,
  nsIModule: Components.interfaces.nsIModule,
  nsIScriptError: Components.interfaces.nsIScriptError,
  nsIWebProgress: Components.interfaces.nsIWebProgress,
  nsILocalFile: Components.interfaces.nsILocalFile,
  nsIWebBrowserPersist: Components.interfaces.nsIWebBrowserPersist,
  nsIWebProgressListener: Components.interfaces.nsIWebProgressListener,
  nsIWebPageDescriptor: Components.interfaces.nsIWebPageDescriptor,

  getWindowMediator: function() {
    return Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
  },

  getWindowWatcher: function() {
    return Components.classes["@mozilla.org/embedcomp/window-watcher;1"].getService(Components.interfaces.nsIWindowWatcher);
  },

  getWebProgress: function() {
    return Components.classes["@mozilla.org/appshell/component/browser-status-filter;1"].getService(Components.interfaces.nsIWebProgress);
  },

  getConsoleService: function() {
    return Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
  },

  getSocketTransportService: function() {
    return Components.classes["@mozilla.org/network/socket-transport-service;1"].getService(this.transportServiceInterface);
  },

  getUtf8Converter: function () {
    var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].getService(Components.interfaces.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";
    return converter;
  },

  getThreadService: function() {
    return Components.classes["@mozilla.org/thread-manager;1"].getService(Components.interfaces.nsIThreadManager);
  },

  getDebuggerService: function() {
    return Components.classes["@mozilla.org/js/jsd/debugger-service;1"].getService(this.jsdIDebuggerService);
  },

  getPrefBranch: function() {
    return Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
  },

  getCategoryService: function() {
    return Components.classes["@mozilla.org/categorymanager;1"].getService(this.nsICategoryManager);
  },

  getPromptService: function() {
    return Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
  },

  createFile: function(path) {
    var file = Components.classes["@mozilla.org/file/local;1"].createInstance(this.nsILocalFile);
    file.initWithPath(path);
    return file;
  },

  createBinaryInput: function(input) {
    var binaryInput = Components.classes["@mozilla.org/binaryinputstream;1"].createInstance(Components.interfaces.nsIBinaryInputStream);
    binaryInput.setInputStream(input);
    return binaryInput;
  },

  createFileOutputStream: function() {
    return Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
  },

  createConverterOutputStream: function() {
    return Components.classes["@mozilla.org/intl/converter-output-stream;1"].createInstance(Components.interfaces.nsIConverterOutputStream);
  },
  
  getWebBrowser: function() {
    var win = this.getWindowMediator().getMostRecentWindow("navigator:browser");
    if (!win || !win.getBrowser) return null;
    return win.getBrowser();
  },
  
  createWebBrowserPersist: function(progressListener) {
    var persist = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].createInstance(this.nsIWebBrowserPersist);
    persist.persistFlags = this.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES
                         | this.nsIWebBrowserPersist.PERSIST_FLAGS_DONT_FIXUP_LINKS
                         | this.nsIWebBrowserPersist.PERSIST_FLAGS_DONT_CHANGE_FILENAMES
                         | this.nsIWebBrowserPersist.PERSIST_FLAGS_NO_BASE_TAG_MODIFICATIONS;
    persist.progressListener = progressListener;
    return persist;                         
  },

  createDocShell: function() {
    var docShellClass = Components.classes["@mozilla.org/docshell;1"];
    if (!docShellClass) {
      docShellClass = Components.classes["@mozilla.org/webshell;1"];
    }
    var docShell = docShellClass.createInstance();
    try {
      //to fix crashes in Firefox 5, see https://bugzilla.mozilla.org/show_bug.cgi?id=552193
      docShell.QueryInterface(Components.interfaces.nsIBaseWindow).create();
    }
    catch (e) {
      LOG(e);
    }
    return docShell;
  },

  createServerSocket: function(port) {
    var socket = Components.classes["@mozilla.org/network/server-socket;1"]
                      .createInstance(Components.interfaces.nsIServerSocket);
    socket.init(port, false, -1);
    return socket;
  }
}