chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {        
        if (typeof request.imdbCode !== 'undefined') {
            getIMDBHTML(request.imdbCode, sendResponse);
            return true;
        }        
    }
);

function getIMDBHTML(imdbCode, callback) {
    var imdbTriviaURL = "https://www.imdb.com/title/" + imdbCode + "/trivia";
    var request = new XMLHttpRequest();
    request.open('GET', imdbTriviaURL, true);    
    request.onload = function() {        
      if (request.status >= 200 && request.status < 400) {          
        callback(request.responseText);
      } else {
        callback(false);    
      }
    };    
    request.onerror = function() {
      callback(false)
    };    
    request.send();
}

