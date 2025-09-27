
document.addEventListener('DOMContentLoaded', () => {
    const navigation = document.getElementById('navigation');
    const content = document.getElementById('content');
    const dashboard = document.getElementById('dashboard');
    const searchInput = document.getElementById('search-input');
    const themeToggle = document.getElementById('theme-toggle');
    const viewToggle = document.getElementById('view-toggle');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const mainContainer = document.querySelector('.main-container');
    const breadcrumb = document.getElementById('breadcrumb');
    const coursesGrid = document.getElementById('courses-grid');
    const converter = new showdown.Converter();

    let files = [];
    let searchIndex;
    let searchDocs = {}; // path -> { title, headings, course, semester, content }
    let searchPanel = null;
    let searchResults = [];
    let searchSelected = -1;
    let ensureIndexPromise = null;
    let currentFilePath = null;
    let currentView = 'dashboard'; // 'dashboard' or 'content'
    let courseStats = { courses: 0, notes: 0 };
    // Sidebar state persistence
    let navState = { expanded: new Set(), selected: null };
    const NAV_EXPANDED_KEY = 'nav:expanded';
    const NAV_SELECTED_KEY = 'nav:selected';

    // --- Theming ---
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            document.body.classList.remove('dark-mode');
            themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        }
    };

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
        localStorage.setItem('theme', currentTheme);
        applyTheme(currentTheme);
    });

    const savedTheme = localStorage.getItem('theme')
    savedTheme ? applyTheme(savedTheme) : applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

    if (!savedTheme) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            applyTheme(e.matches ? 'dark' : 'light');
        });
    }

    // --- View Toggle ---
    viewToggle.addEventListener('click', () => {
        if (currentView === 'dashboard') {
            viewToggle.innerHTML = '<i class="fas fa-th-large"></i>';
        } else {
            showDashboard();
            viewToggle.innerHTML = '<i class="fas fa-file-alt"></i>';
        }
    });

    // --- Sidebar Toggle ---
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle('open');
        }
        updateSidebarLayoutState();
    });

    // Detect if we're running on GitHub Pages and adjust paths accordingly
    const isGitHubPages = window.location.hostname === 'juliusbrussee.github.io';
    const basePath = isGitHubPages ? '/DSAI-2025-2026-Class-Notes/' : './';

    const encodePath = (path) => path.split('/').map(segment => encodeURIComponent(segment)).join('/');
    const hasExtension = (path) => {
        const name = path.split('/').pop() || '';
        return /\.[^./]+$/.test(name);
    };
    const headRequest = (path) => fetch(basePath + encodePath(path), { method: 'HEAD' });
    const getFileExtension = (path) => {
        const name = path.split('/').pop() || '';
        const dotIndex = name.lastIndexOf('.');
        return dotIndex >= 0 ? name.slice(dotIndex + 1).toLowerCase() : '';
    };
    const isMarkdownPath = (path) => {
        const ext = getFileExtension(path);
        return !ext || ext === 'md';
    };
    const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'heic', 'heif', 'tif', 'tiff']);
    const isImagePath = (path) => IMAGE_EXTENSIONS.has(getFileExtension(path));
    async function fetchTextWithFallback(path) {
        if (!isMarkdownPath(path)) {
            throw new Error(`Cannot fetch non-markdown content as text: ${path}`);
        }
        const attempts = hasExtension(path) ? [path] : [path, `${path}.md`];
        let lastError = null;
        for (const candidate of attempts) {
            try {
                const response = await fetch(basePath + encodePath(candidate));
                if (!response.ok) {
                    lastError = new Error(`HTTP ${response.status} ${response.statusText || ''}`.trim() + ` for ${candidate}`);
                    continue;
                }
                const text = await response.text();
                if (candidate !== path) {
                    console.info(`Loaded fallback path ${candidate} for ${path}`);
                }
                return { text, candidate };
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError || new Error(`Failed to fetch ${path}`);
    }
    
    // --- File Loading & Navigation ---
    // Embedded file list for CORS-free operation (using relative paths)
    const embeddedFiles = [
        "README.md",
        "Year1/Semester1/Calculus 1/ExamPrep.md",
        "Year1/Semester1/Calculus 1/Lectures/Lecture_1&2_Calculus",
        "Year1/Semester1/Foundations of Computer Science/ExamPrep.md",
        "Year1/Semester1/Introduction to Digital Skills and Programming/ExamPrep.md",
        "Year1/Semester1/Introduction to Digital Skills and Programming/Lectures/Lecture_1_DSIP",
        "Year1/Semester1/Introduction to Digital Skills and Programming/Lectures/Lecture_2_DSIP",
        "Year1/Semester1/Introduction to Digital Skills and Programming/Lectures/Lecture_3_DSIP",
        "Year1/Semester1/Introduction to Digital Skills and Programming/Lectures/Lecture_4_DSIP",
        "Year1/Semester1/Introduction to Digital Skills and Programming/Lectures/Lecture_5_DSIP",
        "Year1/Semester1/Introduction to Digital Skills and Programming/Lectures/Lecture_6_DSIP",
        "Year1/Semester1/Introduction to Digital Skills and Programming/Lectures/Lecture_7_DSIP",
        "Year1/Semester1/Orientation AI/ExamPrep.md",
        "Year1/Semester1/Orientation AI/Lectures/Lecture_1_OAI",
        "Year1/Semester1/Orientation AI/Lectures/Lecture_1_READING_OAI",
        "Year1/Semester1/Orientation AI/Lectures/Lecture_2_READING_OAI",
        "Year1/Semester1/Studying and Presenting/Notes.md",
        "Year1/Semester1/Studying and Presenting/Lectures/Lecture_1_Studying_and_Presenting.md",
        "Year1/Semester1/Studying and Presenting/Lectures/Lecture_2_Studying_and_Presenting",
        "improvements-plan.md"
    ];

    // Try to load from file-list.json first, fallback to embedded list
    fetch(basePath + 'file-list.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('file-list.json not found');
            }
            return response.json();
        })
        .then(filePaths => {
            files = filePaths;
            console.log('Loaded files from JSON:', files);
            initializeApp();
        })
        .catch(error => {
            // Fallback: use embedded file list
            console.log('Using embedded file list due to:', error.message);
            files = embeddedFiles;
            initializeApp();
        });

    function initializeApp() {
        buildNavigation(files);
        buildDashboard(files);
        buildSearchIndex(files);
        updateStats(files);
    }

    async function discoverAdditionalFiles() {
        const additionalFiles = await findMarkdownFiles();
        // Merge with existing files, avoiding duplicates
        const allFiles = [...new Set([...files, ...additionalFiles])];
        files = allFiles.sort();
        return files;
    }

    async function findMarkdownFiles() {
        const foundFiles = [];
        const basePath = '/Users/julb/Desktop/GitHub/DSAI-2025-2026-Class-Notes/';
        
        // Define the directory structure to search
        const searchPaths = [
            'Year1/Semester1/Calculus 1/Lectures/',
            'Year1/Semester1/Foundations of Computer Science/Lectures/',
            'Year1/Semester1/Introduction to Digital Skills and Programming/Lectures/',
            'Year1/Semester1/Orientation AI/Lectures/',
            'Year1/Semester1/Studying and Presenting/Lectures/',
            'Year1/Semester2/',
            'Year2/',
            'Year3/'
        ];

        // Known lecture files that might not have .md extension
        const knownFiles = [
            'Year1/Semester1/Calculus 1/Lectures/Lecture_1&2_Calculus',
            'Year1/Semester1/Introduction to Digital Skills and Programming/Lectures/Lecture_1_DSIP',
            'Year1/Semester1/Introduction to Digital Skills and Programming/Lectures/Lecture_2_DSIP',
            'Year1/Semester1/Introduction to Digital Skills and Programming/Lectures/Lecture_3_DSIP',
            'Year1/Semester1/Studying and Presenting/Lectures/Lecture_1_Studying_and_Presenting.md',
            'Year1/Semester1/Studying and Presenting/Lectures/Lecture_2_Studying_and_Presenting',
            'Year1/Semester1/Studying and Presenting/Notes.md',
            'Year1/Semester1/Calculus 1/ExamPrep.md',
            'Year1/Semester1/Foundations of Computer Science/ExamPrep.md',
            'Year1/Semester1/Introduction to Digital Skills and Programming/ExamPrep.md',
            'Year1/Semester1/Orientation AI/ExamPrep.md',
            'README.md'
        ];

        // Test each known file
        for (const file of knownFiles) {
            const fullPath = basePath + encodePath(file);
            try {
                const response = await fetch(fullPath);
                if (response.ok) {
                    foundFiles.push(fullPath);
                }
            } catch (error) {
                // File doesn't exist, skip it
            }
        }

        return foundFiles;
    }

    function buildFileListDynamically() {
        findMarkdownFiles().then(foundFiles => {
            files = foundFiles;
            buildNavigation(files);
            buildDashboard(files);
            buildSearchIndex(files);
            updateStats(files);
        });
    }

    function buildNavigation(files) {
        const tree = {};

        files.forEach(file => {
            // Use the file path directly since it's already relative
            const parts = file.split('/');
            let currentLevel = tree;

            parts.forEach((part, index) => {
                if (index === parts.length - 1) {
                    currentLevel[part] = file;
                } else {
                    if (!currentLevel[part]) {
                        currentLevel[part] = {};
                    }
                    currentLevel = currentLevel[part];
                }
            });
        });

        const navUl = document.createElement('ul');
        buildNavMenu(tree, navUl, '');
        navigation.innerHTML = '';
        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.gap = '0.5rem';
        controls.style.margin = '0 0 0.5rem 0';
        const btnExpand = document.createElement('button');
        btnExpand.className = 'btn';
        btnExpand.textContent = 'Expand all';
        btnExpand.addEventListener('click', expandAllFolders);
        const btnCollapse = document.createElement('button');
        btnCollapse.className = 'btn';
        btnCollapse.textContent = 'Collapse all';
        btnCollapse.addEventListener('click', collapseAllFolders);
        controls.appendChild(btnExpand);
        controls.appendChild(btnCollapse);
        navigation.appendChild(controls);
        navigation.appendChild(navUl);
        applyNavState();
    }

    function buildNavMenu(tree, parentElement, currentPath) {
        for (const key in tree) {
            const value = tree[key];
            const li = document.createElement('li');

            if (typeof value === 'string') {
                const a = document.createElement('a');
                a.href = '#';
                // Handle both .md files and files without extensions
                let displayName = key;
                if (key.endsWith('.md')) {
                    displayName = key.replace('.md', '');
                }
                // Format display name for better readability
                displayName = displayName.replace(/_/g, ' ');
                a.textContent = displayName;
                a.dataset.path = value;
                li.appendChild(a);
            } else {
                const div = document.createElement('div');
                div.className = 'folder-header';
                div.innerHTML = `
                    <i class="fas fa-chevron-right folder-toggle"></i>
                    <i class="fas fa-folder"></i> 
                    ${key}
                `;
                const folderPath = currentPath ? `${currentPath}/${key}` : key;
                div.dataset.folderPath = folderPath;
                div.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleFolder(div, li);
                });
                li.appendChild(div);
                
                const ul = document.createElement('ul');
                ul.className = 'folder-content collapsed';
                ul.dataset.folderPath = folderPath;
                buildNavMenu(value, ul, folderPath);
                li.appendChild(ul);
            }
            parentElement.appendChild(li);
        }
    }

    function expandAllFolders() {
        navigation.querySelectorAll('.folder-content').forEach(ul => {
            ul.classList.remove('collapsed');
            ul.classList.add('expanded');
            const header = ul.previousElementSibling;
            if (header) {
                const toggleIcon = header.querySelector('.folder-toggle');
                if (toggleIcon) {
                    toggleIcon.classList.remove('fa-chevron-right');
                    toggleIcon.classList.add('fa-chevron-down');
                }
                if (header.dataset.folderPath) navState.expanded.add(header.dataset.folderPath);
            }
        });
        saveNavState();
    }

    function collapseAllFolders() {
        navigation.querySelectorAll('.folder-content').forEach(ul => {
            ul.classList.add('collapsed');
            ul.classList.remove('expanded');
            const header = ul.previousElementSibling;
            if (header) {
                const toggleIcon = header.querySelector('.folder-toggle');
                if (toggleIcon) {
                    toggleIcon.classList.add('fa-chevron-right');
                    toggleIcon.classList.remove('fa-chevron-down');
                }
            }
        });
        navState.expanded.clear();
        saveNavState();
    }

    function toggleFolder(folderHeader, folderLi) {
        const folderContent = folderLi.querySelector('.folder-content');
        const toggleIcon = folderHeader.querySelector('.folder-toggle');
        
        if (folderContent.classList.contains('collapsed')) {
            folderContent.classList.remove('collapsed');
            folderContent.classList.add('expanded');
            toggleIcon.classList.remove('fa-chevron-right');
            toggleIcon.classList.add('fa-chevron-down');
            if (folderHeader.dataset.folderPath) {
                navState.expanded.add(folderHeader.dataset.folderPath);
                saveNavState();
            }
        } else {
            folderContent.classList.add('collapsed');
            folderContent.classList.remove('expanded');
            toggleIcon.classList.remove('fa-chevron-down');
            toggleIcon.classList.add('fa-chevron-right');
            if (folderHeader.dataset.folderPath) {
                navState.expanded.delete(folderHeader.dataset.folderPath);
                saveNavState();
            }
        }
    }

    function loadNavState() {
        try {
            const arr = JSON.parse(localStorage.getItem(NAV_EXPANDED_KEY) || '[]');
            navState.expanded = new Set(Array.isArray(arr) ? arr : []);
            navState.selected = localStorage.getItem(NAV_SELECTED_KEY);
        } catch {}
    }

    function saveNavState() {
        try {
            localStorage.setItem(NAV_EXPANDED_KEY, JSON.stringify(Array.from(navState.expanded)));
            if (navState.selected) localStorage.setItem(NAV_SELECTED_KEY, navState.selected);
        } catch {}
    }

    function applyNavState() {
        navState.expanded.forEach(path => {
            const ul = navigation.querySelector(`.folder-content[data-folder-path="${CSS.escape(path)}"]`);
            if (ul) {
                ul.classList.remove('collapsed');
                ul.classList.add('expanded');
                const header = ul.previousElementSibling;
                if (header) {
                    const toggleIcon = header.querySelector('.folder-toggle');
                    if (toggleIcon) {
                        toggleIcon.classList.remove('fa-chevron-right');
                        toggleIcon.classList.add('fa-chevron-down');
                    }
                }
            }
        });
        if (navState.selected) {
            expandSidebarToPath(navState.selected);
        }
    }

    function buildDashboard(files) {
        const courses = extractCourses(files);
        courseStats.courses = courses.length;
        courseStats.notes = files.length;

        coursesGrid.innerHTML = '';
        courses.forEach(course => {
            const courseCard = createCourseCard(course);
            coursesGrid.appendChild(courseCard);
        });
    }

    function extractCourses(files) {
        const courses = new Set();
        
        files.forEach(file => {
            // File is already relative path
            const parts = file.split('/');
            if (parts.length >= 3 && parts[0].startsWith('Year')) {
                const courseName = parts[2];
                if (courseName && !courseName.endsWith('.md')) {
                    courses.add(courseName);
                }
            }
        });

        return Array.from(courses).map(courseName => {
            const courseFiles = files.filter(file => file.includes(courseName));
            return {
                name: courseName,
                files: courseFiles,
                progress: Math.min(courseFiles.length * 10, 100)
            };
        });
    }

    function createCourseCard(course) {
        const card = document.createElement('div');
        card.className = 'course-card';
        card.innerHTML = `
            <div class="course-header">
                <h3 class="course-title">${course.name}</h3>
                <i class="fas fa-book course-icon"></i>
            </div>
            <div class="course-meta">
                <span><i class="fas fa-file-alt"></i> ${course.files.length} files</span>
                <span><i class="fas fa-clock"></i> Updated recently</span>
            </div>
            <div class="course-progress">
                <div class="course-progress-bar" style="width: ${course.progress}%"></div>
            </div>
        `;

        card.addEventListener('click', () => {
            showCourseFiles(course);
        });

        return card;
    }

    function showCourseFiles(course) {
        // Keep full sidebar; only update breadcrumb and content
        updateBreadcrumb([
            { name: 'Home', action: showDashboard },
            { name: course.name, action: null }
        ]);

        // Switch to content view but keep dashboard visible initially
        currentView = 'content';
        viewToggle.innerHTML = '<i class="fas fa-th-large"></i>';

        // Also render course detail screen in content area
        showCourseScreen(course);
    }

    function expandSidebarToPath(path) {
        // Expand sidebar tree and highlight the link for a path
        const links = navigation.querySelectorAll('a');
        let target = null;
        links.forEach(a => {
            if (a.dataset.path === path) target = a;
            a.classList.remove('active');
        });
        if (!target) return;
        target.classList.add('active');
        // Expand ancestors
        let node = target.parentElement; // li
        while (node && node !== navigation) {
            if (node.classList && node.classList.contains('folder-content')) {
                node.classList.remove('collapsed');
                node.classList.add('expanded');
                // Update toggle icon on header sibling
                const header = node.previousElementSibling;
                if (header && header.querySelector) {
                    const toggleIcon = header.querySelector('.folder-toggle');
                    if (toggleIcon) {
                        toggleIcon.classList.remove('fa-chevron-right');
                        toggleIcon.classList.add('fa-chevron-down');
                    }
                }
            }
            node = node.parentElement;
        }
        // Ensure sidebar is open on mobile
        if (window.innerWidth <= 768) {
            sidebar.classList.add('open');
        }
    }

    function showCourseScreen(course) {
        dashboard.style.display = 'none';
        content.classList.add('active');

        const wrapper = document.createElement('div');
        wrapper.className = 'course-screen';

        // Header
        const header = document.createElement('div');
        header.className = 'course-view-header';
        header.innerHTML = `
            <div class="course-view-title"><i class="fas fa-book"></i> ${course.name}</div>
            <div style="display:flex; gap:.5rem; align-items:center;">
                <div class="course-meta"><span>${course.files.length} files</span></div>
                <button class="btn" id="back-to-courses"><i class="fas fa-arrow-left"></i> Back</button>
            </div>
        `;
        wrapper.appendChild(header);
        header.querySelector('#back-to-courses').addEventListener('click', showDashboard);

        // Grid
        const grid = document.createElement('div');
        grid.className = 'file-grid';

        if (!course.files.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.innerHTML = '<i class="fas fa-inbox"></i> <div>No content yet for this course.</div>';
            wrapper.appendChild(empty);
        } else {
            course.files.forEach(path => {
                const titleRaw = path.split('/').pop();
                const title = (titleRaw.endsWith('.md') ? titleRaw.replace('.md','') : titleRaw).replace(/_/g, ' ');
                const card = document.createElement('div');
                card.className = 'file-card';
                const icon = isImagePath(path) ? 'fa-image' : (titleRaw.endsWith('.md') || titleRaw.includes('Lecture_') ? 'fa-file-alt' : 'fa-file');
                card.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;">
                    <div><i class="fas ${icon}"></i> ${title}</div>
                    <span class="badge" data-badge>…</span>
                </div>
                <div class="meta">${path}</div>`;
                card.addEventListener('click', () => loadFileContent(path));
                grid.appendChild(card);
                const badge = card.querySelector('[data-badge]');
                if (isMarkdownPath(path)) {
                    const quizPath = guessQuizPathForLecture(path);
                    headRequest(quizPath)
                        .then(res => {
                            if (!badge) return;
                            if (res.ok) { badge.textContent = 'Quiz'; badge.style.color = 'var(--primary)'; }
                            else { badge.textContent = 'No quiz'; badge.style.color = 'var(--muted-foreground)'; }
                        })
                        .catch(() => { if (badge) badge.textContent = ''; });
                } else if (isImagePath(path)) {
                    if (badge) { badge.textContent = 'Image'; badge.style.color = 'var(--primary)'; }
                } else if (badge) {
                    badge.textContent = '';
                }
            });
            wrapper.appendChild(grid);
            // Prefetch first two files and their quiz headers
            course.files.slice(0,2).forEach(p => {
                if (isMarkdownPath(p)) {
                    const key = `md:${p}`;
                    if (!sessionStorage.getItem(key)) {
                        fetchTextWithFallback(p).then(({ text }) => sessionStorage.setItem(key, text)).catch(()=>{});
                    }
                    const q = guessQuizPathForLecture(p);
                    headRequest(q).catch(()=>{});
                }
            });
        }

        content.innerHTML = '';
        content.appendChild(wrapper);
    }

    function updateSidebarLayoutState() {
        // On desktop, center content when sidebar is collapsed
        if (window.innerWidth > 768) {
            const hidden = sidebar.classList.contains('collapsed');
            if (hidden) mainContainer.classList.add('sidebar-hidden');
            else mainContainer.classList.remove('sidebar-hidden');
        } else {
            mainContainer.classList.remove('sidebar-hidden');
        }
    }

    function updateBreadcrumb(items) {
        const breadcrumbContent = breadcrumb.querySelector('.breadcrumb-content');
        breadcrumbContent.innerHTML = '';

        items.forEach((item, index) => {
            if (index > 0) {
                const separator = document.createElement('span');
                separator.innerHTML = ' / ';
                separator.style.color = 'var(--muted-foreground)';
                breadcrumbContent.appendChild(separator);
            }

            const element = document.createElement(item.action ? 'button' : 'span');
            if (item.action) {
                element.style.background = 'none';
                element.style.border = 'none';
                element.style.color = 'var(--primary)';
                element.style.cursor = 'pointer';
                element.style.textDecoration = 'underline';
                element.addEventListener('click', item.action);
            }
            element.textContent = item.name;
            breadcrumbContent.appendChild(element);
        });
    }

    function showDashboard() {
        dashboard.style.display = 'block';
        content.classList.remove('active');
        currentView = 'dashboard';
        viewToggle.innerHTML = '<i class="fas fa-file-alt"></i>';
        
        // Reset navigation
        navigation.innerHTML = '';
        buildNavigation(files);
        
        // Reset breadcrumb
        updateBreadcrumb([{ name: 'Home', action: null }]);
    }

    // Make showDashboard globally accessible
    window.showDashboard = showDashboard;

    function updateStats(files) {
        const totalCoursesEl = document.getElementById('total-courses');
        const totalNotesEl = document.getElementById('total-notes');
        if (totalCoursesEl) totalCoursesEl.textContent = courseStats.courses;
        if (totalNotesEl) totalNotesEl.textContent = courseStats.notes;
    }

    function buildDefaultStructure() {
        // Fallback structure using relative paths
        const defaultFiles = [
            'README.md',
            'Year1/Semester1/Calculus 1/ExamPrep.md',
            'Year1/Semester1/Calculus 1/Lectures/Lecture_1&2_Calculus',
            'Year1/Semester1/Foundations of Computer Science/ExamPrep.md',
            'Year1/Semester1/Introduction to Digital Skills and Programming/ExamPrep.md',
            'Year1/Semester1/Introduction to Digital Skills and Programming/Lectures/Lecture_1_DSIP',
            'Year1/Semester1/Introduction to Digital Skills and Programming/Lectures/Lecture_2_DSIP',
            'Year1/Semester1/Introduction to Digital Skills and Programming/Lectures/Lecture_3_DSIP',
            'Year1/Semester1/Introduction to Digital Skills and Programming/Lectures/Lecture_4_DSIP',
            'Year1/Semester1/Introduction to Digital Skills and Programming/Lectures/Lecture_5_DSIP',
            'Year1/Semester1/Introduction to Digital Skills and Programming/Lectures/Lecture_6_DSIP',
            'Year1/Semester1/Introduction to Digital Skills and Programming/Lectures/Lecture_7_DSIP',
            'Year1/Semester1/Orientation AI/ExamPrep.md',
            'Year1/Semester1/Orientation AI/Lectures/Lecture_1_OAI',
            'Year1/Semester1/Orientation AI/Lectures/Lecture_1_READING_OAI',
            'Year1/Semester1/Orientation AI/Lectures/Lecture_2_READING_OAI',
            'Year1/Semester1/Studying and Presenting/Notes.md',
            'Year1/Semester1/Studying and Presenting/Lectures/Lecture_1_Studying_and_Presenting.md',
            'Year1/Semester1/Studying and Presenting/Lectures/Lecture_2_Studying_and_Presenting',
            'improvements-plan.md'
        ];
        
        files = defaultFiles;
        buildNavigation(files);
        buildDashboard(files);
        updateStats(files);
    }

    navigation.addEventListener('click', (event) => {
        if (event.target.tagName === 'A') {
            event.preventDefault();
            const path = event.target.dataset.path;
            navState.selected = path; saveNavState();
            loadFileContent(path);
            expandSidebarToPath(path);
        }
    });

    function loadFileContent(path) {
        updateHashForFile(path);

        if (isImagePath(path)) {
            renderImageContent(path);
            return;
        }

        if (!isMarkdownPath(path)) {
            renderUnsupportedFile(path);
            return;
        }

        const cacheKey = `md:${path}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            renderMarkdownContent(path, cached);
            fetchTextWithFallback(path)
                .then(({ text }) => sessionStorage.setItem(cacheKey, text))
                .catch(() => {});
            return;
        }

        fetchTextWithFallback(path)
            .then(({ text }) => {
                sessionStorage.setItem(cacheKey, text);
                renderMarkdownContent(path, text);
            })
            .catch(error => {
                console.error('Error loading file:', error);
                content.innerHTML = `
                    <div style="text-align: center; padding: 2rem;">
                        <h1><i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i> File Loading Error</h1>
                        <p>Sorry, the file could not be loaded.</p>
                        <p><strong>File:</strong> ${path.split('/').pop()}</p>
                        <p><strong>Issue:</strong> ${error.message}</p>
                        <div style="background: var(--muted); padding: 1rem; border-radius: 0.5rem; margin: 1rem 0;">
                            <p><strong>Tip:</strong> If you're seeing CORS errors, make sure to run the website through a local server:</p>
                            <code style="background: var(--card); padding: 0.5rem; border-radius: 0.25rem; display: block; margin: 0.5rem 0;">
                                python3 -m http.server 8000
                            </code>
                            <p>Then open: <a href="http://localhost:8000" target="_blank">http://localhost:8000</a></p>
                        </div>
                        <button onclick="showDashboard()" style="background: var(--primary); color: var(--primary-foreground); border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">
                            <i class="fas fa-home"></i> Back to Dashboard
                        </button>
                    </div>
                `;
                dashboard.style.display = 'none';
                content.classList.add('active');
            });
    }

    function createContentToolbar(path) {
        const toolbar = document.createElement('div');
        toolbar.className = 'content-toolbar';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn';
        copyBtn.innerHTML = '<i class="fas fa-link"></i> Copy link';
        copyBtn.addEventListener('click', () => {
            const url = `${location.origin}${location.pathname}#file=${encodeURIComponent(path)}`;
            navigator.clipboard.writeText(url).then(() => {
                copyBtn.textContent = 'Copied!';
                setTimeout(() => copyBtn.innerHTML = '<i class=\"fas fa-link\"></i> Copy link', 1200);
            }).catch(() => {});
        });
        toolbar.appendChild(copyBtn);

        const viewBtn = document.createElement('a');
        viewBtn.className = 'btn';
        viewBtn.href = basePath + encodePath(path);
        viewBtn.target = '_blank';
        viewBtn.rel = 'noopener';
        viewBtn.innerHTML = '<i class="fas fa-external-link-alt"></i> Open source';
        toolbar.appendChild(viewBtn);

        return toolbar;
    }

    function finalizeContentRender(path, { enableMathJax = false } = {}) {
        if (enableMathJax && window.MathJax) {
            MathJax.typesetPromise([content]).catch((err) => console.log(err.message));
        }

        dashboard.style.display = 'none';
        content.classList.add('active');
        currentView = 'content';
        viewToggle.innerHTML = '<i class="fas fa-th-large"></i>';

        currentFilePath = path;
        window.__CURRENT_FILE__ = path;

        let fileName = path.split('/').pop() || path;
        if (fileName.endsWith('.md')) { fileName = fileName.slice(0, -3); }
        fileName = fileName.replace(/_/g, ' ');
        updateBreadcrumb([
            { name: 'Home', action: showDashboard },
            { name: fileName, action: null }
        ]);

        if (isMarkdownPath(path)) {
            maybeInjectQuizCTA(path);
        }
        expandSidebarToPath(path);
    }

    function renderMarkdownContent(path, text) {
        const toolbar = createContentToolbar(path);
        const html = converter.makeHtml(text);
        content.innerHTML = '';
        content.appendChild(toolbar);
        const article = document.createElement('div');
        article.innerHTML = html;
        content.appendChild(article);

        finalizeContentRender(path, { enableMathJax: true });
    }

    function renderImageContent(path) {
        const toolbar = createContentToolbar(path);
        const figure = document.createElement('figure');
        figure.className = 'image-note';
        const fileLabel = (path.split('/').pop() || 'Notebook scan').replace(/_/g, ' ');
        const img = document.createElement('img');
        img.src = basePath + encodePath(path);
        img.alt = fileLabel;
        img.loading = 'lazy';
        figure.appendChild(img);

        const caption = document.createElement('figcaption');
        caption.textContent = fileLabel;
        figure.appendChild(caption);

        content.innerHTML = '';
        content.appendChild(toolbar);
        content.appendChild(figure);

        finalizeContentRender(path);
    }

    function renderUnsupportedFile(path) {
        const toolbar = createContentToolbar(path);
        const wrapper = document.createElement('div');
        wrapper.className = 'unsupported-note';
        wrapper.innerHTML = `
            <i class="fas fa-file-times"></i>
            <h2>Unsupported File</h2>
            <p>The file type for <strong>${path.split('/').pop()}</strong> isn't supported yet.</p>
            <button class="btn" type="button" onclick="showDashboard()">
                <i class="fas fa-home"></i> Back to Dashboard
            </button>
        `;

        content.innerHTML = '';
        content.appendChild(toolbar);
        content.appendChild(wrapper);
        finalizeContentRender(path);
    }

    // --- Quiz Integration ---
    function normalizeLecturePath(path) {
        // Remove .md extension if present
        return path.endsWith('.md') ? path.slice(0, -3) : path;
    }

    function guessQuizPathForLecture(path) {
        const lecturePath = normalizeLecturePath(path);
        // Map lecture path to quizzes/<lecturePath>.json
        return `quizzes/${lecturePath}.json`;
    }

    function ensureQuizScriptLoaded() {
        return new Promise((resolve, reject) => {
            if (window.Quiz && typeof window.Quiz.open === 'function') return resolve();
            const script = document.createElement('script');
            // Expose base path for quiz assets
            window.__QUIZ_BASE_PATH__ = basePath;
            script.src = basePath + 'quiz.js';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load quiz engine'));
            document.body.appendChild(script);
        });
    }

    function preloadQuizStyles() {
        // Preload quiz stylesheet so overlay renders instantly on click
        if (document.querySelector('link[data-quiz-preload]')) return;
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'style';
        link.href = basePath + 'quiz.css';
        link.setAttribute('data-quiz-preload', '1');
        document.head.appendChild(link);
    }

    function maybeInjectQuizCTA(lecturePath) {
        if (!isMarkdownPath(lecturePath)) return;
        const quizPath = guessQuizPathForLecture(lecturePath);
        headRequest(quizPath)
            .then(res => {
                if (!res.ok) throw new Error('No quiz');
                // Create CTA UI
                // Avoid duplicate CTA for same path
                const existing = content.querySelector(`.quiz-cta[data-path="${CSS.escape(lecturePath)}"]`);
                if (existing) return;
                const cta = document.createElement('div');
                cta.className = 'quiz-cta';
                cta.setAttribute('data-path', lecturePath);
                cta.innerHTML = `
                    <div>
                        <strong>Interactive Quiz Available</strong>
                        <div>Test your understanding of this lecture.</div>
                    </div>
                    <button type="button"><i class="fas fa-play"></i> Start Quiz</button>
                `;
                const btn = cta.querySelector('button');
                btn.addEventListener('click', async () => {
                    btn.disabled = true; btn.textContent = 'Loading…';
                    try {
                        await ensureQuizScriptLoaded();
                        await window.Quiz.open(quizPath, { basePath });
                        updateHashForQuiz(quizPath);
                    } catch (e) {
                        alert('Unable to start quiz: ' + e.message);
                    } finally {
                        btn.disabled = false; btn.innerHTML = '<i class="fas fa-play"></i> Start Quiz';
                    }
                });
                // Prepend CTA to content view
                content.prepend(cta);
                // Preload quiz CSS for faster overlay styling
                preloadQuizStyles();
            })
            .catch(() => { /* no quiz; silently ignore */ });
    }

    // --- Search ---
    function ensureSearchIndex() {
        if (ensureIndexPromise) return ensureIndexPromise;
        const fetchTexts = (path) => new Promise((resolve) => {
            if (!isMarkdownPath(path)) {
                resolve('');
                return;
            }
            const key = `md:${path}`;
            const cached = sessionStorage.getItem(key);
            if (cached) {
                resolve(cached);
                fetchTextWithFallback(path)
                    .then(({ text }) => sessionStorage.setItem(key, text))
                    .catch(() => {});
            } else {
                fetchTextWithFallback(path)
                    .then(({ text }) => {
                        sessionStorage.setItem(key, text);
                        resolve(text);
                    })
                    .catch((err) => {
                        console.warn('Search index fetch failed for', path, err);
                        resolve('');
                    });
            }
        });

        ensureIndexPromise = Promise.all(files.map(p => fetchTexts(p))).then(texts => {
            // Build docs metadata
            searchDocs = {};
            files.forEach((path, i) => {
                const meta = extractMeta(path, texts[i] || '');
                searchDocs[path] = meta;
            });
            // Build lunr index with boosted fields
            searchIndex = lunr(function () {
                this.ref('path');
                this.field('title', { boost: 4 });
                this.field('headings', { boost: 3 });
                this.field('course', { boost: 2 });
                this.field('content');
                files.forEach(path => {
                    const d = searchDocs[path];
                    this.add({
                        path,
                        title: d.title,
                        headings: d.headings.join(' '),
                        course: d.course,
                        content: d.content
                    });
                });
            });
        }).catch(err => {
            console.log('Search index build failed:', err);
        });
        return ensureIndexPromise;
    }

    function extractMeta(path, md) {
        const parts = path.split('/');
        const course = parts[2] || '';
        const semester = parts[1] || '';
        let title = '';
        const headings = [];
        const lines = md.split(/\r?\n/);
        for (const line of lines) {
            if (!title) {
                const m = line.match(/^#\s+(.+)/);
                if (m) title = m[1].trim();
            }
            const h2 = line.match(/^##\s+(.+)/);
            if (h2) headings.push(h2[1].trim());
            const h3 = line.match(/^###\s+(.+)/);
            if (h3) headings.push(h3[1].trim());
        }
        if (!title) {
            let fname = path.split('/').pop() || '';
            if (fname.endsWith('.md')) fname = fname.slice(0, -3);
            title = fname.replace(/_/g, ' ');
        }
        const content = md.replace(/```[\s\S]*?```/g, ' ') // strip code blocks
                         .replace(/[#>*_`~\[\]!()-]/g, ' ') // strip markdown punctuation
                         .replace(/\s+/g, ' ') // collapse
                         .trim();
        return { path, title, headings, course, semester, content, raw: md };
    }

    function buildSearchString(query) {
        // Parse fielded tokens: field:term or quoted phrases; default search across boosted fields
        const tokens = [];
        const re = /([\w]+:\"[^\"]+\"|[\w]+:[^\s]+|\"[^\"]+\"|\S+)/g;
        let m; while ((m = re.exec(query)) !== null) tokens.push(m[0]);
        const parts = [];
        tokens.forEach(tok => {
            if (/^[\w]+:/.test(tok)) {
                // fielded stays as-is, with optional boost left to user
                parts.push(tok);
            } else {
                // phase or term; add to multiple fields with boosts
                const term = tok;
                parts.push(`title:${term}^4`);
                parts.push(`headings:${term}^3`);
                parts.push(`course:${term}^2`);
                parts.push(`content:${term}`);
            }
        });
        return parts.join(' ');
    }

    function showSearchPanel(results, query) {
        if (!searchPanel) {
            searchPanel = document.createElement('div');
            searchPanel.className = 'search-panel';
            searchPanel.innerHTML = `<div class="search-header">
                <div><i class="fas fa-search"></i> Results for “${escapeHtml(query)}”</div>
                <button class="btn" id="close-search">Esc</button>
            </div>
            <div class="search-list"></div>`;
            document.body.appendChild(searchPanel);
            searchPanel.querySelector('#close-search').addEventListener('click', hideSearchPanel);
        } else {
            searchPanel.querySelector('.search-header div').innerHTML = `<i class=\"fas fa-search\"></i> Results for “${escapeHtml(query)}”`;
        }
        const list = searchPanel.querySelector('.search-list');
        list.innerHTML = '';
        results.forEach((r, idx) => {
            const doc = searchDocs[r.ref];
            const item = document.createElement('div');
            item.className = 'search-item';
            item.dataset.path = r.ref;
            item.innerHTML = `
                <div class="search-item-title">${escapeHtml(doc.title)} <span class="search-item-meta">${escapeHtml(doc.semester)} / ${escapeHtml(doc.course)}</span></div>
                <div class="search-snippet">${makeSnippet(doc.raw, query)}</div>
            `;
            item.addEventListener('click', () => {
                hideSearchPanel();
                loadFileContent(r.ref);
            });
            list.appendChild(item);
        });
        searchResults = results;
        searchSelected = results.length ? 0 : -1;
        updateSearchActiveItem();
    }

    function hideSearchPanel() {
        if (searchPanel) { searchPanel.remove(); searchPanel = null; }
        searchResults = [];
        searchSelected = -1;
    }

    function updateSearchActiveItem() {
        if (!searchPanel) return;
        const items = searchPanel.querySelectorAll('.search-item');
        items.forEach((el, i) => el.classList.toggle('active', i === searchSelected));
    }

    function escapeHtml(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function makeSnippet(md, query) {
        const text = md.replace(/\s+/g, ' ').trim();
        const terms = (query || '').replace(/\"/g,'').split(/\s+/).filter(Boolean);
        let pos = -1;
        for (const t of terms) {
            const p = text.toLowerCase().indexOf(t.toLowerCase());
            if (p !== -1) { pos = p; break; }
        }
        const start = Math.max(0, (pos === -1 ? 0 : pos - 60));
        const end = Math.min(text.length, start + 200);
        let snippet = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
        // highlight
        terms.forEach(t => {
            if (!t) return;
            const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            snippet = snippet.replace(re, m => `<mark>${escapeHtml(m)}</mark>`);
        });
        return snippet;
    }

    const debounce = (fn, ms=200) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; };
    const runSearch = debounce((q) => {
        if (!q) { hideSearchPanel(); updateHashForQuery(''); return; }
        updateHashForQuery(q);
        ensureSearchIndex().then(() => {
            const searchStr = buildSearchString(q);
            let results = [];
            try { results = searchIndex.search(searchStr); } catch { results = []; }
            showSearchPanel(results.slice(0, 30), q);
        });
    }, 220);

    searchInput.addEventListener('input', (event) => {
        const q = event.target.value.trim();
        runSearch(q);
    });

    // Keyboard navigation for results
    searchInput.addEventListener('keydown', (e) => {
        if (!searchPanel) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); searchSelected = Math.min(searchSelected + 1, searchResults.length - 1); updateSearchActiveItem(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); searchSelected = Math.max(searchSelected - 1, 0); updateSearchActiveItem(); }
        else if (e.key === 'Enter') { e.preventDefault(); if (searchSelected >= 0) { const path = searchResults[searchSelected].ref; hideSearchPanel(); loadFileContent(path); } }
        else if (e.key === 'Escape') { hideSearchPanel(); }
    });

    function updateHashForQuery(q) {
        const qp = new URLSearchParams(location.hash.slice(1));
        if (q) qp.set('q', q); else qp.delete('q');
        location.hash = qp.toString();
    }

    // Mobile responsiveness
    if (window.innerWidth <= 768) {
        sidebar.classList.add('collapsed');
    }

    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed', 'open');
        }
        updateSidebarLayoutState();
    });

    // Initialize layout state once
    updateSidebarLayoutState();
    loadNavState();
    handleInitialHash();
    window.addEventListener('hashchange', handleInitialHash);

    // Expose a few helpers for deep-link handler
    window.loadFileContent = loadFileContent;
    window.ensureQuizScriptLoaded = ensureQuizScriptLoaded;
});

// Deep-link helpers
function updateHashForFile(path) {
    const qp = new URLSearchParams(location.hash.slice(1));
    const prev = qp.get('file');
    if (prev === path) return; // no-op if unchanged
    qp.set('file', path);
    qp.delete('quiz');
    const next = qp.toString();
    if (('#' + next) !== location.hash) location.hash = next;
}

function updateHashForQuiz(quizPath) {
    const qp = new URLSearchParams(location.hash.slice(1));
    const prev = qp.get('quiz');
    if (prev === quizPath) return;
    qp.set('quiz', quizPath);
    const next = qp.toString();
    if (('#' + next) !== location.hash) location.hash = next;
}

function handleInitialHash() {
    const qp = new URLSearchParams(location.hash.slice(1));
    const file = qp.get('file');
    const quiz = qp.get('quiz');
    const q = qp.get('q');
    if (q && typeof document !== 'undefined') {
        const input = document.getElementById('search-input');
        if (input) { input.value = q; }
        const ev = new Event('input');
        if (input) input.dispatchEvent(ev);
    }
    if (file && file !== (window.__CURRENT_FILE__ || null)) {
        // call into the DOMContentLoaded scope function via global
        if (typeof window.loadFileContent === 'function') {
            window.loadFileContent(file);
        } else {
            // fallback: trigger click on matching nav link
            const a = document.querySelector(`.navigation a[data-path="${CSS.escape(file)}"]`);
            if (a) a.click();
        }
    }
    if (quiz) {
        // Avoid reopening if a quiz modal is already on screen
        if (document.querySelector('.quiz-backdrop')) return;
        const basePath = (window.location.hostname === 'juliusbrussee.github.io') ? '/DSAI-2025-2026-Class-Notes/' : './';
        (window.ensureQuizScriptLoaded ? window.ensureQuizScriptLoaded() : Promise.resolve()).then(() => {
            if (window.Quiz && window.Quiz.open) window.Quiz.open(quiz, { basePath });
        }).catch(()=>{});
    }
}
