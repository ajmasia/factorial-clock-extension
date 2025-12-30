# Releasing & Publishing Guide

This guide explains how to create new releases and publish the extension to the Chrome Web Store.

## Version Numbering

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR** (x.0.0): Breaking changes or major features
- **MINOR** (0.x.0): New features, backward compatible
- **PATCH** (0.0.x): Bug fixes, backward compatible

## Creating a Release

### 1. Update Version Numbers

Update the version in these files:
- `manifest.json`
- `package.json`
- `src/popup/components/Layout.jsx` (footer)
- `README.md` (badge)

```bash
# Example for version 0.2.0
# Update all files manually or with sed
VERSION="0.2.0"
sed -i "s/\"version\": \".*\"/\"version\": \"${VERSION}\"/" manifest.json
sed -i "s/\"version\": \".*\"/\"version\": \"${VERSION}\"/" package.json
# ... update other files
```

### 2. Build and Test

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Test the extension manually
# Load dist/ folder in chrome://extensions/
```

### 3. Commit and Tag

```bash
# Commit version bump
git add .
git commit -m "chore: bump version to ${VERSION}"

# Create annotated tag
git tag -a v${VERSION} -m "Release v${VERSION}"

# Push commits and tags
git push origin main
git push origin v${VERSION}
```

### 4. Automated Release

Once you push the tag, GitHub Actions will automatically:
1. Run build checks
2. Build the extension
3. Create a ZIP file (`factorial-clock-v${VERSION}.zip`)
4. Generate release notes from commits
5. Create a GitHub Release with the ZIP attached

The release will appear at: `https://github.com/ajmasia/factorial-clock-extension/releases`

## Publishing to Chrome Web Store

### Initial Setup (First Time Only)

1. **Register as a Chrome Web Store Developer**
   - Go to: https://chrome.google.com/webstore/devconsole
   - Sign in with your Google account
   - Pay the one-time $5 registration fee

2. **Create the Extension Item**
   - Click "New Item"
   - Upload the ZIP file from GitHub Releases
   - Fill in all required store listing information

### Publishing Updates

#### 1. Download Release ZIP

After the GitHub Action completes:
1. Go to: https://github.com/ajmasia/factorial-clock-extension/releases
2. Find your release (e.g., `v0.2.0`)
3. Download `factorial-clock-v0.2.0.zip`

#### 2. Upload to Chrome Web Store

1. Go to: https://chrome.google.com/webstore/devconsole
2. Click on "Factorial Clock" item
3. Click "Package" tab
4. Click "Upload new package"
5. Select the downloaded ZIP file
6. Wait for upload to complete

#### 3. Update Store Listing (if needed)

- **Store Listing** tab: Description, screenshots, promotional images
- **Privacy** tab: Data usage declarations
- **Distribution** tab: Regions, pricing

#### 4. Submit for Review

1. Click "Submit for review"
2. Wait for review (typically 1-3 days for updates, 1-2 weeks for initial submission)
3. You'll receive email notification when approved

### Store Listing Information

Keep this information updated:

**Name**: Factorial Clock

**Summary** (132 chars max):
```
Automate weekly time tracking in Factorial with intelligent schedule generation
```

**Description**:
```
[Use the content from CHROME_WEB_STORE_DESCRIPTION.md]
```

**Category**: Productivity

**Language**: English

### Required Assets

**Icon**:
- Size: 128x128 pixels
- File: `src/assets/icons/icon128.png`

**Screenshots** (at least 1 required):
- Size: 1280x800 or 640x400 pixels
- Show main features: Generate page, Config page, Exceptions page

**Promotional Tile** (optional but recommended):
- Size: 440x280 pixels

### Privacy Information

**Single Purpose**:
```
This extension automates the creation and submission of work schedule entries to Factorial HR's time tracking system. It generates weekly schedules based on user-configured preferences and applies them directly to the user's Factorial account through their official API.
```

**Permissions Justification**:
```
[Use the content from the permissions justification section]
```

**Data Usage**:
- Do NOT select any data collection categories if all data is stored locally
- If required to select something, choose "Website content" and specify it's stored locally only

**Host Permissions Justification**:
```
Required to communicate with Factorial's GraphQL API and create time tracking shifts. Extension operates exclusively on factorialhr.com domains.
```

**Remote Code**: NO
```
This extension does not use, load, or execute any remote code. All functionality is contained within the extension package.
```

### Review Process

**Initial Submission**:
- Can take 1-2 weeks due to host permissions requiring manual review
- Be prepared to answer questions about permission usage

**Updates**:
- Typically faster (1-3 days)
- May be instant if no permission changes

**Common Review Delays**:
- Missing or unclear permission justifications
- Vague single purpose description
- Incorrect data usage declarations
- Missing privacy policy (if collecting data)

### Troubleshooting

**"Your item does not comply with our policies"**:
- Review the specific policy violation mentioned
- Update code/manifest to comply
- Resubmit with explanation of changes

**"Additional review required"**:
- Normal for extensions with host permissions
- Be patient, provide clear justifications

**"Permission X is not justified"**:
- Add/update justification in store listing
- Reference specific code that uses the permission

## Release Checklist

- [ ] Update version in all files
- [ ] Test extension thoroughly
- [ ] Commit changes
- [ ] Create and push git tag
- [ ] Wait for GitHub Action to complete
- [ ] Download ZIP from GitHub Release
- [ ] Upload to Chrome Web Store
- [ ] Submit for review
- [ ] Monitor review status
- [ ] Announce release (if approved)

## Rollback Process

If a release has critical bugs:

1. **Quick Fix**:
   ```bash
   # Fix the bug
   # Bump to patch version (e.g., 0.2.0 -> 0.2.1)
   # Follow normal release process
   ```

2. **Revert to Previous Version**:
   ```bash
   # Find the last working tag
   git tag -l

   # Create a new release from that commit
   git checkout v0.1.3
   # Bump to new version
   # Create new tag
   ```

3. **Chrome Web Store**:
   - Upload the fixed/previous version
   - Submit for review (can be expedited for critical fixes)

## Version History

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

## Support

- **Issues**: https://github.com/ajmasia/factorial-clock-extension/issues
- **Developer Console**: https://chrome.google.com/webstore/devconsole
