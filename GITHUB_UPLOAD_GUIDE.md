# 📤 Upload to GitHub - Step by Step Guide

## Prerequisites
- GitHub account (create one at https://github.com if you don't have one)
- Git installed on your system (download from https://git-scm.com/)

## Steps to Upload Your Project

### Step 1: Create a New Repository on GitHub
1. Go to https://github.com/new
2. Enter repository name: `global-chat-app` (or any name you prefer)
3. Add description: "Real-time chat website with AI-powered message translation using Groq API"
4. Choose visibility: **Public** (if you want others to see it) or **Private**
5. DO NOT initialize with README (we already have one)
6. Click "Create repository"

### Step 2: Get Your Repository URL
After creating the repository, you'll see a page with commands.
- Copy the repository URL (looks like: `https://github.com/YOUR-USERNAME/global-chat-app.git`)

### Step 3: Add Remote and Push to GitHub

Run these commands in PowerShell in the project folder:

```powershell
cd "c:\programing\chat website"

# Add the remote repository
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git

# Rename branch to main (GitHub default)
git branch -M main

# Push your code to GitHub
git push -u origin main
```

**Replace:**
- `YOUR-USERNAME` with your GitHub username
- `YOUR-REPO-NAME` with your repository name

### Step 4: Enter Your GitHub Credentials
When prompted:
- Username: Your GitHub username
- Password: Your personal access token (see next section)

### Getting a Personal Access Token

If you have 2FA enabled or want to use a token:

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" (classic)
3. Give it a name like "My Git Uploads"
4. Select scopes:
   - ✅ repo (full control of private repositories)
   - ✅ gist
5. Click "Generate token"
6. Copy the token (save it somewhere safe!)
7. Use this token as your password when pushing

### Step 5: Verify Upload
Go to https://github.com/YOUR-USERNAME/YOUR-REPO-NAME and verify all files are there!

## Quick Command Reference

```powershell
# View git status
git status

# View commit history
git log --oneline

# Push future changes
git add .
git commit -m "Your commit message"
git push origin main
```

## Important Notes

⚠️ **The `.env` file contains your Groq API key!**
- Make sure `.env` is in `.gitignore` (it is already)
- Never commit API keys to public repositories
- The `.gitignore` file prevents this automatically

## After First Upload

For future updates:
```powershell
git add .
git commit -m "Description of your changes"
git push origin main
```

---

Need help? Check GitHub's guide: https://docs.github.com/en/get-started/importing-your-projects-to-github
