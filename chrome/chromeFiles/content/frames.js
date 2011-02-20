JBExtension.FrameUtil = {
  computeFrameDepth: function(frame) {
    var depth = 0;
    var current = frame;
    while (current) {
      current = current.callingFrame;
      depth++;
    }
    return depth;
  }
}

function FramesList(topFrame) {
  this.values = new ValuesRegistry();
  this.frames = [];
  var current = topFrame;
  this.depth = 0;
  while (current) {
    this.frames.push(new FrameInfo(current, this.depth));
    current = current.callingFrame;
    this.depth++;
  }
}

FramesList.prototype.computeValues = function(connector, id, frameIndex) {
  var frameInfo = this.frames[frameIndex];
  this.values.sendValue(connector, id, "this", frameInfo.frame.thisValue);

  var propertiesRef = {value: null};
  var lengthRef = {value: 0};
  frameInfo.frame.scope.getProperties(propertiesRef, lengthRef);
  var values = [];
  for (var i = 0; i < lengthRef.value; i++) {
    var property = propertiesRef.value[i];
    values.push({name: property.name.stringValue, value: property.value});
  }
  this.values.filterAndSendValues(connector, id, values);
  connector.sendFinishedResponse(id);
};

FramesList.prototype.evaluate = function(connector, id, code, url, line, frameIndex) {
  var frameInfo = this.frames[frameIndex];
  LOG("Evaluating '" + code + "'")
  try {
    var value = JBExtension.Debugger.frameEval(frameInfo.frame, code, url, line);
    this.values.sendValue(connector, id, "result", value);
  }
  catch(e) {
    LOG("Cannot evaluate: " + e);
    connector.sendErrorResponse(id, e);
  }
};

function FrameInfo(frame, index) {
  this.frame = frame;
  this.url = JBExtension.Utils.fixScriptUrl(frame.script.fileName);
  this.index = index;
  LOG("frame[" + index + "]: " + this.url);
}

FrameInfo.prototype.getLine = function() {
  return this.frame.line;
};

FrameInfo.prototype.getFunctionName = function() {
  return this.frame.functionName;
};

FrameInfo.prototype.getScriptTag = function() {
  return this.frame.script.tag;
};