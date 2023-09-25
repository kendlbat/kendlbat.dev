#!/usr/bin/bash
gsettings set org.gnome.desktop.interface gtk-theme Adwaita-dark && gsettings set org.gnome.desktop.interface gtk-color-scheme prefer-dark
curl -o ~/gcm_install.deb https://github.com/git-ecosystem/git-credential-manager/releases/download/v2.3.2/gcm-linux_amd64.2.3.2.deb
dpkg -x ~/gcm gcm_install.deb
alias git-credential-manager='~/gcm/usr/local/bin/git-credential-manager'
export GCM_CREDENTIAL_STORE=cache
git clone https://gitlab.com/htl-villach/informatik/2023-4bhif/wmc/KENDLBACHER ~/wmc_kendlbat
