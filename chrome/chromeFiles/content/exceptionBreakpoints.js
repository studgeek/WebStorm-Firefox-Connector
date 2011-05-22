JBExtension.ExcBreakpointManager = {
  url2breakpoints: {},
  id2breakpoint: {},
  clearData: function() {
    this.id2breakpoint = {}
  },

  registerBreakpoint: function(breakpointId, exceptionName, condition, logExpression) {
    LOG("registering exception breakpoint: " + exceptionName);
    this.id2breakpoint[breakpointId] = new ExcBreakpointInfo(breakpointId, exceptionName, condition, logExpression);
  },

  unregisterBreakpoint: function(breakpointId) {
    delete this.id2breakpoint[breakpointId];
  },

  findBreakpoint: function(excWrapper) {
    var excName = null;
    if (excWrapper) {
      var excValue = excWrapper.value;
      if (excValue) {
        try {
          var nameProperty = excValue.getProperty("name");
          if (nameProperty) {
            excName = nameProperty.value.stringValue;
          }
        }
        catch(e) {
          LOG("cannot evaluate exception name: " + e)
        }
      }
    }
    LOG("findBreakpoint: exception name=" + excName)
    var defaultBreakpoint = null;
    for (var breakpointId in this.id2breakpoint) {
      var breakpoint = this.id2breakpoint[breakpointId]
      if (!breakpoint.exceptionName) {
        defaultBreakpoint = breakpoint;
      }
      else if (excName && excName == breakpoint.exceptionName) {
        return breakpoint;
      }
    }
    return defaultBreakpoint;
  }
}

function ExcBreakpointInfo(id, exceptionName, condition, logExpression) {
  this.id = id;
  this.exceptionName = exceptionName;
  this.condition = condition;
  this.logExpression = logExpression;
}

