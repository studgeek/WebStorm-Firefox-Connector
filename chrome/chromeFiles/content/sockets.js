JBExtension.Sockets = {
  defaultPort: 7830,
  listeningAttempts: 5,

  createServerSocket: function () {
    LOG("starting listening");

    for (var i = 0; i < this.listeningAttempts; i++) {
      if (this.startListening(this.defaultPort + i)) {
        return;
      }
    }
    LOG("cannot create server socket");
  },

  startListening: function (port) {
    LOG("trying to open server socket at " + port);
    var serverSocket;
    try {
      serverSocket = JBExtension.Services.createServerSocket(port);
    } catch(e) {
      LOG(e);
      return false;
    }
    var listener = {
      onSocketAccepted: function (server, socketTransport) {
        LOG("socketAccepted");
        JBExtension.JBConnector.disconnect(-1);
        JBExtension.Sockets.connect(socketTransport);
      },
      onStopListening: function(server, status) {
        LOG("stopListening: status = " + status);
      }
    };
    serverSocket.asyncListen(listener);
    LOG("listening at " + port);
    return true
  },

  connect: function(socketTransport) {
    var target = JBExtension.Services.getThreadService().mainThread;
    var input = socketTransport.openInputStream(0, 0, 0);
    input = input.QueryInterface(Components.interfaces.nsIAsyncInputStream);
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
              JBExtension.JBConnector.processMessage(message);
              end = this.messagesBuffer.indexOf(String.fromCharCode(0));
            }
          }
          this.asyncWait();
        }
        catch(e) {
          LOG("Error:");
          LOG(e);
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
    JBExtension.JBConnector.connect(socket);
    callback.asyncWait();
  }
};
