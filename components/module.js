Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
const nsIJBExtensionService = Components.interfaces.nsIJBExtensionService;
const JB_EXTENSION_CID = Components.ID("{B5304038-0F08-11DE-937D-EA5E55D89593}");

function JBExtensionModule() {
  this.wrappedJSObject = this;
}

JBExtensionModule.prototype = {
  getExtension: function() {
    return JBExtension;
  },
  classID: JB_EXTENSION_CID,
  classDescription: "JetBrains Extension Module",
  contractID: "@jetbrains.com/firefox-connector;1",
  QueryInterface: XPCOMUtils.generateQI([nsIJBExtensionService, Components.interfaces.nsIModule])
};

function loadScripts() {
  var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
  loader.loadSubScript("chrome://jetbrains-connector/content/constants.js");
  loader.loadSubScript("chrome://jetbrains-connector/content/utils.js");
  loader.loadSubScript("chrome://jetbrains-connector/content/services.js");
  loader.loadSubScript("chrome://jetbrains-connector/content/logging.js");
  loader.loadSubScript("chrome://jetbrains-connector/content/sockets.js");
  loader.loadSubScript("chrome://jetbrains-connector/content/scripts.js");
  loader.loadSubScript("chrome://jetbrains-connector/content/breakpoints.js");
  loader.loadSubScript("chrome://jetbrains-connector/content/frames.js");
  loader.loadSubScript("chrome://jetbrains-connector/content/values.js");
  loader.loadSubScript("chrome://jetbrains-connector/content/filters.js");
  loader.loadSubScript("chrome://jetbrains-connector/content/debugger.js");
  loader.loadSubScript("chrome://jetbrains-connector/content/browser.js");
  loader.loadSubScript("chrome://jetbrains-connector/content/connector.js");
  loader.loadSubScript("chrome://jetbrains-connector/content/xmlRpcClient.js");
  loader.loadSubScript("chrome://jetbrains-connector/content/saveSource.js");
}

//for Firefox 3.x
function NSGetModule(componentManager, fileSpec) {
  JBExtension = {};
  loadScripts();
  LOG("NSGetModule called");
  return XPCOMUtils.generateModule([JBExtensionModule]);
}

//for Firefox 4
if (XPCOMUtils.generateNSGetFactory) {
  JBExtension = {};
  loadScripts();
  LOG("NSGetFactory created");
  var NSGetFactory = XPCOMUtils.generateNSGetFactory([JBExtensionModule]);
}
