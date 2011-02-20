
var JBExtension = Components.classes[JB_EXTENSION_CONTRACT_ID].getService().wrappedJSObject.getExtension();

function jbStartListening() {
  JBExtension.Sockets.createServerSocket()
}

jbStartListening();

function updateJBMenuItems() {
  var openSourceItem = document.getElementById("item_jbOpenSource");
  if (openSourceItem) {
    openSourceItem.hidden = !JBExtension.JBConnector.connected;
  }

  var startDebuggerItem = document.getElementById("item_jbStartDebugger")
  if (startDebuggerItem) {
    startDebuggerItem.hidden = JBExtension.JBConnector.connected;
  }
}

window.addEventListener("load", function(event) {
  LOG("loadService.js: load event[" + JBExtension.Browser.openedWindowCount + "]");
  JBExtension.Browser.openedWindowCount++;

  if (JBExtension.Browser.openedWindowCount == 1) {
    JBExtension.Browser.onWindowLoaded();
  }
  var context = document.getElementById("contentAreaContextMenu");
  context.addEventListener("popupshowing", updateJBMenuItems, false);
}, true);


window.addEventListener("unload", function() {
  JBExtension.Browser.openedWindowCount--;
  LOG("loadService.js: unload event[" + JBExtension.Browser.openedWindowCount + "]");
  if (JBExtension.Browser.openedWindowCount == 0) {
    JBExtension.JBConnector.disconnect(-1);
    JBExtension.Browser.onWindowUnloaded();
  }
}, false);