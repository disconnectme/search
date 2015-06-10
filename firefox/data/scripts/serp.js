function getHostname(href) {
  var l = window.document.createElement("a");
  l.href = href;
  return l.hostname;
};

function modifyForm() {
  var domain = getHostname(window.document.URL);

  var isGoogle = (domain.indexOf(".google.")>=0);
  var isBing = (domain.indexOf("bing.com")>=0);
  var isYahoo = (domain.indexOf("yahoo.com")>=0);
  var isBlekko = (domain.indexOf("blekko.com")>=0);
  var isDDG = (domain.indexOf("duckduckgo.com")>=0);

  if (isGoogle || isBing || isYahoo || isBlekko || isDDG) {
    var forms = window.document.getElementsByTagName('form');
    forms = [].slice.call(forms, 0);

    forms.forEach(function(f) {
      if (f.action) {
        var element = document.createElement('input');
        element.setAttribute('type', 'hidden');
        element.setAttribute('name', 'search_plus_one');
        element.setAttribute('value', 'form');
        f.appendChild(element);

        if (isGoogle) f.onsubmit = function() { f.submit(); };
        //alert('JavaScript injected in Search FORM!');
      }
    });
  }
};

modifyForm();
//incognito mode
if(window.location.origin == "https://searchbeta.disconnect.me" || window.location.origin == "https://search.disconnect.me") {

  var normal_results = document.querySelector("#normal-results");
  if (normal_results != null) {

    var results = normal_results.getElementsByTagName("a");
    for (var i = 0, all = results.length; i < all; i++) {
          var link = results[i];
          link.onclick = function(event){
          var href = this.href
          event.preventDefault();
          if (this.getAttribute("data-tab") == "new") {
              self.port.emit("openResult", href);
            this.setAttribute("data-tab", "");
          } else {
            self.port.emit("openResult", href);
          }
        }
    }
   /* // Ability to open results in new tab (Command + click) on osx / chrome
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
    }

    document.onkeyup = function(evt) {
      evt = evt || window.event;
      if(evt.keyCode == 91 || evt.keyCode == 93) {
        for (var i = 0, all = results.length; i < all; i++) {
          var link = results[i];
          link.setAttribute("data-tab", "")
        }
      }
    } */
  }
}
