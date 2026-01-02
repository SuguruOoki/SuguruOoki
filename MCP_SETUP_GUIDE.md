# MCP Server Setup Guide

## Overview
This repository uses Model Context Protocol (MCP) servers to enhance Claude Desktop functionality. This guide documents the current setup and how to configure additional servers.

## Current MCP Server Configuration

### Active Servers (15 total)

#### Documentation & Context
1. **context7** - Up-to-date library documentation lookup
   - Type: Remote (SSE)
   - URL: `https://mcp.context7.com/mcp`

2. **serena** - IDE semantic code assistant
   - Type: Local (uvx)
   - Features: Code navigation, refactoring, semantic search

#### Search & Web
3. **MCP-Brave-Search** - Web search capabilities
   - Type: Local (npx)
   - Environment: `BRAVE_API_KEY`
   - Current: `<YOUR_BRAVE_API_KEY>`

4. **MCP-Sequential-Thinking** - Enhanced reasoning and problem-solving
   - Type: Local (npx)

#### Development Tools
5. **TechBowl-Github** - GitHub repository integration
   - Type: Docker container
   - Environment: `GITHUB_PERSONAL_ACCESS_TOKEN`
   - Permissions: Read repositories, issues, PRs

6. **git** ⭐ NEW
   - Type: Local (npx)
   - Features: Repository operations, search, manipulation
   - Repository: `/Users/suguru_oki_mosh/workspace`

#### File System & Storage
7. **filesystem** - Secure file operations
   - Type: Local (npx)
   - Access: `/Users/suguru_oki_mosh/workspace`

8. **memory** - Knowledge graph-based persistent memory
   - Type: Local (npx)

#### Browser Automation
9. **playwright** - Browser automation and testing
   - Type: Local (npx)
   - Config: `~/.claude/playwright-config.json`

10. **chrome-devtools** - Chrome DevTools integration
    - Type: Local (npx)

#### Design & Collaboration
11. **figma-developer-mcp** - Figma design integration
    - Type: Local (npx)
    - Environment: `FIGMA_API_KEY`
    - Current: `<YOUR_FIGMA_API_KEY>`

12. **slack** - Slack workspace integration
    - Type: Local (npx)
    - Environment:
      - `SLACK_BOT_TOKEN`: `<YOUR_SLACK_BOT_TOKEN>`
      - `SLACK_TEAM_ID`: `<YOUR_SLACK_TEAM_ID>`

#### Utilities
13. **time** ⭐ NEW
    - Type: Local (npx)
    - Features: Timezone conversion, time calculations

14. **notion** ⭐ NEW
    - Type: Local (npx)
    - Environment: `NOTION_API_KEY` (needs configuration)
    - Features: Notion workspace integration

15. **everything** ⭐ NEW
    - Type: Local (npx)
    - Features: Reference server with prompts, resources, and tools

## Environment Variables Required

### Required API Keys

```bash
# Brave Search
BRAVE_API_KEY=<YOUR_BRAVE_API_KEY>

# GitHub Integration
GITHUB_PERSONAL_ACCESS_TOKEN=<YOUR_GITHUB_PERSONAL_ACCESS_TOKEN>

# Figma Integration
FIGMA_API_KEY=<YOUR_FIGMA_API_KEY>

# Slack Integration
SLACK_BOT_TOKEN=<YOUR_SLACK_BOT_TOKEN>
SLACK_TEAM_ID=<YOUR_SLACK_TEAM_ID>

# Notion Integration (⚠️ NOT CONFIGURED)
NOTION_API_KEY=
```

## Setup Instructions

### Prerequisites
- Node.js v18+ (currently: v24.9.0)
- npm 11.6.1+
- Docker (for GitHub server)
- uvx (for Serena)

### Adding New Servers

1. **Backup current configuration**
```bash
cp ~/Library/Application\ Support/Claude/claude_desktop_config.json \
   ~/Library/Application\ Support/Claude/claude_desktop_config.json.backup
```

2. **Add server configuration** to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "server-name": {
      "command": "/usr/local/bin/npx",
      "args": ["-y", "package-name"],
      "env": {
        "API_KEY": "your-key-here"
      }
    }
  }
}
```

3. **Restart Claude Desktop** for changes to take effect

### Testing MCP Servers

After adding servers, verify they're working:
1. Open Claude Desktop
2. Check MCP connection status in settings
3. Test server-specific commands

## Configuration File Locations

- **Main Config**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Playwright Config**: `~/.claude/playwright-config.json`
- **Backup Files**: `~/Library/Application Support/Claude/claude_desktop_config.json.backup.*`

## Useful MCP Servers to Consider

### Database & Data
- **SQLite**: `@sqliteai/sqlite-mcp-darwin-x86_64` - SQLite database operations
- **Postgres**: Database integration for PostgreSQL

### Cloud Services
- **AWS**: AWS service integration
- **Google Drive**: File storage integration

### Development
- **Code Runner**: Execute code snippets
- **Puppeteer**: Alternative browser automation

## Troubleshooting

### Server Not Connecting
1. Check Node.js version compatibility
2. Verify API keys are valid
3. Ensure proper permissions for filesystem access
4. Restart Claude Desktop

### Docker Issues (GitHub server)
- Ensure Docker daemon is running
- Check Docker image is pulled: `docker pull ghcr.io/github/github-mcp-server`

### NPX Issues
- Clear npm cache: `npm cache clean --force`
- Update npx: `npm install -g npm@latest`

## Security Notes

⚠️ **API Key Security**
- This file contains sensitive API keys for demonstration
- In production, use environment variables
- Never commit API keys to version control
- Rotate keys regularly

## Resources

- [Official MCP Documentation](https://modelcontextprotocol.io/)
- [MCP Server Registry](https://registry.modelcontextprotocol.io/)
- [GitHub: modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)
- [Awesome MCP Servers](https://github.com/wong2/awesome-mcp-servers)

## Changelog

### 2026-01-02
- Added **git** server for repository operations
- Added **time** server for timezone utilities
- Added **notion** server (pending API key configuration)
- Added **everything** reference server
- Created comprehensive setup documentation

---

**Last Updated**: 2026-01-02
**Configuration Version**: 15 servers active
