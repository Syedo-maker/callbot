# SBC: Vapi ↔ Pakistani carrier (Asterisk)

```
Vapi (cloud) ──SIP/RTP──▶  SBC VM (Asterisk, static IP)  ──SIP/RTP──▶  Licensed PK operator ──▶ student's mobile
   BYO SIP trunk credential        from-vapi → +92 only, caller ID = UAN       PTCL / Nayatel / Wateen …
```

Why an SBC? Pakistani operators hand over a SIP trunk tied to **their** requirements: an IP whitelist, number format, and sometimes registration. The SBC translates between Vapi and the carrier, presents the **university UAN** as caller ID, blocks anything that isn't a +92 number (fraud guard), and caps concurrent channels.

## 1. VM

- 2 vCPU / 2 GB RAM is plenty for 20 concurrent calls (Asterisk only relays audio).
- **Static public IP.** Give it to the carrier for their whitelist, and to Vapi as the trunk gateway.
- Region close to Pakistan, for example Middle East / Mumbai / Singapore, or a Pakistani data centre if the carrier requires the IP to be local. **Ask the carrier.**
- Firewall. Everything else is closed:

| Port | Protocol | Allow from |
|---|---|---|
| 5060 | UDP | Vapi SIP IPs (`VAPI_SIP_IPS`), carrier SIP IP |
| 10000–10400 | UDP (RTP) | Vapi media IPs, carrier media IPs |
| 22 | TCP | Admin IPs only |

## 2. Configure

Fill these in `.env` (see `.env.example`):

| Variable | Example | From |
|---|---|---|
| `SBC_PUBLIC_IP` | `203.0.113.10` | VM |
| `SBC_LOCAL_NET` | `10.0.0.0/8` | VM network |
| `SBC_SIP_USERNAME` / `SBC_SIP_PASSWORD` | random, 20+ chars | You (Vapi uses these to authenticate to the SBC) |
| `VAPI_SIP_IPS` | `x.x.x.x,y.y.y.y` | Vapi docs / support |
| `CARRIER_HOST`, `CARRIER_PORT`, `CARRIER_USERNAME`, `CARRIER_PASSWORD` | | Carrier |
| `UNIVERSITY_CALLER_ID_LOCAL` | `042111000000` | Carrier / university UAN |
| `MAX_CHANNELS` | `10` | Contracted channels |

Then:

```bash
cd telephony/sbc
docker compose up -d
docker compose logs -f          # look for "Asterisk Ready" and a successful carrier qualify
docker exec -it callbot-sbc asterisk -rx "pjsip show endpoints"
```

## 3. Register the trunk in Vapi

```bash
npm run vapi:telephony -- byo-trunk            # preview (secrets redacted)
npm run vapi:telephony -- byo-trunk --apply    # creates the credential + the UAN as a BYO number
```

Put the printed `VAPI_PHONE_NUMBER_ID_PK` in `.env`.

## 4. Test (Phase 1 exit criteria)

1. `npm run call:test -- --to <your mobile> --dry-run`: check the payload.
2. `npm run call:test -- --to <your mobile>`: a real call. You should see the **university UAN** as caller ID.
3. Repeat on **Jazz, Zong, Telenor and Ufone** SIMs. Check caller ID, audio both ways, and hang-up in both directions.
4. `docker exec -it callbot-sbc asterisk -rx "core show channels"` during a call.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Vapi call fails immediately (`sip-…` ended reason) | Firewall, wrong `VAPI_SIP_IPS`, or auth mismatch between the Vapi credential and `SBC_SIP_*` |
| Call connects but no audio | RTP ports closed, or wrong `SBC_PUBLIC_IP` / `SBC_LOCAL_NET` (NAT) |
| Student sees the wrong caller ID | Carrier overrides the From header. Ask them to allow the UAN via P-Asserted-Identity |
| `403`/`404` from the carrier | Number format. Change `Set(NUM=…)` in `extensions.conf` to `92…` or `+92…` |
| "Channel limit reached" in logs | Raise `MAX_CHANNELS` only up to the contracted channel count |
