//incognito mode
if(window.location.origin == "https://search.disconnect.me" || window.location.origin == "https://searchbeta.disconnect.me") {
  var normal_results = document.querySelector("#normal-results");
  if (normal_results != null) {
    var results = normal_results.getElementsByTagName("a");
    for (var i = 0, all = results.length; i < all; i++) {
      var link = results[i];
      link.onclick = function(event) {
        event.preventDefault();

        var data_send = {
          "action": "open_result",
          "type": "new_tab",
          "url": this.href
        };

        var isOpenNewWindow = (event.metaKey != true) && (event.which == 1);
        if (isOpenNewWindow) data_send.type = "new_window";
        chrome.runtime.sendMessage(data_send);
      };
    }
    
    // Ability to open results in new tab (Command + click) on osx / chrome
    document.onkeydown = function(evt) {
      evt = evt || window.event;
      // keyCode 91 - Left Command button Webkit
      // keyCode 93 - Right Command button Webkit
      if(evt.keyCode == 91 || evt.keyCode == 93) {
        for (var i = 0, all = results.length; i < all; i++) {
          var link = results[i];
          link.setAttribute("data-tab", "new");
        }
      }
    };

    document.onkeyup = function(evt) {
      evt = evt || window.event;
      if(evt.keyCode == 91 || evt.keyCode == 93) {
        for (var i = 0, all = results.length; i < all; i++) {
          var link = results[i];
          link.setAttribute("data-tab", "");
        }
      }
    };
  }
}