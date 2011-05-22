JBExtension.JBConnector = {
  connected: false,
  socket: null,

  connect: function (socket) {
    if (this.connected) {
      ERROR("already connected");
      return;
    }
    this.socket = socket;
    this.connected = true;
    this.consoleListener = {
      observe: function(logMessage) {
        if (JBExtension.isProcessingLogMessage) return;

        try {
          JBExtension.isProcessingLogMessage = true;
          JBExtension.JBConnector.sendLogMessageResponse(logMessage);
        }
        catch(e) {
          //ignore
        }
        finally {
          JBExtension.isProcessingLogMessage = false;
        }
      }
    };
    JBExtension.Services.getConsoleService().registerListener(this.consoleListener);
    JBExtension.Browser.registerListeners();
  },

  disconnect: function(id) {
    if (!this.connected) {
      return;
    }
    JBExtension.Services.getConsoleService().unregisterListener(this.consoleListener);
    JBExtension.Browser.unregisterListeners();
    this.sendDisconnectingResponse(id);
    this.socket.close();
    this.connected = false;
    JBExtension.Debugger.stop();
  },

  processMessage: function(text) {
    var command = JBExtension.Utils.parseMessage(text);
    var s = "Command " + command.name + "(" + command.id + ") received";
    for (var p in command.parameters) {
      s += ", " + p + "=" + command.parameters[p];
    }
    LOG(s);
    var functionName = "do" + command.name.charAt(0).toUpperCase() + command.name.substring(1);
    try {
      this[functionName](command.id, command.parameters);
    }
    catch(e) {
      ERROR("[" + functionName + "]: " + e);
    }
  },

  sendResponse: function() {
    var s = arguments[0] + " " + arguments[1];
    for (var i = 2; i < arguments.length; i += 2) {
      var value = arguments[i + 1];
      if (value != null) {
        var valueString = typeof(value) != "undefined" ? JBExtension.Utils.escapeSpaces("" + value) : "undefined";
        s += " " + arguments[i] + "=" + valueString;
      }
    }
    this.socket.send(s);
  },

  sendDisconnectingResponse: function(id) {
    this.sendResponse(id, "disconnecting");
  },

  sendErrorResponse: function(id, message) {
    this.sendResponse(id, "error", "message", message);
  },

  sendFinishedResponse: function(id) {
    this.sendResponse(id, "finished");
  },

  sendStringResponse: function(id, value) {
    this.sendResponse(id, "string", "value", value);
  },

  sendBooleanResponse: function(id, value) {
    this.sendResponse(id, "boolean", "value", value);
  },

  sendOpenSourceResponse: function(url) {
    this.sendResponse(-1, "openSource", "url", url);
  },

  sendScriptCreatedResponse: function(info) {
    this.sendResponse(-1, "scriptCreated", "url", info.url, "tag", info.tag, "fun", this.getFunName(info.functionName),
                      "baseLine", info.getBaseLineNumber(), "lineExtent", info.getLineExtent()
        //source text of script is not used by js debugger yet
        //, "text", this.getFunName(info.getSourceText())
    );
  },

  sendScriptDestroyedResponse: function(url, tag) {
    this.sendResponse(-1, "scriptDestroyed", "url", url, "tag", tag);
  },

  sendLogMessageResponse: function(logMessage) {
    var message = logMessage.message;
    if (JBExtension.Utils.startsWith(message, "[JavaScript")) {
      var type = 0;
      var scriptError = logMessage.QueryInterface(JBExtension.Services.nsIScriptError);
      if (scriptError.flags == JBExtension.Services.nsIScriptError.errorFlag
          || scriptError.flags == JBExtension.Services.nsIScriptError.exceptionFlag) {
        type = 2;
      }
      else if (scriptError.flags == JBExtension.Services.nsIScriptError.warningFlag) {
        type = 1;
      }
      else {
        return;
      }

      var url = null, line = null;
      if (scriptError.lineNumber && scriptError.sourceName) {
        url = scriptError.sourceName;
        line = scriptError.lineNumber - 1;
      }
      if (scriptError.errorMessage) {
        message = scriptError.errorMessage;
      }
      this.sendResponse(-1, "logMessage", "message", message, "type", type, "url", url, "line", line);
    }
  },

  sendLocationChangedResponse: function(url) {
    this.sendResponse(-1, "locationChanged", "url", url);
  },

  sendContentSavedResponse: function(id, contentType) {
    this.sendResponse(id, "contentSaved", "contentType", contentType);
  },

  sendStackFrameInfoResponse: function(id, frameInfo) {
    var funName = frameInfo.getFunctionName();
    this.sendResponse(id, "stackFrame", "index", frameInfo.index, "url", frameInfo.url, "line", frameInfo.getLine() - 1,
                      "function", this.getFunName(funName), "scriptTag", frameInfo.getScriptTag());
  },

  sendValueInfoResponse: function(id, name, valueId, valueType, className, stringValue) {
    this.sendResponse(id, "value", "name", name, "valueId", valueId, "valueType", valueType,
                      "className", className, "stringValue", stringValue);
  },

  sendBreakpointResponse: function(id, breakpointId, status) {
    this.sendResponse(id, "breakpoint", "id", breakpointId, "status", status);
  },

  sendBreakpointReachedResponse: function(breakpointId, logMessage, frame) {
    this.sendResponse(-1, "breakpointReached", "id", breakpointId, "log", logMessage,
                      "scriptTag", frame.script.tag, "function", this.getFunName(frame.functionName));
  },

  sendExcBreakpointReachedResponse: function(breakpointId, url, line, logMessage, frame) {
    this.sendResponse(-1, "excBreakpointReached", "id", breakpointId, "url", url, "line", line - 1, "log", logMessage,
                      "scriptTag", frame.script.tag, "function", this.getFunName(frame.functionName));
  },

  sendSuspendedResponse: function(url, line, frame) {
    this.sendResponse(-1, "suspended", "url", url, "line", line - 1, "scriptTag", frame.script.tag,
                      "function", this.getFunName(frame.functionName));
  },

  getFunName: function(name) {
    if (!name) {
      return null;
    }
    return name;
  },

  doReload: function(id, parameters) {
    LOG("doReload");
    JBExtension.Browser.reloadOrOpen(parameters.url);
  },

  doOpenTab: function(id, parameters) {
    JBExtension.Browser.openTab(parameters.url);
  },

  doOpen: function(id, parameters) {
    LOG("doOpen: " + parameters.url);
    JBExtension.Browser.open(parameters.url);
  },

  doGetCurrentUrl: function(id, parameters) {
    this.sendStringResponse(id, JBExtension.Browser.getCurrentUrl());
  },

  doStartDebugger: function(id, parameters) {
    JBExtension.Debugger.start(this);
  },

  doStopDebugger: function(id, parameters) {
    JBExtension.Debugger.stop();
  },

  doSetBreakpoint: function(id, parameters) {
    var registered = JBExtension.BreakpointManager.registerBreakpoint(parameters.id, parameters.url, parseInt(parameters.line) + 1,
                                                                      parameters.condition, parameters.log);
    if (registered) {
      this.sendBreakpointResponse(id, parameters.id, "OK");
    }
  },

  doSetExceptionBreakpoint: function(id, parameters) {
    JBExtension.ExcBreakpointManager.registerBreakpoint(parameters.id, parameters.exception, parameters.condition, parameters.log)
  },

  doClearBreakpoint: function(id, parameters) {
    if (parameters.exc == "true") {
      JBExtension.ExcBreakpointManager.unregisterBreakpoint(parameters.id);
    }
    else {
      JBExtension.BreakpointManager.unregisterBreakpoint(parameters.id);
    }
  },

  doSetLoggingSettings: function(id, parameters) {
    JBExtension.isLoggingEnabled = parameters.enable == "true";
  },

  doSetViewSettings: function(id, parameters) {
    JBExtension.Debugger.settings.showDOM = parameters.showDOM == "true";
    JBExtension.Debugger.settings.showFunctions = parameters.showFunctions == "true";
    JBExtension.Debugger.settings.showUserFunctionsOnly = parameters.showUserFunctionsOnly == "true";
  },

  doStep: function(id, parameters) {
    if ("over" == parameters.to) {
      JBExtension.Debugger.stepOver();
    }
    else if ("into" == parameters.to) {
      if ("fun" in parameters) {
        JBExtension.Debugger.stepIntoFunction(parameters.fun);
      }
      else {
        JBExtension.Debugger.stepInto();
      }
    }
    else if ("out" == parameters.to) {
      JBExtension.Debugger.stepOut();
    }
    else {
      ERROR("incorrect step: " + parameters.to);
    }
  },

  doGetFrames: function(id, parameters) {
    JBExtension.Debugger.sendFrames(id, parameters.from, parameters.count);
  },

  doComputeFrameValues: function(id, parameters) {
    JBExtension.Debugger.computeFrameValues(id, parameters.frame)
  },

  doComputeProperties: function(id, parameters) {
    JBExtension.Debugger.computeProperties(id, parameters.value);
  },

  doEvaluate: function(id, parameters) {
    var url = JBExtension.Utils.convertToScriptUrl(parameters.url);
    JBExtension.Debugger.evaluate(id, parameters.code, url, parseInt(parameters.line) + 1, parameters.frame);
  },

  doRunTo: function(id, parameters) {
    JBExtension.Debugger.runTo(parameters.url, parseInt(parameters.line) + 1);
  },

  doResume: function(id, parameters) {
    JBExtension.Debugger.resume();
  },

  doPause: function(id, parameters) {
    JBExtension.Debugger.pause();
  },

  doSaveContent: function(id, parameters) {
    JBExtension.Browser.saveContent(id, parameters.targetPath);
  },

  doSetSteppingFilters: function(id, parameters) {
    var patterns = parameters.pattern;
    LOG("doSetSteppingFilters: " + patterns);
    if (typeof(patterns) == "string") {
      patterns = [patterns];
    }
    JBExtension.FiltersManager.setUrlPatterns(patterns);
    var jsd = JBExtension.Debugger.jsd;
    if (jsd) {
      JBExtension.FiltersManager.removeFilters(jsd);
      JBExtension.FiltersManager.appendFilters(jsd);
    }
  },

  doSetEnabledChromeComponents: function(id, parameters) {
    var components = parameters.component;
    if (typeof(components) == "string") {
      components = [components]
    }
    LOG("doSetEnabledChromeComponents: " + components);
    if (components) {
      JBExtension.ScriptManager.setEnabledChromeComponents(components);
    }
  },

  doDisconnect: function(id, parameters) {
    this.disconnect(id);
  },

  doEvalInternal: function(id, parameters) {
    LOG("doEval: " + parameters.code);
    var browser = JBExtension.Services.getWebBrowser();
    var result = eval(parameters.code);
    this.sendStringResponse(id, result);
  }
}
