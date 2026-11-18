
// Select all navigation buttons
const navigationButtons = document.querySelectorAll('.nav-btn');

// Select all dashboard module buttons
const openButtons = document.querySelectorAll('.open-btn');

// Select all application pages
const pages = document.querySelectorAll('.page');

// Dashboard title
const pageTitle = document.getElementById('page-title');

// Function to navigate between modules
function navigateToPage(pageName) {

    // Hide all pages
    pages.forEach(page => {
        page.classList.remove('active');
    });

    // Remove active status from all sidebar buttons
    navigationButtons.forEach(button => {
        button.classList.remove('active');
    });

    // Display the selected page
    const selectedPage = document.getElementById(pageName);

    if (!selectedPage) {
        return;
    }

    selectedPage.classList.add('active');

    // Update the page heading
    const activeButton = document.querySelector(
        `.nav-btn[data-page="${pageName}"]`
    );

    if (activeButton) {
        activeButton.classList.add('active');
        pageTitle.textContent = activeButton.textContent.trim();
    } else {
        pageTitle.textContent = 'Dashboard';
    }
}

// Sidebar navigation events
navigationButtons.forEach(button => {

    button.addEventListener('click', () => {

        const pageName = button.dataset.page;

        navigateToPage(pageName);

    });

});

// Dashboard module navigation events
openButtons.forEach(button => {

    button.addEventListener('click', () => {

        const pageName = button.dataset.page;

        navigateToPage(pageName);

    });

});

// Load Electron application information
async function loadAppInfo() {

    const appInfo = document.getElementById('app-info');

    if (!window.systemAPI?.getAppInfo) {
        appInfo.textContent =
            `Application: System Programming Management System | Version: 1.0.0 | Platform: ${navigator.platform || 'Web browser'}`;
        return;
    }

    try {

        const info = await window.systemAPI.getAppInfo();

        appInfo.textContent =
            `Application: ${info.name} | Version: ${info.version} | Platform: ${info.platform}`;

    } catch (error) {

        appInfo.textContent =
            'Unable to retrieve application information.';

        console.error(error);

    }

}

loadAppInfo();
