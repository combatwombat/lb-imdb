if (typeof browser === 'undefined') {
    browser = chrome;
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restoreOptions() {
    browser.storage.local.get({
        hideSpoilers: false
    }, function(items) {
        document.getElementById('hide-spoilers').checked = items.hideSpoilers;
    });
}

function onload() {
    restoreOptions();

    document.getElementById('hide-spoilers').addEventListener('change', function () {
        browser.storage.local.set({
            hideSpoilers: this.checked
        });
    });
}
document.addEventListener('DOMContentLoaded', onload);
