JBExtension.Sockets = {
  createSocket: function(host, port, messageProcessor) {
    LOG("connecting to " + host + ":" + port);
    var socketTransport = JBExtension.Services.getSocketTransportService().createTransport(null, 0, host, port, null);

    var target = JBExtension.Services.getThreadService().mainThread;
    //var socketListener = {
    //    onTransportStatus: function(aTransport, aStatus, aProgress, aProgressMax) {
    //        LOG("socket transport status changed: " + (aStatus-0x804b0000) + ")");
    //        LOG("socket.isAlive() = " + socketTransport.isAlive());
    //    }
    //}
    //socketTransport.setEventSink(socketListener, target)

    var input = socketTransport.openInputStream(0, 0, 0);
    input = input.QueryInterface(Components.interfaces.nsIAsyncInputStream)
    var output = socketTransport.openOutputStream(JBExtension.Services.nsITransport.OPEN_BLOCKING, 0, 0);

    var socket = {
      closed: false,

      send: function(message) {
        message += String.fromCharCode(0);
        //LOG("sending message[" + message.length + "]: " + message);
        var converter = JBExtension.Services.getUtf8Converter();
        message = converter.ConvertFromUnicode(message) + converter.Finish();
        output.write(message, message.length);
        output.flush();
        //LOG("message sent");
      },

      close: function() {
        LOG("socket closing");
        this.closed = true;
        input.asyncWait(null, 0, 0, null);
        input.close();
        output.close();
        socketTransport.close(0);
        LOG("socket closed");
      }
    };

    var binaryInput = JBExtension.Services.createBinaryInput(input);

    var callback = {
      messagesBuffer: "",

      onInputStreamReady: function(stream) {
        LOG("onInputStreamReady()");
        try {
          var count = binaryInput.available();
          if (count > 0) {
            LOG(count + " bytes available");
            var buffer = binaryInput.readBytes(count);
            this.messagesBuffer += buffer;
            var end = this.messagesBuffer.indexOf(String.fromCharCode(0));
            while (end != -1) {
              var converter = JBExtension.Services.getUtf8Converter();
              var message = converter.ConvertToUnicode(this.messagesBuffer.substring(0, end));
              this.messagesBuffer = this.messagesBuffer.substring(end + 1);
              messageProcessor.processMessage(message);
              end = this.messagesBuffer.indexOf(String.fromCharCode(0));
            }
          }
          this.asyncWait();
        }
        catch(e) {
          LOG("Error:")
          LOG(e)
          if (!socket.closed) {
            ERROR("[onInputStreamReady]: " + e);
          }
        }
      },

      asyncWait: function() {
        LOG("waiting for input");
        try {
          input.asyncWait(this, 0, 1, target);
        } catch(e) {
          if (!socket.closed) {
            LOG("[asyncWait]:" + e);
          }
        }
      },

      QueryInterface: function(iid) {
        if (iid.equals(Components.interfaces.nsIInputStreamCallback) || iid.equals(Components.interfaces.nsISupports)) {
          return this;
        }
        throw Components.results.NS_ERROR_NO_INTERFACE;
      }
    };
    callback.asyncWait();

    return socket;
  }
};
