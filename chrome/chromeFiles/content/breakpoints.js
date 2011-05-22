JBExtension.BreakpointManager = {
  url2breakpoints: {},
  id2breakpoint: {},
  tag2pc2breakpoint: {},
  temporaryBreakpoints: [],

  clearData: function() {
    this.url2breakpoints = {};
    this.id2breakpoint = {};
    this.tag2pc2breakpoint = {};
  },

  registerBreakpoint: function(breakpointId, url, line, condition, logExpression) {
    LOG("registering breakpoint: " + url + ": " + line);
    var scripts = JBExtension.ScriptManager.findScripts(url, line);
    LOG(scripts.length + " scripts found");
    var breakpoint = new BreakpointInfo(breakpointId, url, line, condition, logExpression, scripts);
    breakpoint.setEnabled(true);

    if (breakpointId >= 0) {
      this.id2breakpoint[breakpointId] = breakpoint;
    }
    else {
      this.temporaryBreakpoints.push(breakpoint);
    }

    if (!(url in this.url2breakpoints)) {
      this.url2breakpoints[url] = [];
    }
    this.url2breakpoints[url].push(breakpoint);
    return scripts.length > 0;
  },

  unregisterTemporaryBreakpoints: function() {
    for (var i = 0; i < this.temporaryBreakpoints.length; i++) {
      this.doUnregisterBreakpoint(this.temporaryBreakpoints[i]);
    }
    this.temporaryBreakpoints = [];
  },

  unregisterBreakpoint: function(breakpointId) {
    var breakpoint = this.id2breakpoint[breakpointId];
    if (!breakpoint) return;
    this.doUnregisterBreakpoint(breakpoint);
  },

  doUnregisterBreakpoint: function(breakpoint) {
    breakpoint.setEnabled(false);
    var breakpoints = this.url2breakpoints[breakpoint.url];
    if (breakpoints) {
      var i = breakpoints.indexOf(breakpoint);
      if (i != -1) {
        breakpoints.splice(i, 1);
      }
    }
  },

  findBreakpoint: function(scriptInfo, pc) {
    var inScript = this.tag2pc2breakpoint[scriptInfo.tag];
    if (!inScript) {
      return null;
    }
    return inScript[pc];
  },

  collectBreakpoints: function (url, scriptInfo, result) {
    if (url in this.url2breakpoints) {
      var breakpoints = this.url2breakpoints[url];
      for (var i = 0; i < breakpoints.length; i++) {
        var breakpoint = breakpoints[i];
        if (scriptInfo.containsLine(breakpoint.line) && scriptInfo.isLineExecutable(breakpoint.line)) {
          result.push(breakpoint);
        }
      }
    }
  },

  findBreakpointsInScript: function(scriptInfo) {
    var result = [];
    var url = scriptInfo.url;
    this.collectBreakpoints(url, scriptInfo, result);
    var trimmedUrl = JBExtension.Utils.trimUrlParameters(url);
    if (trimmedUrl != url) {
      this.collectBreakpoints(trimmedUrl, scriptInfo, result);
    }
    return result;
  },

  onScriptCreated: function(scriptInfo) {
    var breakpoints = this.findBreakpointsInScript(scriptInfo);
    LOG("breakpointManager: onScriptCreated, " + breakpoints.length + " breakpoints found");
    for (var i=0; i < breakpoints.length; i++) {
      if (breakpoints[i].scripts.length == 0) {
        this.connector.sendBreakpointResponse(-1, breakpoints[i].id, "OK");
      }
      breakpoints[i].addScript(scriptInfo);
    }
  },

  onScriptDestroyed: function(scriptInfo) {
    var url = scriptInfo.url;
    if (url in this.url2breakpoints) {
      var breakpoints = this.url2breakpoints[url];
      for (var i = 0; i < breakpoints.length; i++) {
        breakpoints[i].removeScript(scriptInfo);
      }
    }
  }
};

function BreakpointInfo(id, url, line, condition, logExpression, scripts) {
  this.id = id;
  this.url = url;
  this.line = line;
  this.condition = condition;
  this.logExpression = logExpression;
  this.enabled = false;
  this.scripts = scripts;
}

BreakpointInfo.prototype.setEnabled = function(enable) {
  if (enable == this.enabled) return;
  this.enabled = enable;
  for (var i=0; i < this.scripts.length; i++) {
    var script = this.scripts[i];
    if (enable) {
      this.setInScript(script);
    }
    else {
      script.clearBreakpoint(this.line);
    }
  }
}

BreakpointInfo.prototype.setInScript = function(script) {
  var pc = script.setBreakpoint(this.line);
  if (pc != -1) {
    var tag = script.tag;
    LOG("breakpoint set in script (" + tag + ") at pc=" + pc);
    var map = JBExtension.BreakpointManager.tag2pc2breakpoint;
    if (!(tag in map)) {
      map[tag] = {};
    }
    map[tag][pc] = this;
  }
};

BreakpointInfo.prototype.addScript = function(scriptInfo) {
  this.scripts.push(scriptInfo);
  if (this.enabled) {
    this.setInScript(scriptInfo);
  }
}

BreakpointInfo.prototype.removeScript = function(scriptInfo) {
  var i = this.scripts.indexOf(scriptInfo);
  if (i != -1) {
    this.scripts.splice(i, 1);
  }
}