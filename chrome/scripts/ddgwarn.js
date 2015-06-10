// Script to inject on duckduckgo.com/html to warn user about no proxy on DDG. 
function showDDGwarn() {
  if (localStorage.showDDG == undefined) {
      //event.preventDefault();
			var maskHeight = $(document).height();
			var maskWidth = $(window).width();
			$('#mask').css({'width':maskWidth,'height':maskHeight});
			$('#mask').fadeIn(1000);
			$('#mask').fadeTo("slow",0.8);
	
			//Get the window height and width
			var winH = $(window).height();
			var winW = $(window).width();
			$('#dialogDDG').css('top', winH/2-$('#dialogDDG').height()/2);
			$('#dialogDDG').css('left', winW/2-$('#dialogDDG').width()/2);
			$('#dialogDDG').fadeIn(2000);
			$('.window .close').click(function (e) {
				e.preventDefault();
				$('#mask').hide();
				$('.window').hide();
				localStorage.showDDG = false;
			});
  }
}

var htmlWarn = '<div id="dialogDDG" class="window">' +
  ' Just a heads-up, because DuckDuckGo takes user privacy (<a href="https://duckduckgo.com/privacy">https://duckduckgo.com/privacy</a>) seriously, search queries go directly to them, unlike other search engines which are proxied through Disconnect ' +
	'	<div align="center"> <input type="button" value="Okay, got it" class="close"/> </div>' +
	'<div align="right"><a href="https://duckduckgo.com" ><img src="https://search.disconnect.me/images/duckduckgo-logo.png" /></a></div></div>' +
	'</div><div id="mask"></div>';

document.body.innerHTML += htmlWarn;
showDDGwarn();

