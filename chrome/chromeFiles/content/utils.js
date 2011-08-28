JBExtension.Utils = {
  parseMessage: function(text) {
    LOG("Parsing message: " + text);
    var command = new Object();

    var nameEnd = text.indexOf(' ');
    command.name = text.substring(0, nameEnd);

    var idEnd = text.indexOf(' ', nameEnd + 1);
    command.id = idEnd == -1 ? text.substring(nameEnd + 1) : text.substring(nameEnd+1, idEnd);

    command.parameters = {};
    if (idEnd != -1) {

      var k = idEnd+1;
      while (k < text.length) {
        var eq = text.indexOf('=', k);
        if (eq == -1) break;

        var parameterName = text.substring(k, eq);
        var parameterValue = "";
        k = eq+1;
        while (k < text.length && text.charAt(k) != ' ') {
          var c = text.charAt(k);
          if (c == '\\' && k < text.length-1 && text.charAt(k+1) == ' ') {
            c = ' ';
            k++;
          }
          parameterValue += c;
          k++;
        }
        k++;

        if (parameterName in command.parameters) {
          var oldValue = command.parameters[parameterName];
          if (typeof(oldValue) == "string") {
            command.parameters[parameterName] = [oldValue];
          }
          command.parameters[parameterName].push(parameterValue)
        }
        else {
          command.parameters[parameterName] = parameterValue;
        }
      }
    }

    return command;
  },

  escapeSpaces: function(s) {
    if (s.indexOf(' ') == -1) return s;
    var t = "";
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (c == ' ') t += "\\";
      t += c;
    }
    return t;
  },

  wrapCallback: function(fun, instance) {
    return function() {
      try {
        return fun.apply(instance, arguments);
      }
      catch(e) {
        ERROR(e);
      }
    }
  },

  trimFrom: function(s, c) {
    var i = s.indexOf(c);
    if (i == -1) {
      return s;
    }
    return s.substring(0, i);
  },

  fixScriptUrl: function(scriptUrl) {
      var fileUrl;
      // If this is a chrome URL, convert it to the local file path which is how breakpoint requests will be sent from
      // the IDE.
      // Note that this can result in a jar:file:// url, that doesn't hurt anything but obviously it will never
      // match any files in the IDE either. We may want to ignore scripts that are in jars just to reduce some clutter.
      fileUrl = JBExtension.Utils.startsWith(scriptUrl, "chrome://") ?
              this.convertChromeUrlToFileUrl(scriptUrl)
              : scriptUrl;

      if (!fileUrl) { // We shouldn't get here because this URL should have been ignored
          ERROR("No file URL for chrome URL " + scriptUrl);
      }

      if (fileUrl.length > 7 && fileUrl.substring(0, 6) == "file:/" && fileUrl.charAt(6) != "/") {
          return "file:///" + fileUrl.substring(6);
      }

      return fileUrl;
  },

  crs: Components.classes['@mozilla.org/chrome/chrome-registry;1'].getService(Components.interfaces.nsIChromeRegistry),

  ios: Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService),

    // Converts a chrome URL to the local file URL (which may be a jar:file: URL). If a chrome URL can't be converted
    // then null is returned.
    // The null result is for a small set of URLs that throw a "restricted URI" exception, the only case we have
    // found for that is chrome://extensiondev/content/extensiondevOverlay.js, but there may be others.
    convertChromeUrlToFileUrl: function(scriptUrl) {
        try {
            var nsIURI = this.ios.newURI(decodeURI(scriptUrl), 'UTF-8', null);
            return this.crs.convertChromeURL(nsIURI).spec;
        } catch(e) {
            //LOG("Error converting chrome URL " + scriptUrl + " - " + e);
            return "";
        }

    },

    convertToScriptUrl: function(normalUrl) {
    if (this.startsWith(normalUrl, "file:///")) {
      return "file:/" + normalUrl.substring(8);
    }
    return normalUrl;
  },

  startsWith: function(s, prefix) {
    return s.length >= prefix.length && s.substr(0, prefix.length) == prefix;
  },

  endsWith: function(s, suffix) {
    return s.length >= suffix.length && s.substr(s.length - suffix.length) == suffix;
  },

  /**
   * must be synchronized with JsFileUtil#trimUrlParameters
   */
  trimUrlParameters: function(url) {
    url = this.trimFrom(url, "?");
    url = this.trimFrom(url, ";");
    url = this.trimFrom(url, "#");
    return url;
  }
};

function MultiMap() {
  this.map = {}
}

MultiMap.prototype = {
  clear: function() {
    this.map = {}
  },

  put: function(key, value) {
    if (!(key in this.map)) {
      this.map[key] = [];
    }
    this.map[key].push(value);
  },

  getValues: function(key) {
    if (key in this.map) {
      return this.map[key];
    }
    return []
  },

  remove: function(key, value) {
    if (key in this.map) {
      var values = this.map[key];
      var i = values.indexOf(value);
      if (i != -1) {
        values.splice(i, 1);
      }
    }
  }
}