# Contributing to Factorial Clock Extension

Thank you for considering contributing to Factorial Clock Extension! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

This project follows a simple code of conduct:
- Be respectful and considerate
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Respect differing viewpoints and experiences

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include as many details as possible:

**Bug Report Template:**
```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- Browser: [e.g., Chrome 120]
- Extension Version: [e.g., 0.1.0]
- OS: [e.g., Windows 11, macOS 14]

**Additional context**
Any other context about the problem.
```

### Suggesting Enhancements

Enhancement suggestions are welcome! Please create an issue with:
- Clear and descriptive title
- Detailed description of the proposed feature
- Why this enhancement would be useful
- Examples of how it would work

### Pull Requests

We actively welcome your pull requests!

1. **Fork the repo** and create your branch from `main`
2. **Make your changes** following our coding standards
3. **Test your changes** thoroughly
4. **Update documentation** if needed
5. **Write a clear commit message** following our commit conventions
6. **Submit the pull request**

## Development Setup

### Prerequisites

- Node.js 16+ and npm
- Git
- Chrome or compatible browser for testing

### Getting Started

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/factorial-clock-extension.git
   cd factorial-clock-extension
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development mode**
   ```bash
   npm run dev
   ```

4. **Load the extension in your browser**
   - Build: `npm run build`
   - Open Chrome → `chrome://extensions/`
   - Enable Developer mode
   - Click "Load unpacked" and select the `dist/` folder

5. **Make your changes**
   - Edit files in `src/`
   - Rebuild with `npm run build`
   - Click reload icon in extensions page

## Coding Standards

### JavaScript/React

- Use **modern ES6+ syntax**
- Prefer **functional components** and hooks
- Use **meaningful variable names**
- Add **comments for complex logic**
- Keep functions **small and focused**

**Example:**
```javascript
// Good
function calculateTotalHours(schedule) {
  return schedule.reduce((total, day) => {
    const dayMinutes = calculateDayMinutes(day)
    return total + dayMinutes
  }, 0)
}

// Avoid
function calc(s) {
  let t = 0
  for (let i = 0; i < s.length; i++) {
    t += s[i].m
  }
  return t
}
```

### File Organization

- **Components** go in `src/popup/components/`
- **Pages** go in `src/popup/pages/`
- **Utilities** go in `src/lib/`
- **One component per file**
- **Name files with PascalCase** for components (e.g., `ConfigPage.jsx`)

### Styling

- Use **Tailwind CSS utility classes**
- Follow existing design patterns
- Maintain responsive design
- Use existing color scheme from `tailwind.config.js`

### Git Workflow

We use **semantic commit messages** following the Conventional Commits specification:

```
<type>(<scope>): <subject>

[optional body]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```bash
feat: add dark mode support
fix: resolve schedule generation error for special weeks
docs: update installation instructions
refactor: simplify date calculation logic
chore: update dependencies
```

**Commit Guidelines:**
- Use present tense ("add feature" not "added feature")
- Use imperative mood ("move cursor to" not "moves cursor to")
- First line should be 50 characters or less
- Reference issues when applicable (#123)
- Keep commits focused and atomic

### Testing

Before submitting a PR:

1. **Test the build**
   ```bash
   npm run build
   ```

2. **Load the extension** and test your changes manually

3. **Test different scenarios:**
   - Different week configurations
   - Edge cases (holidays, special weeks)
   - Browser compatibility (Chrome, Edge)

4. **Check for console errors**
   - Open DevTools → Console
   - Test all features
   - Ensure no errors appear

### Documentation

- Update README.md if adding user-facing features
- Update CLAUDE.md if changing architecture
- Add JSDoc comments for complex functions
- Include inline comments for tricky logic

**Example:**
```javascript
/**
 * Generate random schedule for a week
 * @param {string} weekStart - Week start date in YYYY-MM-DD format (Monday)
 * @param {object} config - Configuration object
 * @param {array} exceptions - Array of exception objects
 * @returns {array} Array of daily schedule objects
 */
export function generateWeeklySchedule(weekStart, config, exceptions = []) {
  // Implementation...
}
```

## Project Architecture

Understanding the architecture helps make better contributions:

### Component Communication

```
Popup (React UI)
    ↓ chrome.runtime.sendMessage()
Background Service Worker
    ↓ chrome.tabs.sendMessage()
Content Script (Factorial page)
    ↓ fetch()
Factorial GraphQL API
```

### Key Files

- `src/lib/scheduler.js` - Core schedule generation algorithm
- `src/background/service-worker.js` - Background tasks and API coordination
- `src/content/factorial-api.js` - Direct API communication
- `src/popup/pages/` - Main UI pages

### State Management

- Configuration stored in `chrome.storage.sync`
- No external state management library
- Each page manages its own local state with React hooks

## Areas for Contribution

Looking for ideas? Here are areas that need help:

### High Priority
- [ ] Add unit tests for scheduler logic
- [ ] Improve error handling and user feedback
- [ ] Add loading states and progress indicators
- [ ] Support for other languages (i18n)

### Medium Priority
- [ ] Dark mode support
- [ ] Export/import configuration
- [ ] Calendar view for history
- [ ] Statistics dashboard

### Low Priority
- [ ] Firefox-specific optimizations
- [ ] Advanced scheduling rules
- [ ] Integration with other time tracking tools

## Questions?

- **General questions**: Open a GitHub issue with the "question" label
- **Security concerns**: Email directly (don't create public issues)
- **Feature discussions**: Start a GitHub Discussion

## License

By contributing, you agree that your contributions will be licensed under the GNU General Public License v3.0.

---

Thank you for contributing to make Factorial Clock Extension better! 🎉
