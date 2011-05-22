const RETURN_CONTINUE = JBExtension.Services.jsdIExecutionHook.RETURN_CONTINUE;
const RETURN_CONTINUE_THROW = JBExtension.Services.jsdIExecutionHook.RETURN_CONTINUE_THROW;
const TYPE_BREAKPOINT = JBExtension.Services.jsdIExecutionHook.TYPE_BREAKPOINT;
const TYPE_THROW = JBExtension.Services.jsdIExecutionHook.TYPE_THROW;
const TYPE_INTERRUPTED = JBExtension.Services.jsdIExecutionHook.TYPE_INTERRUPTED;

const TYPE_TOPLEVEL_END = JBExtension.Services.jsdICallHook.TYPE_TOPLEVEL_END;
const TYPE_FUNCTION_CALL = JBExtension.Services.jsdICallHook.TYPE_FUNCTION_CALL;
const TYPE_FUNCTION_RETURN = JBExtension.Services.jsdICallHook.TYPE_FUNCTION_RETURN;

const FIREBUG_ENABLE_SCRIPT_PREF_NAME = "extensions.firebug.script.enableSites";
const FIREBUG_ENABLE_CONSOLE_PREF_NAME = "extensions.firebug.console.enableSites";

JBExtension.Debugger = {
  jsd: null,
  connector: null,
  suspended: false,
  evaluating: false,
  pausing: false,
  settings: {showDOM: false, showFunctions: true, showUserFunctionsOnly: true},

  start: function(connector) {
    if (this.jsd) return;

    var pref = JBExtension.Services.getPrefBranch();
    if (pref.prefHasUserValue(FIREBUG_ENABLE_SCRIPT_PREF_NAME)) {
      LOG("disabling Firebug's script panel");
      pref.setBoolPref(FIREBUG_ENABLE_SCRIPT_PREF_NAME, false);
    }
    if (pref.prefHasUserValue(FIREBUG_ENABLE_CONSOLE_PREF_NAME)) {
      LOG("disabling Firebug's console panel");
      pref.setBoolPref(FIREBUG_ENABLE_CONSOLE_PREF_NAME, false);
    }

    this.connector = connector;
    this.jsd = JBExtension.Services.getDebuggerService();
    JBExtension.BreakpointManager.clearData();
    if (this.jsd.isOn) {
      this.onDebuggerActivated();
    }
    else {
      if (this.jsd.asyncOn) {
        //Firefox 4
        this.jsd.asyncOn({
          onDebuggerActivated: function() {
            JBExtension.Debugger.onDebuggerActivated();
          }
        });
      }
      else {
        //Firefox 3.x
        this.jsd.on();
        this.onDebuggerActivated();
      }
    }
  },

  onDebuggerActivated:function() {
    while (this.jsd.pauseDepth > 0) {
      this.jsd.unPause();
    }
    this.jsd.breakpointHook = {onExecute: JBExtension.Utils.wrapCallback(this.onBreakpoint, this)};
    this.jsd.throwHook = {onExecute: JBExtension.Utils.wrapCallback(this.onBreakpoint, this)};
    this.evaluating = false;
    JBExtension.FiltersManager.appendFilters(this.jsd);
    JBExtension.BreakpointManager.connector = this.connector;
    JBExtension.ScriptManager.connector = this.connector;
    JBExtension.ScriptManager.registerScripts(this.jsd);
    this.jsd.scriptHook = {
      onScriptCreated: JBExtension.Utils.wrapCallback(JBExtension.ScriptManager.onScriptCreated, JBExtension.ScriptManager),
      onScriptDestroyed: JBExtension.Utils.wrapCallback(JBExtension.ScriptManager.onScriptDestroyed, JBExtension.ScriptManager)
    };
    LOG("scriptHook set");
  },

  onBreakpoint: function(frame, type, val) {
    var lineBreakpoint = type == TYPE_BREAKPOINT;
    var defaultContinue;
    if (lineBreakpoint) {
      defaultContinue = RETURN_CONTINUE;
    }
    else if (type == TYPE_THROW) {
      defaultContinue = RETURN_CONTINUE_THROW;
    }
    else {
      return RETURN_CONTINUE;
    }

    if (frame.isNative || JBExtension.ScriptManager.ignoreScript(frame.script)) {
      return defaultContinue;
    }
    if (lineBreakpoint && JBExtension.FiltersManager.doNotStep(frame.script.fileName)) {
      return defaultContinue;
    }

    LOG("Breakpoint reached in " + frame.script.fileName + " at line " + frame.line);
    var scriptInfo = JBExtension.ScriptManager.getScriptInfo(frame.script);
    if (!scriptInfo) {
      LOG("cannot find script");
      return defaultContinue;
    }

    var breakpoint;
    if (lineBreakpoint) {
      breakpoint = JBExtension.BreakpointManager.findBreakpoint(scriptInfo, frame.pc);
      if (!breakpoint) {
        LOG("breakpoint not found");
      }
    }
    else {
      breakpoint = JBExtension.ExcBreakpointManager.findBreakpoint(val)
    }
    if (!breakpoint) {
      return defaultContinue;
    }

    if (breakpoint.condition) {
      try {
        LOG("Evaluating condition: " + breakpoint.condition);
        var result = this.frameEval(frame, breakpoint.condition, frame.script.fileName, frame.line).booleanValue;
        LOG("result = " + result);
        if (result == false) {
          return defaultContinue;
        }
      }
      catch(e) {
        LOG("Cannot evaluate conidition: " + e);
      }
    }

    if (breakpoint.id >= 0) {
      var logMessage = null;
      if (breakpoint.logExpression) {
        try {
          LOG("Evaluating log expression: " + breakpoint.logExpression);
          logMessage = this.frameEval(frame, breakpoint.logExpression, frame.script.fileName, frame.line).stringValue;
          LOG("result = " + logMessage);
        }
        catch(e) {
          LOG("Cannot evaluate conidition: " + e);
        }
      }

      if (lineBreakpoint) {
        this.connector.sendBreakpointReachedResponse(breakpoint.id, logMessage, frame);
      }
      else {
        this.connector.sendExcBreakpointReachedResponse(breakpoint.id, scriptInfo.url, frame.line, logMessage, frame);
      }
    }
    else {
      this.connector.sendSuspendedResponse(scriptInfo.url, frame.line, frame);
    }
    this.suspend(frame);
    return defaultContinue;
  },

  suspend: function(frame) {
    if (this.suspended) {
      ERROR("already suspended");
      return;
    }
    JBExtension.BreakpointManager.unregisterTemporaryBreakpoints();
    JBExtension.SteppingManager.clear();
    this.jsd.interruptHook = null;
    this.jsd.functionHook = null;
    this.framesList = new FramesList(frame);
    this.topFrame = this.framesList.frames[0];
    this.pausing = false;
    this.suspended = true;
    this.jsd.enterNestedEventLoop({ onNest: function () {
    } });
  },

  assertSuspended: function() {
    if (!this.suspended) {
      ERROR("not suspended");
      return false;
    }
    return true;
  },

  startStepping: function(hook) {
    if (!this.assertSuspended()) return;
    hook.setupHooks(this.topFrame.frame.script);
    this.resume();
  },

  stepOver: function() {
    var hook = new SteppingHook(this.jsd, this.framesList.depth, this.framesList.depth);
    hook.skipCurrentLine(this.topFrame);
    this.startStepping(hook);
  },

  stepInto: function() {
    var hook = new SteppingHook(this.jsd, this.framesList.depth, Number.MAX_VALUE);
    hook.skipCurrentLine(this.topFrame);
    this.startStepping(hook);
  },

  stepIntoFunction: function(functionName) {
    LOG("stepIntoFunction " + functionName);
    var hook = new SteppingHook(this.jsd, this.framesList.depth, Number.MAX_VALUE);
    hook.skipCurrentLine(this.topFrame);
    hook.setExpectedFunctionName(functionName);
    this.startStepping(hook);
  },

  stepOut: function() {
    var hook = new SteppingHook(this.jsd, this.framesList.depth, this.framesList.depth - 1);
    this.startStepping(hook);
  },

  runTo: function(url, line) {
    JBExtension.BreakpointManager.registerBreakpoint(-1, url, line, null, null);
    this.resume();
  },

  pause: function() {
    if (!this.suspended || this.pausing || !this.jsd) return;
    if (!this.jsd.interruptHook) {
      var script = this.topFrame.frame.script;
      new SteppingHook(this.jsd, this.framesList.depth, Number.MAX_VALUE).setupHooks(script);
    }
  },

  sendFrames: function(id, from, count) {
    if (!this.assertSuspended()) return;

    var to = count == -1 ? this.framesList.frames.length : Math.min(from + count, this.framesList.frames.length);
    for (var i = from; i < to; i++) {
      this.connector.sendStackFrameInfoResponse(id, this.framesList.frames[i]);
    }
    this.connector.sendFinishedResponse(id);
  },

  computeFrameValues: function(id, frameIndex) {
    if (!this.assertSuspended()) return;
    this.framesList.computeValues(this.connector, id, frameIndex);
  },

  computeProperties: function(id, valueId) {
    if (!this.assertSuspended()) return;
    this.framesList.values.computeProperties(this.connector, id, valueId);
  },

  evaluate: function(id, code, url, line, frameIndex) {
    if (!this.assertSuspended()) return;

    this.framesList.evaluate(this.connector, id, code, url, line, frameIndex);
  },

  frameEval: function(frame, code, url, line) {
    var oldEvaluating = this.evaluating;
    try {
      this.evaluating = true;
      var result = {value: null};
      frame.eval(code, url, line, result);
      return result.value;
    }
    finally {
      this.evaluating = oldEvaluating;
    }
  },

  resume: function() {
    if (!this.assertSuspended()) return;
    this.suspended = false;
    this.framesList = null;
    this.topFrame = null;
    this.jsd.exitNestedEventLoop();
    LOG("resumed");
  },

  stop: function() {
    if (!this.jsd) return;
    LOG("stopping debugger");
    JBExtension.FiltersManager.removeFilters(this.jsd);
    this.jsd.scriptHook = null;
    this.jsd.breakpointHook = null;
    JBExtension.SteppingManager.clear();
    this.jsd.interruptHook = null;
    this.jsd.functionHook = null;
    if (this.suspended) {
      this.resume();
    }
    this.jsd.off();
    this.jsd = null;
    LOG("debugger stopped");
  }
};

