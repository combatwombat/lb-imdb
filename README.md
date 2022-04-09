# Letterboxd IMDb Trivia

Chrome and Firefox extension to add IMDb trivia to a letterboxd movie page.

[Firefox Addon](https://addons.mozilla.org/de/firefox/addon/letterboxd-imdb)  
[Chrome Extension](https://chrome.google.com/webstore/detail/letterboxd-imdb-trivia/ekhlhijgenghbhpdhbhkmcoebkilldfi) 

![Trivia Tab](/img/screenshot.png)

## How to build and test

`src/shared` contains the main code. `src/chrome` and `src/firefox` have browser-specific files that overwrite the ones in `shared` at the build step.

To build both versions, run the `./build.sh` Bash script in the main folder. `dist/chrome/src` then contains the extension for that browser, `lb-imdb.zip` is that folder zipped for distribution in the Web- and Add-on stores.

To test the extension in chrome, [enable developer mode](https://developer.chrome.com/docs/extensions/mv3/faq/) and load the `dist/chrome/src` folder.

In Firefox, [load the temporary Add-on in about:debugging](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Your_first_WebExtension).