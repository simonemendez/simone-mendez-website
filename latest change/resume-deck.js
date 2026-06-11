// Tracks the currently selected resume role
let currentRole = 'paralegal';

// Short PDF file paths
const resumeFiles = {
    paralegal: 'resumes/paralegal.pdf',
    engineer: 'resumes/software-engineer.pdf',
    manager: 'resumes/project-manager.pdf'
};

// Download names shown to the user
const resumeDownloadNames = {
    paralegal: 'paralegal-resume.pdf',
    engineer: 'software-engineer-resume.pdf',
    manager: 'project-manager-resume.pdf'
};

function switchRole(role, clickedButton) {
    currentRole = role;

    // Hide all resume sections
    document.querySelectorAll('.role-content').forEach(section => {
        section.classList.remove('active');
    });

    // Show selected resume section
    const selectedSection = document.getElementById(role);
    if (selectedSection) {
        selectedSection.classList.add('active');
    }

    // Update active button state
    document.querySelectorAll('.role-btn').forEach(button => {
        button.classList.remove('active');
    });

    if (clickedButton) {
        clickedButton.classList.add('active');
    }

    // Scroll to top of resume area
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

function downloadResume() {
    const filePath = resumeFiles[currentRole];
    const downloadName = resumeDownloadNames[currentRole];

    if (!filePath) {
        alert('No resume file is connected for this role yet.');
        return;
    }

    const link = document.createElement('a');
    link.href = filePath;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Keyboard navigation between resume roles
document.addEventListener('keydown', event => {
    const activeButton = document.querySelector('.role-btn.active');

    if (!activeButton) return;

    if (event.key === 'ArrowLeft') {
        const previousButton = activeButton.previousElementSibling;

        if (previousButton && previousButton.classList.contains('role-btn')) {
            previousButton.click();
        }
    }

    if (event.key === 'ArrowRight') {
        const nextButton = activeButton.nextElementSibling;

        if (nextButton && nextButton.classList.contains('role-btn')) {
            nextButton.click();
        }
    }
});

// Keyboard shortcut for download: Ctrl + Shift + D
document.addEventListener('keydown', event => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        downloadResume();
    }
});
