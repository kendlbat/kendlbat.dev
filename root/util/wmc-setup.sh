#!/usr/bin/bash
cd $HOME
BASEURL=https://kendlbat.dev/util/wmcsetup/
gsettings set org.gnome.desktop.interface gtk-theme Adwaita-dark && gsettings set org.gnome.desktop.interface gtk-color-scheme prefer-dark
curl ${BASEURL}gcm.sh | BASEURL=$BASEURL bash - &
curl ${BASEURL}pnpm.sh | BASEURL=$BASEURL bash - &
curl ${BASEURL}vscodesettings.sh | BASEURL=$BASEURL bash - &
curl ${BASEURL}ublock.sh | BASEURL=$BASEURL bash - &
