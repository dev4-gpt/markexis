#!/usr/bin/env bash
# open-ui.sh — start SSH tunnel and open NocoDB + Open WebUI in browser
# Usage: bash scripts/open-ui.sh

SSH_KEY="$HOME/.ssh/id_new_droplet"
VPS="root@67.207.89.85"

# Kill any existing tunnel on these ports
pkill -f "8090:localhost:8090" 2>/dev/null
sleep 1

echo "Starting SSH tunnel..."
ssh -f -N -i "$SSH_KEY" \
  -L 8090:localhost:8090 \
  -L 3001:localhost:3001 \
  -o StrictHostKeyChecking=no \
  -o ServerAliveInterval=30 \
  "$VPS"

if [ $? -ne 0 ]; then
  echo "ERROR: SSH tunnel failed. Check that ~/.ssh/id_new_droplet exists and the VPS is reachable."
  exit 1
fi

echo "Tunnel up. Opening browser..."
sleep 2

open "http://localhost:8090"   # NocoDB
sleep 1
open "http://localhost:3001"   # Open WebUI

echo ""
echo "NocoDB:      http://localhost:8090"
echo "Open WebUI:  http://localhost:3001"
echo ""
echo "Tunnel is running in background. To stop it:"
echo "  pkill -f '8090:localhost:8090'"
