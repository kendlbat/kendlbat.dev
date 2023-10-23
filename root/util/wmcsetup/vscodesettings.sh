#!/usr/bin/bash
code --install-extension llacoste2000.unofficial-gitlab-dark-theme
rm $HOME/.config/Code/User/settings.json
curl -o $HOME/.config/Code/User/settings.json -L ${BASEURL}settings.json