function SteppingHook(jsd, currentDepth, maxDepth) {
  this.jsd = jsd;
  this.currentDepth = currentDepth;
  this.maxDepth = maxDepth;
  this.skippedScriptTag = -1;
  this.skippedLine = -1;
  var hook = this;
  this.interruptHook = {
    onExecute: JBExtension.Utils.wrapCallback(hook.onInterrupted, hook)
  };
}

SteppingHook.prototype.setExpectedFunctionName = function(functionName) {
  this.expectedFunction = functionName;
  this.expectedDepth = this.currentDepth;
};

SteppingHook.prototype.skipCurrentLine = function(frameInfo) {
  this.skippedScriptTag = frameInfo.getScriptTag();
  this.skippedLine = frameInfo.getLine();
};

SteppingHook.prototype.setupHooks = function(script) {
  var hook = this;
  this.jsd.functionHook = {
    onCall: JBExtension.Utils.wrapCallback(hook.onFunctionCall, hook)
  }
  if (this.currentDepth <= this.maxDepth && !this.expectedFunction) {
    this.jsd.interruptHook = this.interruptHook;
    JBExtension.SteppingManager.enableInterrupts(script)
  }
};

SteppingHook.prototype.onFunctionCall = function(frame, type) {
  switch (type) {
    case TYPE_TOPLEVEL_END:
      this.jsd.interruptHook = null;
      this.jsd.functionHook = null;
      break;

    case TYPE_FUNCTION_CALL:
      if (this.currentDepth == this.maxDepth) {
        this.jsd.interruptHook = null;
      }
      LOG("function call: current=" + this.currentDepth + ", expected=" + this.expectedDepth);
      if (this.currentDepth == this.expectedDepth) {
        this.jsd.interruptHook = this.interruptHook;
      }
      if (this.jsd.interruptHook) {
        JBExtension.SteppingManager.enableInterrupts(frame.script);
      }
      this.currentDepth++;
      break;

    case TYPE_FUNCTION_RETURN:
      this.currentDepth--;
      if (this.currentDepth == this.maxDepth && frame.callingFrame) {
        this.jsd.interruptHook = this.interruptHook;
        JBExtension.SteppingManager.enableInterrupts(frame.callingFrame.script)
      }
      if (this.expectedFunction && this.currentDepth < this.expectedDepth) {
        this.jsd.interruptHook = null;
        this.jsd.functionHook = null;
      }
      break;
  }
};

