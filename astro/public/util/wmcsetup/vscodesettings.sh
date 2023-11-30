#!/usr/bin/bash
code --install-extension llacoste2000.unofficial-gitlab-dark-theme
code --install-extension esbenp.prettier-vscode
code --install-extension shd101wyy.markdown-preview-enhanced
rm $HOME/.config/Code/User/settings.json
curl -o $HOME/.config/Code/User/settings.json -L ${BASEURL}settings.json