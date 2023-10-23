#!/usr/bin/bash
rm $HOME/.config/Code/User/settings.json
curl -o $HOME/.config/Code/User/settings.json -L ${BASEURL}settings.json