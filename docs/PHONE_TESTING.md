# Verify SteVie from your iPhone

The laptop address `127.0.0.1:4317` cannot be opened from another device. The recommended first test uses Tailscale Serve: a private HTTPS address shared between your laptop and iPhone. Your existing database and native AI sign-ins stay on the laptop. Both devices must be connected to your Tailscale network, and the laptop must remain awake with SteVie running.

## One-time setup

1. Install [Tailscale](https://tailscale.com/download) on Windows and iPhone. Sign in to the same account on both devices. Use a personal network whose members you trust.
2. In the SteVie Reboot folder, run `npm run phone:setup`. The helper discovers your laptop's Tailscale address and prepares `.env` with a random workspace password. It saves your address and password in the private local file `data/phone-access.txt`. It does not enable a tunnel itself.
3. Stop the existing SteVie terminal with Ctrl+C. Run `npm run build`, then `npm start`.
4. In a second terminal run `tailscale serve --bg http://127.0.0.1:4317`. If Tailscale displays a setup link, follow it to enable HTTPS. If your Serve already shares another service, inspect its configuration before replacing it.
5. On iPhone, connect Tailscale, open the HTTPS address from the private file in Safari, and enter the workspace password.
6. Choose **Share → Add to Home Screen**. Launch that icon for the notification check.

Official instructions: [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve) and [Serve CLI](https://tailscale.com/docs/reference/tailscale-cli/serve). Serve shares within your Tailscale network. Do not use Funnel for this private test.

## Five checks

| Check | Expected result |
|---|---|
| Open Today | Mission control loads without a blank screen; inbox coverage is labelled partial. |
| Open Inbox recovery → Linked to applications | An application links back to the saved email evidence. Historical events are labelled with their dates. |
| Start a Practice session | You can type comfortably on the phone; draft save status appears. Reload or switch sessions and return: the saved text remains. |
| Knowledge base | Add a small fictional note or your case material; inspect its provenance and review status. A saved link alone is labelled as a link. |
| Import & export | Download your private workspace JSON to Files. Previewing it shows duplicates/conflicts before any import occurs. |

Optional: in Connections, enable notifications from the Home Screen app and use Send a test notification. A configured HTTPS address does not by itself prove delivery; verify the notification on your device.

## Troubleshooting

- **Cannot reach the address:** check Tailscale is connected on both devices, the laptop is awake, `npm start` is running, and `tailscale serve status` lists the service.
- **Older server message or blank page:** stop old SteVie terminals, start the current build, then reload Safari.
- **Password rejected:** use `data/phone-access.txt`; do not share that file. Restarting the server clears browser login sessions.
- **AI not connected:** test it on the laptop's Connections screen. The iPhone uses the laptop's clients; it does not provide separate model tokens.
- **Stop phone access:** use `tailscale serve --https=443 off` for this service. To return to unauthenticated laptop-only use, remove the three phone settings from `.env` and restart with the default loopback host.

Phone access and push delivery remain unverified until the device checks above pass. This setup is not an always-on hosted deployment.
