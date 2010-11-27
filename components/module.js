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

function JBCommandLineHandler() {
}

const JB_CMD_HANDLER_CONTRACT_ID = "@mozilla.org/commandlinehandler/general-startup;1?type=jbdebug";
const JB_CMD_HANDLER_CID = Components.ID("{3DF5F5F6-0F00-11DE-8C34-29A456D89593}");
const JB_CMD_HANDLER_CATEGORY = "m-jbdebug";
JBCommandLineHandler.prototype = {
    classID: JB_CMD_HANDLER_CID,
    classDescription: "JetBrains CommandLine Handler",
    contractID: JB_CMD_HANDLER_CONTRACT_ID,
    QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsICommandLineHandler,
                                           Components.interfaces.nsIFactory]),
    _xpcom_categories: [{
        category: "command-line-handler",
        entry: JB_CMD_HANDLER_CATEGORY
    }],

    handle: function(commandLine) {
        try {
          var portString = commandLine.handleFlagWithParam("jbdebug", false);
          LOG("handle command line: port=" + portString);
          if (portString) {
            commandLine.preventDefault = true;
            var port = parseInt(portString);
            JBExtension.JBConnector.connect("localhost", port);
          }
        }
        catch(e) {
          ERROR(e);
        }
      },

      helpInfo: "  -jbdebug <port>         connect to IntelliJ IDEA\n"
}

//for Firefox 3.x
function NSGetModule(componentManager, fileSpec) {
  JBExtension = {};
  loadScripts();
  LOG("NSGetModule called");
  return XPCOMUtils.generateModule([JBExtensionModule, JBCommandLineHandler]);
}

//for Firefox 4
if (XPCOMUtils.generateNSGetFactory) {
  JBExtension = {};
  loadScripts();
  LOG("NSGetFactory created");
  var NSGetFactory = XPCOMUtils.generateNSGetFactory([JBExtensionModule, JBCommandLineHandler]);
}
