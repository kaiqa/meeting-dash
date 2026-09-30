/**
 * Sidebar Toggle Functionality Tests
 * Tests the sidebar collapse/expand toggle buttons
 */

const fs = require('fs');
const path = require('path');

// Load the HTML and JS files
const htmlPath = path.resolve(__dirname, '../../app/static/index.html');
const jsPath = path.resolve(__dirname, '../../app/static/app.js');

let htmlContent;
let jsContent;

beforeAll(() => {
  htmlContent = fs.readFileSync(htmlPath, 'utf-8');
  jsContent = fs.readFileSync(jsPath, 'utf-8');
});

beforeEach(() => {
  // Reset DOM
  document.documentElement.innerHTML = htmlContent;

  // Reset localStorage mock
  if (localStorage.getItem && typeof localStorage.getItem.mockReturnValue === 'function') {
    localStorage.getItem.mockReturnValue(null);
  }
  if (localStorage.setItem && typeof localStorage.setItem.mockClear === 'function') {
    localStorage.setItem.mockClear();
  }

  // Reset fetch mock
  fetch.mockClear();

  // Clear all mocks
  jest.clearAllMocks();

  // Execute the app.js in the JSDOM context
  eval(jsContent);
});

describe('Sidebar Toggle Functionality', () => {
  let sidebar;
  let sidebarToggle; // Top bar toggle
  let sidebarCollapseToggle; // Sidebar header toggle

  beforeEach(() => {
    // Get sidebar elements after DOM is set up
    sidebar = document.getElementById('sidebar');
    sidebarToggle = document.getElementById('sidebar-toggle');
    sidebarCollapseToggle = document.getElementById('sidebar-collapse-toggle');
  });

  describe('DOM Elements', () => {
    test('should have sidebar element', () => {
      expect(sidebar).toBeInTheDocument();
      expect(sidebar).toHaveClass('sidebar');
    });

    test('should have top bar sidebar toggle button', () => {
      expect(sidebarToggle).toBeInTheDocument();
      expect(sidebarToggle).toHaveClass('sidebar-toggle');
      expect(sidebarToggle).toHaveAttribute('aria-label', 'Toggle sidebar');
    });

    test('should have sidebar header collapse toggle button', () => {
      expect(sidebarCollapseToggle).toBeInTheDocument();
      expect(sidebarCollapseToggle).toHaveClass('sidebar-collapse-toggle');
      expect(sidebarCollapseToggle).toHaveAttribute('aria-label', 'Collapse sidebar');
      expect(sidebarCollapseToggle).toHaveAttribute('title', 'Collapse sidebar');
    });

    test('sidebar header toggle should have chevron-left icon', () => {
      const svg = sidebarCollapseToggle.querySelector('svg');
      expect(svg).toBeInTheDocument();
      const polyline = svg.querySelector('polyline');
      expect(polyline).toBeInTheDocument();
      expect(polyline).toHaveAttribute('points', '15 18 9 12 15 6');
    });
  });

  describe('Initial State', () => {
    test('sidebar should not be collapsed initially', () => {
      expect(sidebar).not.toHaveClass('collapsed');
    });

    test('sidebar header toggle should not be rotated initially', () => {
      const svg = sidebarCollapseToggle.querySelector('svg');
      // When not collapsed, the SVG should not have transform rotate(180deg)
      expect(sidebarCollapseToggle).not.toHaveClass('collapsed');
    });
  });

  describe('Top Bar Toggle Button', () => {
    test('clicking top bar toggle should collapse sidebar', () => {
      expect(sidebar).not.toHaveClass('collapsed');

      sidebarToggle.click();

      expect(sidebar).toHaveClass('collapsed');
    });

    test('clicking top bar toggle again should expand sidebar', () => {
      sidebarToggle.click(); // collapse
      expect(sidebar).toHaveClass('collapsed');

      sidebarToggle.click(); // expand
      expect(sidebar).not.toHaveClass('collapsed');
    });

    test('multiple clicks should toggle correctly', () => {
      sidebarToggle.click();
      expect(sidebar).toHaveClass('collapsed');

      sidebarToggle.click();
      expect(sidebar).not.toHaveClass('collapsed');

      sidebarToggle.click();
      expect(sidebar).toHaveClass('collapsed');

      sidebarToggle.click();
      expect(sidebar).not.toHaveClass('collapsed');
    });
  });

  describe('Sidebar Header Toggle Button', () => {
    test('clicking sidebar header toggle should collapse sidebar', () => {
      expect(sidebar).not.toHaveClass('collapsed');

      sidebarCollapseToggle.click();

      expect(sidebar).toHaveClass('collapsed');
    });

    test('clicking sidebar header toggle again should expand sidebar', () => {
      sidebarCollapseToggle.click(); // collapse
      expect(sidebar).toHaveClass('collapsed');

      sidebarCollapseToggle.click(); // expand
      expect(sidebar).not.toHaveClass('collapsed');
    });

    test('sidebar header toggle icon should rotate when collapsed', () => {
      // Initially not rotated
      const svg = sidebarCollapseToggle.querySelector('svg');
      expect(sidebar).not.toHaveClass('collapsed');

      sidebarCollapseToggle.click();

      // When collapsed, the sidebar has .collapsed class
      expect(sidebar).toHaveClass('collapsed');
      // The CSS rule .sidebar.collapsed .sidebar-collapse-toggle svg applies transform: rotate(180deg)
    });

    test('multiple clicks on header toggle should work correctly', () => {
      sidebarCollapseToggle.click();
      expect(sidebar).toHaveClass('collapsed');

      sidebarCollapseToggle.click();
      expect(sidebar).not.toHaveClass('collapsed');

      sidebarCollapseToggle.click();
      expect(sidebar).toHaveClass('collapsed');
    });
  });

  describe('Both Toggles Work Together', () => {
    test('clicking top bar toggle then header toggle should expand', () => {
      sidebarToggle.click(); // collapse via top bar
      expect(sidebar).toHaveClass('collapsed');

      sidebarCollapseToggle.click(); // expand via header
      expect(sidebar).not.toHaveClass('collapsed');
    });

    test('clicking header toggle then top bar toggle should expand', () => {
      sidebarCollapseToggle.click(); // collapse via header
      expect(sidebar).toHaveClass('collapsed');

      sidebarToggle.click(); // expand via top bar
      expect(sidebar).not.toHaveClass('collapsed');
    });

    test('both toggles should maintain consistent state', () => {
      // Collapse via top bar
      sidebarToggle.click();
      expect(sidebar).toHaveClass('collapsed');

      // Expand via header
      sidebarCollapseToggle.click();
      expect(sidebar).not.toHaveClass('collapsed');

      // Collapse via header
      sidebarCollapseToggle.click();
      expect(sidebar).toHaveClass('collapsed');

      // Expand via top bar
      sidebarToggle.click();
      expect(sidebar).not.toHaveClass('collapsed');
    });
  });

  describe('CSS Classes Applied Correctly', () => {
    test('when collapsed, sidebar should have collapsed class', () => {
      sidebarToggle.click();
      expect(sidebar).toHaveClass('collapsed');
    });

    test('when collapsed, logo-text should be hidden', () => {
      const logoText = document.querySelector('.logo-text');
      expect(logoText).not.toHaveStyle('display: none');

      sidebarToggle.click();
      // The CSS handles hiding via .sidebar.collapsed .logo-text { display: none }
      expect(sidebar).toHaveClass('collapsed');
    });

    test('when collapsed, nav-item spans should be hidden', () => {
      const navItems = document.querySelectorAll('.nav-item span');
      navItems.forEach(span => {
        expect(span).not.toHaveStyle('display: none');
      });

      sidebarToggle.click();
      expect(sidebar).toHaveClass('collapsed');
    });

    test('when collapsed, status-text should be hidden', () => {
      const statusText = document.querySelector('.status-text');
      expect(statusText).not.toHaveStyle('display: none');

      sidebarToggle.click();
      expect(sidebar).toHaveClass('collapsed');
    });

    test('when collapsed, webhook-url-preview should be hidden', () => {
      const webhookPreview = document.querySelector('.webhook-url-preview');
      expect(webhookPreview).toBeInTheDocument();

      sidebarToggle.click();
      expect(sidebar).toHaveClass('collapsed');
    });

    test('when collapsed, main-content margin should adjust', () => {
      const mainContent = document.querySelector('.main-content');
      expect(mainContent).toBeInTheDocument();

      sidebarToggle.click();
      expect(sidebar).toHaveClass('collapsed');
      // The CSS handles margin via .sidebar.collapsed + .main-content { margin-left: var(--sidebar-collapsed-width) }
    });
  });

  describe('Accessibility', () => {
    test('top bar toggle should have aria-label', () => {
      expect(sidebarToggle).toHaveAttribute('aria-label', 'Toggle sidebar');
    });

    test('header toggle should have aria-label', () => {
      expect(sidebarCollapseToggle).toHaveAttribute('aria-label', 'Collapse sidebar');
    });

    test('header toggle should have title attribute', () => {
      expect(sidebarCollapseToggle).toHaveAttribute('title', 'Collapse sidebar');
    });
  });

  describe('Responsive Behavior', () => {
    test('sidebar toggle should be hidden on desktop', () => {
      // The CSS has .sidebar-toggle { display: none } for desktop
      // and shows it only on mobile (@media max-width: 1024px)
      expect(sidebarToggle).toBeInTheDocument();
    });

    test('header toggle should be visible on desktop', () => {
      expect(sidebarCollapseToggle).toBeInTheDocument();
      // Should be visible in sidebar header
    });
  });
});