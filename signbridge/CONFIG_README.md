# Configuration Setup

## Quick Start

1. **Copy the template:**
   ```bash
   cp config.ts.template config.ts
   ```

2. **Find your IP address:**
   - **macOS/Linux:** `ipconfig getifaddr en0`
   - **Windows:** `ipconfig` (look for IPv4 Address)

3. **Update `config.ts`:**
   ```typescript
   export const SERVER_IP = "YOUR_IP_HERE";  // e.g., "192.168.1.100"
   ```

4. **Done!** The app will automatically use this IP to connect to the backend.

## Notes

- `config.ts` is gitignored - each team member has their own copy
- `config.ts.template` is committed - use this as the starting point
- For web/simulator testing, you can use `"localhost"` as the SERVER_IP
- Make sure backend is running on the same IP at port 8000
