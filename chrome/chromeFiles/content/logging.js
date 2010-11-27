function ERROR(msg) {
  if (JBExtension.isProcessingLogMessage) return;
  Components.utils.reportError(msg);
}

function LOG(msg) {
  //LOG_TO_FILE(msg);
  if (JBExtension.isProcessingLogMessage) return;

  if (JBExtension.isLoggingEnabled) {
    var consoleService = JBExtension.Services.getConsoleService();
    consoleService.logStringMessage("JB:" + msg);
  }
}

/*
function LOG_TO_FILE(msg) {
  var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
  file.initWithPath("/home/nik/temp/js/log.txt");
  var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
  foStream.init(file, 0x02 | 0x08 | 0x10, 0666, 0);
  var converter = Components.classes["@mozilla.org/intl/converter-output-stream;1"].createInstance(Components.interfaces.nsIConverterOutputStream);
  converter.init(foStream, "UTF-8", 0, 0);
  converter.writeString(msg + "\n");
  converter.close();
}
*/
