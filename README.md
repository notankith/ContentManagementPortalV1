# EDITORS PORTAL

*Automatically synced with your [v0.app](https://v0.app) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/notankiths-projects/v0-editors-portal)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/projects/bmnCaIxTbCV)

## Overview

This repository will stay in sync with your deployed chats on [v0.app](https://v0.app).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.app](https://v0.app).

## Deployment

Your project is live at:

**[https://vercel.com/notankiths-projects/v0-editors-portal](https://vercel.com/notankiths-projects/v0-editors-portal)**

## Build your app

Continue building your app on:

**[https://v0.app/chat/projects/bmnCaIxTbCV](https://v0.app/chat/projects/bmnCaIxTbCV)**

## How It Works

1. Create and modify your project using [v0.app](https://v0.app)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository

## Environment variables for scheduling

The scheduling API requires the following environment variables set (do NOT commit secrets):

- `PAGE_ID` – Facebook Page ID used for publishing/scheduling.
- `PAGE_TOKEN` – Page access token with publish permissions.
- `IG_REELS` – Set to `true` to enable automatic cross-posting of scheduled items to the connected Instagram Business account (optional). When enabled the scheduler will attempt to create unpublished Instagram media containers with the same caption and media URL and set the same scheduled time.

Note: The Instagram account must be connected to the same Meta App and Page (the Page should have a connected `instagram_business_account`). The Graph API permissions and behavior for scheduling Instagram content may vary by API version and account type; check Meta's developer docs and your app permissions if scheduling fails.
