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

    fetch(imdbTriviaURL)
    .then(response => response.text())
    .then(data => callback(data))
    .catch((error) => callback(false));
    
}

