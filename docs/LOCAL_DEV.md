# Running MicroJobs Locally (Client + Mobile)

Development only. Nothing here is for build/production.

## Fixed ports

| Service | Port | URL |
| --- | --- | --- |
| API (Express) | `5050` | <http://localhost:5050/api> |
| Web client (Vite) | `8082` | <http://localhost:8082> |
| Expo Metro | `8081` | `exp://<LAN-IP>:8081` |

Override only with `DEV_API_PORT`, `DEV_CLIENT_PORT`, `METRO_PORT`.
Never set a generic `PORT` when starting Expo — `mobile/scripts/startExpo.cjs`
intentionally ignores it, because hosting tools set `PORT` for the wrong process.

## The one command you normally want

```powershell
npm run dev
```

This starts (or safely reuses) all three services and prints the Expo QR.
`Ctrl+C` stops only what that invocation started.

If the phone cannot reach the PC (guest Wi-Fi, AP/client isolation, phone on
mobile data, or different subnets):

```powershell
npm run dev:tunnel
```

## Running services individually

```powershell
npm run dev:server     # API only  -> http://localhost:5050/api
npm run dev:client     # Web only  -> http://localhost:8082
npm run mobile:start   # Expo only -> QR on port 8081
npm run mobile:start:clear   # Expo, clearing the Metro cache
npm run mobile:android       # Expo -> Android emulator/device
npm run mobile:web           # Expo -> react-native-web in a browser
```

`dev:client` and `mobile:start` both need the API running, so start
`dev:server` first when you launch them separately.

## How the mobile app finds the API (important)

There is no hardcoded IP. `npm run dev`/`mobile:start` sets:

- `EXPO_PUBLIC_API_SOURCE=development-metro-proxy`
- `MICROJOBS_METRO_API_TARGET=http://127.0.0.1:5050`
- `EXPO_PUBLIC_SOCKET_PATH=/microjobs-socket`

`mobile/config.ts` then derives the API base from the **Expo QR host** and
routes through the Metro proxy in `mobile/metro.config.js`:

- `http://<expo-host>:8081/microjobs-api/api` -> `http://127.0.0.1:5050`
- `http://<expo-host>:8081/microjobs-socket`  -> `http://127.0.0.1:5050/socket.io`

So the phone only ever needs to reach **port 8081**. Port 5050 does not need to
be open to the LAN. This is why hardcoding `EXPO_PUBLIC_API_URL` is usually the
wrong fix — it bypasses the proxy and then breaks whenever your IP changes.

## Diagnosed problems on this machine

### 1. Windows Firewall has inbound BLOCK rules for node.exe (primary cause)

Two enabled inbound rules block `node.exe` on the Public profile:

```
Program: C:\users\admin\appdata\local\nvm\v22.13.0\node.exe
Profiles: Public
Action:   Block
Enabled:  Yes
```

Block rules **always win** over allow rules in Windows Firewall, so the allow
rules for "Node.js JavaScript Runtime" are being overridden. The active adapter
(`Ethernet`) is categorized **Public**, and the Public profile is
`BlockInbound`. Result: Metro binds port 8081 fine and the QR renders, but the
phone's TCP connection is dropped — the app hangs on "connecting"/`HTTP 0`.

Delete the block rules (run PowerShell **as Administrator**):

```powershell
Remove-NetFirewallRule -DisplayName "node.exe"
```

Then allow the three dev ports on private networks:

```powershell
New-NetFirewallRule -DisplayName "MicroJobs Dev (Metro 8081)" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8081 -Profile Private
New-NetFirewallRule -DisplayName "MicroJobs Dev (Web 8082)"   -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8082 -Profile Private
New-NetFirewallRule -DisplayName "MicroJobs Dev (API 5050)"   -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5050 -Profile Private
```

### 2. The active network is "Public"

The rules above are scoped to `Private`, so also switch the adapter category
(as Administrator):

```powershell
Set-NetConnectionProfile -InterfaceAlias "Ethernet" -NetworkCategory Private
```

This is also what makes Windows allow LAN device discovery at all.

### 3. Four IPv4 addresses — fragile LAN selection (secondary risk)

```
Ethernet                       192.168.1.20   <- the real LAN IP
Ethernet 2                     192.168.56.1   <- VirtualBox host-only
VMware Network Adapter VMnet1  192.168.13.1   <- VMware
VMware Network Adapter VMnet8  192.168.116.1  <- VMware
```

`getLanAddress()` in `scripts/dev.cjs` and `mobile/scripts/startExpo.cjs`
de-prioritizes adapters matching `virtual|vmware|vmnet|vbox|...`. Replaying that
logic on this machine currently selects `192.168.1.20`, which is correct — so
this is **not** today's failure.

It is fragile, though: `Ethernet 2` (`192.168.56.1`, VirtualBox host-only) does
not match the pattern by name, so it ties at priority `0` with the real adapter
and only wins/loses on enumeration order. Verify the `Mobile API:` line printed
by `npm run dev`. If it ever shows anything other than `192.168.1.20`, disable
the unused adapters:

```powershell
Disable-NetAdapter -Name "Ethernet 2","VMware Network Adapter VMnet1","VMware Network Adapter VMnet8" -Confirm:$false
```

or pin the host explicitly for one run:

```powershell
$env:EXPO_PUBLIC_API_URL = "http://192.168.1.20:5050/api"
npm run mobile:start
```

(Only use that override as a workaround; it skips the Metro proxy.)

### 4. Something is bound to UDP 5050

`netstat` shows `UDP 0.0.0.0:5050` held by PID 2136. The API listens on **TCP**
5050, so this does not conflict today, but if the API ever fails to bind, check:

```powershell
Get-Process -Id (Get-NetUDPEndpoint -LocalPort 5050).OwningProcess
```

## Verifying it works

```powershell
# 1. API is alive
curl http://localhost:5050/api/health

# 2. Metro is up and its API proxy works (run while npm run dev is running)
curl http://localhost:8081/status
curl http://localhost:8081/microjobs-api/api/health

# 3. From the phone's browser, on the same Wi-Fi:
#    http://192.168.1.20:8081/microjobs-api/api/health
#    Must return the microjobs-api JSON. If step 2 passes but this fails,
#    it is the firewall/network-category issue above, not the code.
```

In the app, the connection screen shows Mobile API, source, and port. `source`
should read `development-metro-proxy`.

## Other notes

- Requires Node `>=22.13.0` (currently v22.13.0 via nvm4w).
- Expo Go is pinned to **SDK 54 / React Native 0.81.5**. On an SDK mismatch,
  run `npm run mobile:start:clear` and install the SDK 54 client from
  <https://expo.dev/go>.
- Android emulator: loopback maps to `10.0.2.2`, already handled in
  `mobile/config.ts`.
- If Metro is already running, the launcher reuses it and reprints a QR instead
  of failing on the port.
