// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restoreOptions() {
    chrome.storage.sync.get({
        hideSpoilers: false
    }, function(items) {
        document.getElementById('hide-spoilers').checked = items.hideSpoilers;
    });
}

function onload() {
    restoreOptions();

    document.getElementById('hide-spoilers').addEventListener('change', function () {
        chrome.storage.sync.set({
            hideSpoilers: this.checked
        });
    });
}
document.addEventListener('DOMContentLoaded', onload);
