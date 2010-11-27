JBExtension.ValueUtil = {
  getValueType: function(value) {
    var type = value.jsType;
    if (type == JBExtension.Services.jsdIValue.TYPE_STRING) {
      return 1;
    }
    else if (type == JBExtension.Services.jsdIValue.TYPE_OBJECT) {
      return 2;
    }
    else if (type == JBExtension.Services.jsdIValue.TYPE_FUNCTION) {
      return 3;
    }
    else {
      return 0;
    }
  }
};

function ValuesRegistry() {
  this.nextId = 0;
  this.id2value = {};
}

ValuesRegistry.prototype.putValue = function(value) {
  var id = this.nextId;
  this.id2value[id] = value;
  this.nextId++;
  return id;
}

ValuesRegistry.prototype.sendValue = function(connector, id, name, value) {
  if (!value) return;

  var valueId = this.putValue(value);
  var stringValue;
  if (value.jsType == JBExtension.Services.jsdIValue.TYPE_FUNCTION) {
    stringValue = "function " + value.jsFunctionName + "()";
  }
  else if (value.jsType == JBExtension.Services.jsdIValue.TYPE_OBJECT && value.jsClassName != "Error") {
    stringValue = value.jsClassName;
  }
  else {
    stringValue = value.stringValue;
  }
  connector.sendValueInfoResponse(id, name, valueId, JBExtension.ValueUtil.getValueType(value), value.jsClassName, stringValue);
};

ValuesRegistry.prototype.sendValues = function(connector, id, values) {
  values.sort(function (a, b) {
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
  for (var i = 0; i < values.length; i++) {
    this.sendValue(connector, id, values[i].name, values[i].value);
  }
};

ValuesRegistry.prototype.computeProperties = function(connector, id, valueId) {
  LOG("computingProperties for " + valueId);
  var parent = this.id2value[valueId];
  if (parent) {
    var jsParent = parent.getWrappedValue();
    var values = [];
    for (var name in jsParent) {
      try {
        var property = parent.getProperty(name);
        if (property) {
          values.push({name: name, value: property.value});
        }
        else {
          values.push({name: name, value: JBExtension.Debugger.jsd.wrapValue(jsParent[name])});
        }
      }
      catch(e) {
        LOG("cannot evaluate [" + name + "]");
      }
    }
    this.filterAndSendValues(connector, id, values);

    //this.sendValue(connector, id, "parent", value.jsParent)
    //this.sendValue(connector, id, "prototype", value.jsPrototype)

  }
  connector.sendFinishedResponse(id);
}

ValuesRegistry.prototype.filterAndSendValues = function(connector, id, values) {
  var arrayValues = [];
  var otherValues = [];
  var nativeValues = [];
  var funValues = [];
  var nativeFunValues = [];
  var domValues = [];

  for (var i = 0; i < values.length; i++) {
    var pair = values[i];
    var name = pair.name;
    var index = parseInt(name);
    var value = pair.value;
    var isNative = value.isNative;
    var jsClassName = value.jsClassName;
    var isFunction = value.jsType == JBExtension.Services.jsdIValue.TYPE_FUNCTION;

    //LOG(" [" + name + "]: isnative=" + isNative + ", jsClassName = " + jsClassName);
    var target;
    if (index || index == 0) {
      pair.name = index;
      target = arrayValues;
      //LOG("  -> array");
    }
    else if (isFunction) {
      target = isNative ? nativeFunValues : funValues;
      //LOG("  -> " + (isNative ? "native " : "") + "fun");
    }
    else {
      if (jsClassName && (JBExtension.Utils.startsWith(jsClassName, "DOM") || JBExtension.Utils.startsWith(jsClassName, "HTML"))) {
        target = domValues;
        //LOG("  -> dom");
      }
      else {
        target = isNative ? nativeValues : otherValues;
        //LOG("  -> " + (isNative ? "native" : "other"));
      }
    }
    target.push(pair);
  }

  this.sendValues(connector, id, arrayValues);
  this.sendValues(connector, id, otherValues);
  this.sendValues(connector, id, nativeValues);

  if (JBExtension.Debugger.settings.showFunctions) {
    this.sendValues(connector, id, funValues);
    if (!JBExtension.Debugger.settings.showUserFunctionsOnly) {
      this.sendValues(connector, id, nativeFunValues);
    }
  }
  if (JBExtension.Debugger.settings.showDOM) {
    this.sendValues(connector, id, domValues);
  }
};
