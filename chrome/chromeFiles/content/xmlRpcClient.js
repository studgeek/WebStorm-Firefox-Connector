JBExtension.XmlRpcClient = {
  createStringParameter: function (param) {
    var escaped = "";
    for (var i = 0; i < param.length; i++) {
      var c = param[i];
      switch (c) {
        case '<': escaped += '&lt;'; break;
        case '>': escaped += '&gt;'; break;
        case '&': escaped += '&amp;'; break;
        default: escaped += c;
      }
    }
    return '<param><value>' + param + '</value></param>';
  },

  startDebugger: function() {
    var webBrowser = JBExtension.Browser.getWebBrowser();
    if (webBrowser && webBrowser.currentURI) {
      var url = webBrowser.currentURI.spec;
      LOG("startDebugger: " + url);
      var attempts = 5;
      var callback = new IDEDebuggerStarter(attempts, url);
      var startPort = 63342;
      for (var i = 0; i < attempts; i++) {
        var request = new IDEConnectionRequest(startPort + i, callback);
        request.sendRequest("FirefoxDebugger.getProjectNames", "", true);
      }
    }
  }
}

function IDEConnectionRequest(port, callback) {
  this.port = port;
  this.callback = callback;
}

IDEConnectionRequest.prototype.sendRequest = function (methodName, callParameters, listenResponse) {
  var request = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Components.interfaces.nsIXMLHttpRequest);
  var serverUrl = "http://127.0.0.1:" + this.port;
  //LOG("connecting to XmlRpc server at " + serverUrl);
  request.open('POST', serverUrl, true);

  request.setRequestHeader('Content-Type', 'text/xml');
  var data = '<?xml version="1.0" encoding="UTF-8"?>' +
             '<methodCall>' +
             ' <methodName>' + methodName + '</methodName>' +
             ' <params>' +
             callParameters +
             ' </params>' +
             '</methodCall>';

  if (listenResponse) {
    request.onload = JBExtension.Utils.wrapCallback(this.onRequestLoad, this);
    request.onerror = JBExtension.Utils.wrapCallback(this.onRequestError, this);
  }

  //LOG("sending data: " + data);
  request.send(data);
}

IDEConnectionRequest.prototype.onRequestLoad = function (e) {
  var DomNode = Components.interfaces.nsIDOMNode;
  var doc = e.target.responseXML;
  //LOG("onLoad[port=" + this.port + "]:" + doc);
  var node = doc.firstChild;
  var path = ['methodResponse', 'params', 'param', 'value', 'array', 'data'];
  for (var i = 0; i < path.length; i++) {
    if (node.nodeType == DomNode.TEXT_NODE) node = node.nextSibling;
    if (node.nodeType != DomNode.ELEMENT_NODE || node.nodeName != path[i]) {
      LOG(path[i] + " expected")
      this.onRequestError(e);
      return;
    }
    node = node.firstChild;
  }

  this.projectNames = [];
  while (node) {
    if (node.nodeType == DomNode.ELEMENT_NODE && node.nodeName == 'value') {
      var valueNode = node.firstChild;
      if (valueNode.nodeType == DomNode.ELEMENT_NODE) {
        valueNode = valueNode.firstChild;
      }

      if (valueNode.nodeType == DomNode.TEXT_NODE) {
        this.projectNames.push('' + valueNode.nodeValue);
      }
    }
    node = node.nextSibling;
  }
  this.callback.onRequestFinished(true, this);
}

IDEConnectionRequest.prototype.onRequestError = function (e) {
  //LOG("onError[port=" + this.port + "]: " + e);
  this.callback.onRequestFinished(false, this);
}

IDEConnectionRequest.prototype.sendStartDebuggerRequest = function (projectName, url) {
  this.sendRequest("FirefoxDebugger.startDebugger", JBExtension.XmlRpcClient.createStringParameter(projectName) +
                                                    JBExtension.XmlRpcClient.createStringParameter(url), false);
}

function IDEDebuggerStarter(totalRequests, url) {
  this.totalRequests = totalRequests;
  this.errorResponses = 0;
  this.successRequests = [];
  this.url = url;
}

IDEDebuggerStarter.prototype.onRequestFinished = function (success, request) {
  if (success) {
    this.successRequests.push(request);
  }
  else {
    this.errorResponses++;
  }

  if (this.successRequests.length + this.errorResponses >= this.totalRequests) {
    LOG(this.successRequests.length + " success responses, " + this.errorResponses + " error reponses");
    if (this.successRequests.length == 0) {
      JBExtension.Services.getPromptService().alert(null, "Error", "Cannot connect to IDE.\n\nMake sure that JavaScript Debugger plugin is enabled.")
      return;
    }

    var preferredProjectsCount = 0;
    var preferredProject = null;
    var projects = [];
    var requests = {};
    for (var i = 0; i < this.successRequests.length; i++) {
      var projectNames = this.successRequests[i].projectNames;
      for (var j = 0; j < projectNames.length; j++) {
        var projectName = projectNames[j];
        if (JBExtension.Utils.startsWith(projectName, "[jsd]")) {
          preferredProjectsCount++;
          projectName = projectName.substring("[jsd]".length);
          preferredProject = projectName;
        }
        requests[projectName] = this.successRequests[i];
        projects.push(projectName);
      }
    }

    LOG("startDebugger: projects = " + projects + ", preferred projects: " + preferredProjectsCount + ", " + preferredProject);
    if (projects.length == 1) {
      preferredProjectsCount = 1;
      preferredProject = projects[0];
    }

    if (preferredProjectsCount == 1) {
      requests[preferredProject].sendStartDebuggerRequest(preferredProject, this.url);
    }
    else if (projects.length == 0) {
      JBExtension.Services.getPromptService().alert(null, "Error", "No projects found.");
    }
    else {
      var selected = {};
      if (JBExtension.Services.getPromptService().select(null, "Start Debugger", "Select project", projects.length, projects, selected)) {
        var selectedProject = projects[selected.value];
        requests[selectedProject].sendStartDebuggerRequest(selectedProject, this.url);
      }
    }
  }
}