SteppingHook.prototype.onInterrupted = function(frame, type, val) {
  if (type != TYPE_INTERRUPTED) {
    return RETURN_CONTINUE;
  }
  if (!JBExtension.Debugger.pausing) {
    if (frame.isNative) {
      return RETURN_CONTINUE;
    }
    if (JBExtension.FiltersManager.doNotStep(frame.script.fileName)) {
      return RETURN_CONTINUE;
    }
  }

  var depth = JBExtension.FrameUtil.computeFrameDepth(frame);
  var scriptTag = frame.script.tag;
  var line = frame.line;
  if (depth > this.maxDepth || scriptTag == this.skippedScriptTag && line == this.skippedLine) {
    return RETURN_CONTINUE;
  }
  LOG("interrupted: " + this.expectedFunction + " expected, current = " + frame.functionName);
  if (this.expectedFunction && this.expectedFunction != frame.functionName) {
    this.jsd.interruptHook = null;
    return RETURN_CONTINUE;
  }

  var scriptInfo = JBExtension.ScriptManager.getScriptInfo(frame.script);
  if (!scriptInfo) {
    LOG("script not found: " + frame.script.fileName);
    return RETURN_CONTINUE;
  }

  LOG("interrupted after step in " + scriptInfo.url + " at " + line);
  JBExtension.Debugger.connector.sendSuspendedResponse(scriptInfo.url, line, frame);
  JBExtension.Debugger.suspend(frame);

  return RETURN_CONTINUE;
};

JBExtension.SteppingManager = {
  scripts: {},

  enableInterrupts: function(script) {
    if (!script.enableSingleStepInterrupts || script.tag in this.scripts) {
      return
    }
    script.enableSingleStepInterrupts(true);
    this.scripts[script.tag] = script;
  },

  clear: function() {
    for (var tag in this.scripts) {
      this.scripts[tag].enableSingleStepInterrupts(false);
    }
    this.scripts = {};
  }
}
