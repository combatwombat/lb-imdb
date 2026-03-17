(function() {
    var tabs = document.querySelectorAll('#tabbed-content header ul a');
    tabs.forEach(function(tab) {
        tab.addEventListener('click', function(e) {
            e.preventDefault();
            var id = this.getAttribute('data-id');
            if (!id) return;
            // Deactivate all tabs
            tabs.forEach(function(t) { t.parentElement.classList.remove('selected'); });
            // Hide all content
            document.querySelectorAll('#tabbed-content .tabbed-content-block').forEach(function(block) {
                block.style.display = 'none';
            });
            // Activate clicked tab and show content
            this.parentElement.classList.add('selected');
            var target = document.getElementById('tab-' + id);
            if (target) target.style.display = 'block';
        });
    });
})();