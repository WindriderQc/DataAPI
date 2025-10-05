document.addEventListener('DOMContentLoaded', () => {
    const copyButton = document.getElementById('copy-prod-to-dev');
    const progressBarContainer = document.querySelector('.progress');
    const progressBar = document.getElementById('progress-bar');

    copyButton.addEventListener('click', async () => {
        // Disable button and show progress bar
        copyButton.disabled = true;
        progressBarContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressBar.setAttribute('aria-valuenow', 0);

        // Simulate progress
        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            if (progress <= 90) { // Stop at 90% until fetch is complete
                progressBar.style.width = `${progress}%`;
                progressBar.setAttribute('aria-valuenow', progress);
            }
        }, 200);

        try {
            const response = await fetch('/api/v1/databases/copy-prod-to-dev', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            clearInterval(interval); // Stop the simulation

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const result = await response.json();

            // Complete the progress bar
            progressBar.style.width = '100%';
            progressBar.setAttribute('aria-valuenow', 100);
            progressBar.classList.remove('progress-bar-animated');
            progressBar.classList.add('bg-success');


            if (result.status === 'success') {
                // Wait a moment so the user can see the "completed" bar
                setTimeout(() => {
                    // Reload the page to show updated data
                    window.location.reload();
                }, 1000);
            } else {
                throw new Error(result.message || 'Copy operation failed.');
            }

        } catch (error) {
            clearInterval(interval);
            console.error('Error copying database:', error);
            alert('An error occurred while copying the database. Check the console for details.');
            
            // Reset UI
            copyButton.disabled = false;
            progressBarContainer.style.display = 'none';
            progressBar.style.width = '0%';
            progressBar.setAttribute('aria-valuenow', 0);
            progressBar.classList.remove('bg-success');
            progressBar.classList.add('progress-bar-animated');
        }
    });
});