JBExtension.FiltersManager = {
  urlPatterns: [],
  activeFilters: [],
  ignoredPrefixes: [],
  ignoredSuffixes: [],
  ignoredUrls: [],

  setUrlPatterns: function(urlPatterns) {
    this.urlPatterns = urlPatterns;
  },

  doNotStep: function(url) {
    for (var i = 0; i < this.ignoredUrls.length; i++) {
      if (url == this.ignoredUrls[i]) {
        return true;
      }
    }
    for (var j = 0; j < this.ignoredPrefixes.length; j++) {
      if (JBExtension.Utils.startsWith(url, this.ignoredPrefixes[j])) {
        return true;
      }
    }
    for (var k = 0; k < this.ignoredSuffixes.length; k++) {
      if (JBExtension.Utils.endsWith(url, this.ignoredSuffixes[k])) {
        return true;
      }
    }
    return false;
  },

  appendFilters: function(jsd) {
    for (var i = 0; i < this.urlPatterns.length; i++) {
      this.appendFilter(jsd, this.urlPatterns[i]);
    }
    //jsd.refreshFilters();
  },

  appendFilter: function (jsd, urlPattern) {
    if (/^(((http|file|chrome):\/\/)|(\*))/.test(urlPattern)) {
      urlPattern = JBExtension.Utils.convertToScriptUrl(urlPattern);
      var first = urlPattern.indexOf("*");
      var last = urlPattern.lastIndexOf("*");
      if (first == -1 || first == urlPattern.length-1 || last == 0) {
        //todo[nik] use jsd filters
        //doAppendJsdFilter(jsd, urlPattern);
        if (last == 0) {
          this.ignoredSuffixes.push(urlPattern.substring(1));
        }
        else if (first == urlPattern.length-1) {
          this.ignoredPrefixes.push(urlPattern.substring(0, first));
        }
        else {
          this.ignoredUrls.push(urlPattern);
        }
        LOG("filter appended: " + urlPattern);
        return;
      }
    }
    ERROR("incorrect filter, ignored: " + urlPattern);
  },

  doAppendJsdFilter: function(jsd, urlPattern) {
    var filter = {
      globalObject: null,
      endLine: 0,
      startLine: 0,
      flags: JBExtension.Services.jsdIFilter.FLAG_ENABLED,
      urlPattern: urlPattern
    };
    jsd.appendFilter(filter);
    this.activeFilters.push(filter);
  },

  removeFilters: function(jsd) {
    this.ignoredPrefixes = [];
    this.ignoredSuffixes = [];
    this.ignoredUrls = [];
    for (var i = 0; i < this.activeFilters.length; i++) {
      jsd.removeFilter(this.activeFilters[i]);
    }
  }
}