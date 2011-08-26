JBExtension.ScriptManager = {
  url2scripts: new MultiMap(),
  trimmedUrl2scripts: new MultiMap(),
  tag2script: {},
  ignoredUrls: {},
  connector: null,
  enabledChromeComponents: [],

  registerScripts: function(jsd) {
    this.url2scripts.clear();
    this.trimmedUrl2scripts.clear();
    this.tag2script = {};
    LOG("enumerating scripts");
    jsd.enumerateScripts({
      enumerateScript: function (script) {
        if (!JBExtension.ScriptManager.ignoreScript(script)) {
          JBExtension.ScriptManager.registerScript(script);
        }
        else {
          //LOG("ignored: " + script.fileName);
        }
      }
    });
  },

  registerScript: function(script) {
    var info = new ScriptInfo(script);
    var url = info.url;
    this.url2scripts.put(url, info);
    var trimmedUrl = JBExtension.Utils.trimUrlParameters(url);
    if (trimmedUrl != url) {
      this.trimmedUrl2scripts.put(trimmedUrl, info);
    }

    this.tag2script[script.tag] = info;
    LOG("script registered, tag: " + script.tag + ", url: " + url);
    if (this.connector.connected) {
      this.connector.sendScriptCreatedResponse(info);
    }
    return info;
  },

  unregisterScript: function(scriptInfo) {
    var url = scriptInfo.url;
    LOG("script unregistered, tag: " + scriptInfo.tag + ", url: " + url);
    this.url2scripts.remove(url, scriptInfo);
    var trimmedUrl = JBExtension.Utils.trimUrlParameters(url);
    if (trimmedUrl != url) {
      this.trimmedUrl2scripts.remove(trimmedUrl, scriptInfo);
    }

    delete this.tag2script[scriptInfo.tag];
    if (this.connector.connected) {
      this.connector.sendScriptDestroyedResponse(url, scriptInfo.tag);
    }
  },

  setEnabledChromeComponents: function(components) {
    this.enabledChromeComponents = components;
  },

  isEnabledChromeComponent: function(name) {
    for (var i = 0; i < this.enabledChromeComponents.length; i++) {
      if (name == this.enabledChromeComponents[i]) {
        return true;
      }
    }
    return false;
  },

  ignoreScript: function(script) {
    var url = script.fileName;
    if (url in this.ignoredUrls) {
      return true;
    }

    var shouldIgnore = false;
    if (JBExtension.Utils.startsWith(url, "chrome://")) {
      if (this.enabledChromeComponents.length == 0) {
        shouldIgnore = true;
      }
      else {
        var path = url.substr("chrome://".length);
        var i = path.indexOf('/');
        var component = i == -1 ? path : path.substr(0, i);
        if (!this.isEnabledChromeComponent(component)) {
          shouldIgnore = true;
        }
      }
    }

    if (JBExtension.Utils.startsWith(url, "XStringBundle")
        || JBExtension.Utils.startsWith(url, "about:")
        || JBExtension.Utils.startsWith(url, "resource://")
        || /^(file:.*((F|f)irefox).*\/(components|modules)\/).*\.(js|jsm)$/.test(url)
        || /^(XP).*(\.cpp)$/.test(url)) {
      shouldIgnore = true;
    }

    if (this.enabledChromeComponents.length == 0 &&
        (/\/extensions\/\{.{8}(-.{4}){3}-.{12}\}\//.test(url)
        || /\/xulrunner-\d\.\d\.\d\.\d\/(modules|components|chrome)\//.test(url)
        || /^(file:.*\/extensions\/firebug)/.test(url))) {
      shouldIgnore = true;
    }

    if (shouldIgnore) {
      this.ignoredUrls[url] = true;
      //LOG("Ignored new url: " + url);
      return true;
    }
    else {
      //LOG("Didn't ignore url: " + url);
      return false;
    }
  },

  findScripts: function (url, line) {
    var result = [];
    var scripts = this.url2scripts.getValues(url);
    var trimmedUrl = JBExtension.Utils.trimUrlParameters(url);
    scripts = scripts.concat(this.trimmedUrl2scripts.getValues(trimmedUrl));

    for (var i = 0; i < scripts.length; i++) {
      var script = scripts[i];
      if (script.containsLine(line) && script.isLineExecutable(line)) {
        result.push(script);
      }
    }
    return result;
  },

  getScriptInfo: function(script) {
    if (!(script.tag in this.tag2script)) {
      return null;
    }
    return this.tag2script[script.tag];
  },

  onScriptCreated: function(script) {
    if (JBExtension.Debugger.evaluating) return;

    if (this.ignoreScript(script)) {
      //LOG("onScriptCreated: ignored " + script.fileName);
      return;
    }
    var scriptInfo = this.registerScript(script);
    JBExtension.BreakpointManager.onScriptCreated(scriptInfo);
  },

  onScriptDestroyed: function(script) {
    if (JBExtension.Debugger.evaluating) return;

    var scriptInfo = this.getScriptInfo(script);
    if (!scriptInfo) return;
    this.unregisterScript(scriptInfo);
    JBExtension.BreakpointManager.onScriptDestroyed(scriptInfo);
  }
};

const PCMAP_SOURCETEXT = JBExtension.Services.jsdIScript.PCMAP_SOURCETEXT;

function ScriptInfo(script) {
  this.script = script;
  this.url = JBExtension.Utils.fixScriptUrl(script.fileName);
  LOG("scriptInfo created: " + this.url);
  this.tag = script.tag;
}

ScriptInfo.prototype.getBaseLineNumber = function() {
  return this.script.baseLineNumber;
}

ScriptInfo.prototype.getSourceText = function() {
  return this.script.functionSource;
}

ScriptInfo.prototype.getLineExtent = function() {
  return this.script.lineExtent;
}

ScriptInfo.prototype.isLineExecutable = function(line) {
  try {
    return this.script.isLineExecutable(line, PCMAP_SOURCETEXT);
  }
  catch (e) {
    //isLineExecutable sometimes throws NS_ERROR_NOT_AVAILABLE
    return false;
  }
}

ScriptInfo.prototype.containsLine = function(line) {
  return this.getBaseLineNumber() <= line && line < this.getBaseLineNumber() + this.getLineExtent();
}

ScriptInfo.prototype.setBreakpoint = function(line) {
  try {
    var pc = this.script.lineToPc(line, PCMAP_SOURCETEXT);
    this.script.setBreakpoint(pc);
    return pc;
  }
  catch(e) {
    ERROR("cannot set breakpoint: " + e);
    return -1;
  }
}

ScriptInfo.prototype.clearBreakpoint = function(line) {
  try {
    var pc = this.script.lineToPc(line, PCMAP_SOURCETEXT);
    this.script.clearBreakpoint(pc);
    return pc;
  }
  catch(e) {
    ERROR("cannot clear breakpoint: " + e);
    return -1;
  }
}
