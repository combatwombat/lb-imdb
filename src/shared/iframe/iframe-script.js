let imdbCode = window.location.hash.substring(1);
if (imdbCode.length) {
    document.getElementById("iframe").setAttribute("src", "https://www.imdb.com/title/"+imdbCode+"/trivia/?ref_=tt_trv_trv");

    window.addEventListener('message', function(event) {

        // is it a message from our code inside the imdb iframe?
        if (typeof event.data.lb_imdb !== "undefined") {
            window.parent.postMessage(event.data.lb_imdb, "*");
        }
    });

}
