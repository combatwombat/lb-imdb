(function() {
    var tabs = document.querySelectorAll('.content-tab-filters .tablist a');
    tabs.forEach(function(tab) {
        tab.addEventListener('click', function(e) {
            e.preventDefault();
            var id = this.getAttribute('id').split("-")[1]; // e.g. "tab-trivia" -> "trivia"
            if (!id) return;
            // Deactivate all tabs
            tabs.forEach(function(t) { t.setAttribute("aria-selected", "false"); });
            // Hide all content
            document.querySelectorAll('.cast-crew-details-tabs > [role="tabpanel"]').forEach(function(block) {
                block.setAttribute("hidden", "until-found");
            });
            // Activate clicked tab and show content
            this.setAttribute("aria-selected", "true");
            var target = document.getElementById('tab-panel-' + id);
            if (target) target.removeAttribute("hidden");

            // change url without reloading page
            var basePath = window.location.pathname.split("/").slice(0, 3).join("/") + "/";
            var newUrl = basePath + id;
            window.history.pushState({ path: newUrl }, '', newUrl);
        });
    });
})();