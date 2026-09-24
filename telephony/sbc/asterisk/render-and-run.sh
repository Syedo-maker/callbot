#!/bin/sh
# Renders the Asterisk templates from environment variables, then starts Asterisk in the foreground.
# Only the variables listed here are substituted, so Asterisk's own ${EXTEN} etc. survive.
# Values must not contain the characters | & or \ (they would break the sed substitution).
set -eu

VARS="SBC_PUBLIC_IP SBC_LOCAL_NET SBC_SIP_USERNAME SBC_SIP_PASSWORD VAPI_SIP_IPS CARRIER_HOST CARRIER_PORT CARRIER_USERNAME CARRIER_PASSWORD UNIVERSITY_CALLER_ID_LOCAL MAX_CHANNELS"

for v in $VARS; do
  eval "val=\${$v:-}"
  if [ -z "$val" ]; then echo "render-and-run: $v is not set" >&2; exit 1; fi
done

for f in pjsip.conf extensions.conf rtp.conf; do
  cp "/templates/$f" "/etc/asterisk/$f"
  for v in $VARS; do
    eval "val=\${$v}"
    sed -i "s|\${$v}|$val|g" "/etc/asterisk/$f"
  done
done

exec asterisk -f -vvv
