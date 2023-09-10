let imdbCode = window.location.hash.substring(1);
if (imdbCode.length) {
    document.getElementById("iframe").setAttribute("src", "https://www.imdb.com/title/"+imdbCode+"/trivia/?ref_=tt_trv_trv");

    window.addEventListener('message', function(event) {
        // if it's a message from our code inside the imdb iframe (iframe-imdb-script.js), send it on to content.js
        if (typeof event.data.lb_imdb !== "undefined") {
            window.parent.postMessage(event.data, "*");
        }
    });
}
